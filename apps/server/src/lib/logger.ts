import { Writable } from 'node:stream';
import pino from 'pino';
import { env } from '../config/env.js';

const devStream = new Writable({
  write(chunk, _encoding, callback) {
    try {
      const data = JSON.parse(chunk.toString());
      const time = new Date(data.time || Date.now()).toLocaleTimeString();
      const msg = data.msg || '';

      if (data.req && data.res) {
        const method = data.req.method || '';
        const url = data.req.url || '';
        const status = data.res.statusCode || 200;
        const duration = data.responseTime !== undefined ? `${data.responseTime}ms` : '';
        const statusColor = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
        const reset = '\x1b[0m';
        process.stdout.write(`[API] ${time} -> ${statusColor}${status}${reset} ${method} ${url} (${duration})\n`);
      } else if (msg) {
        process.stdout.write(`[API] ${time} -> ${msg}\n`);
      } else {
        process.stdout.write(chunk.toString());
      }
    } catch {
      process.stdout.write(chunk.toString());
    }
    callback();
  },
});

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'token',
      'password_hash',
    ],
  },
  env.NODE_ENV === 'development' ? devStream : undefined,
);
