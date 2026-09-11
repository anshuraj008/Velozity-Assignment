import 'dotenv/config';
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().startsWith('postgres').transform((value) => {
      const url = new URL(value);
      const sslmode = url.searchParams.get('sslmode')?.toLowerCase();
      if (sslmode && ['prefer', 'require', 'verify-ca'].includes(sslmode))
        url.searchParams.set('sslmode', 'verify-full');
      return url.toString();
    }),
    APP_ORIGIN: z.url().transform((v) => new URL(v).origin),
    ACCESS_TOKEN_SECRET: z.string().min(32),
    REFRESH_TOKEN_SECRET: z.string().min(32),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    LOG_LEVEL: z
      .enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
  })
  .superRefine((v, ctx) => {
    if (v.ACCESS_TOKEN_SECRET === v.REFRESH_TOKEN_SECRET)
      ctx.addIssue({ code: 'custom', message: 'Use different access and refresh secrets' });
    if (
      v.NODE_ENV === 'production' &&
      (!v.APP_ORIGIN.startsWith('https://') ||
        [v.ACCESS_TOKEN_SECRET, v.REFRESH_TOKEN_SECRET].some((s) => s.startsWith('replace-')))
    )
      ctx.addIssue({ code: 'custom', message: 'Production requires HTTPS and generated secrets' });
    if (v.COOKIE_SAME_SITE === 'none' && v.NODE_ENV !== 'production')
      ctx.addIssue({ code: 'custom', message: 'SameSite=None requires production HTTPS cookies' });
  });
const parsed = schema.safeParse(process.env);
if (!parsed.success)
  throw new Error(
    `Invalid server configuration: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
  );
export const env = parsed.data;
