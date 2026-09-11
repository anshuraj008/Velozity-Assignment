import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { User } from '@velozity/shared';
import { allowedOrigins } from '../config/env.js';
import { authenticateToken } from '../modules/auth/auth.service.js';
import { logger } from '../lib/logger.js';
import { scopedTask } from '../modules/work/work.repository.js';
import { pool } from '../db/pool.js';

export type Resources = (
  'tasks' | 'projects' | 'dashboard' | 'activity' | 'notifications' | 'users' | 'clients'
)[];
export interface Realtime {
  sync(resources: Resources, taskId?: string, userId?: string): Promise<void>;
  close(): Promise<void>;
}
export function createGateway(server: HttpServer): Realtime {
  const io = new Server(server, {
    transports: ['websocket'],
    cors: { origin: allowedOrigins, credentials: true },
    allowRequest: (req, callback) =>
      callback(null, allowedOrigins.includes(req.headers.origin ?? '')),
    maxHttpBufferSize: 16384,
  });
  io.use(async (socket, next) => {
    try {
      if (typeof socket.handshake.auth.token !== 'string') throw new Error();
      const auth = await authenticateToken(socket.handshake.auth.token);
      socket.data.user = auth.user;
      socket.data.expiresAt = auth.expiresAt;
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });
  function presence() {
    const users = new Set([...io.sockets.sockets.values()].map((s) => (s.data.user as User).id));
    for (const socket of io.sockets.sockets.values())
      if (socket.data.user.role === 'ADMIN') socket.emit('presence', { count: users.size });
  }
  io.on('connection', (socket) => {
    // Clients never choose rooms. All deliveries below use fresh server-side authorization.
    const timer = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, socket.data.expiresAt - Date.now()),
    );
    presence();
    socket.on('disconnect', () => {
      clearTimeout(timer);
      presence();
    });
  });
  async function validateConnections() {
    for (const socket of io.sockets.sockets.values()) {
      try {
        socket.data.user = (await authenticateToken(socket.handshake.auth.token)).user;
      } catch {
        socket.disconnect(true);
      }
    }
  }
  const validationTimer = setInterval(() => {
    void validateConnections().catch((err) =>
      logger.error({ err }, 'Socket session validation failed'),
    );
  }, 15000);
  return {
    async sync(resources, taskId, userId) {
      try {
        await validateConnections();
        for (const socket of io.sockets.sockets.values()) {
          const user = socket.data.user as User;
          if (userId && userId !== user.id) continue;
          if (taskId && !(await scopedTask(pool, user, taskId))) continue;
          // Only cache keys are sent. Authorized data is fetched through scoped REST queries.
          socket.emit('sync', { resources });
        }
        presence();
      } catch (err) {
        logger.error({ err }, 'Live delivery failed; database catch-up remains available');
      }
    },
    async close() {
      clearInterval(validationTimer);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
