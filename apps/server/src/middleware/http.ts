import type { RequestHandler, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { User, Role } from '@velozity/shared';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { authenticateToken } from '../modules/auth/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      user: User;
    }
  }
}
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  req.user = (
    await authenticateToken(header?.startsWith('Bearer ') ? header.slice(7) : undefined)
  ).user;
  next();
};
export const roles =
  (...allowed: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!allowed.includes(req.user.role))
      throw new AppError(403, 'FORBIDDEN', 'Your role cannot perform this action.');
    next();
  };
export const checkOrigin: RequestHandler = (req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== env.APP_ORIGIN)
    throw new AppError(403, 'INVALID_ORIGIN', 'Request origin is not allowed.');
  next();
};
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the submitted fields.',
        details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err?.code === '23505') {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with these details already exists.' },
    });
    return;
  }
  if (err?.code === '23503') {
    res.status(409).json({
      error: {
        code: 'REFERENCE_CONFLICT',
        message: 'The record is in use or a linked record no longer exists.',
      },
    });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res
      .status(413)
      .json({ error: { code: 'BODY_TOO_LARGE', message: 'Request body is too large.' } });
    return;
  }
  logger.error({ err, requestId: req.id }, 'Request failed');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
      requestId: req.id,
    },
  });
};
