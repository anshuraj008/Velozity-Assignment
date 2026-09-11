import { Router, type CookieOptions } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema } from '@velozity/shared';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/http.js';
import * as auth from './auth.service.js';

export const authRouter = Router();
const cookie: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.COOKIE_SAME_SITE,
  path: '/api/auth',
};
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' },
  },
});
authRouter.post('/login', limit, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const { refresh, ...body } = await auth.login(input.email, input.password);
  res.cookie('refresh_token', refresh, { ...cookie, maxAge: auth.refreshDuration }).json(body);
});
authRouter.post('/refresh', limit, async (req, res) => {
  try {
    const { refresh, ...body } = await auth.refresh(req.cookies.refresh_token);
    res.cookie('refresh_token', refresh, { ...cookie, maxAge: auth.refreshDuration }).json(body);
  } catch (error) {
    res.clearCookie('refresh_token', cookie);
    throw error;
  }
});
authRouter.post('/logout', async (req, res) => {
  await auth.logout(req.cookies.refresh_token);
  res.clearCookie('refresh_token', cookie).status(204).end();
});
authRouter.get('/me', authenticate, (req, res) => res.json(req.user));
