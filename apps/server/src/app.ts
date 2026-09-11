import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import rateLimit from 'express-rate-limit';
import { allowedOrigins, env } from './config/env.js';
import { pool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { notFound } from './lib/errors.js';
import { checkOrigin, errorHandler } from './middleware/http.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { workRouter } from './modules/work/work.routes.js';
import type { Realtime } from './realtime/gateway.js';

export function createApp(realtime: Realtime) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(pinoHttp({ logger, genReqId: () => randomUUID() }));
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.use(
    '/api',
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
    checkOrigin,
    rateLimit({
      windowMs: 60000,
      limit: 600,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment.' },
      },
    }),
  );
  app.use('/api/auth', authRouter);
  app.use('/api', workRouter(realtime));
  app.use(() => {
    throw notFound();
  });
  app.use(errorHandler);
  return app;
}
