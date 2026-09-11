import { createHash, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { User } from '@velozity/shared';
import { env } from '../../config/env.js';
import { pool, transaction, type Db } from '../../db/pool.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { unauthorized, AppError } from '../../lib/errors.js';
import * as repo from './auth.repository.js';

const accessKey = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);
const refreshKey = new TextEncoder().encode(env.REFRESH_TOKEN_SECRET);
const issuer = 'velozity-api';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const dummyHash = hashPassword(randomUUID());
export const refreshDuration = 7 * 24 * 60 * 60 * 1000;
async function issue(db: Db, user: User, family: string = randomUUID()) {
  const id = randomUUID();
  const refresh = await new SignJWT({ kind: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setJti(id)
    .setIssuer(issuer)
    .setAudience('velozity-refresh')
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(refreshKey);
  await repo.insertSession(db, {
    id,
    family,
    userId: user.id,
    hash: digest(refresh),
    expires: new Date(Date.now() + refreshDuration),
  });
  const accessToken = await new SignJWT({ sid: id, kind: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(issuer)
    .setAudience('velozity-web')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(accessKey);
  return { accessToken, refresh, user };
}
export async function login(email: string, password: string) {
  const user = await repo.findUserByEmail(email);
  const valid = await verifyPassword(password, user?.password_hash ?? (await dummyHash));
  if (!user?.is_active || !valid)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  const { password_hash: _, ...safe } = user;
  return transaction((db) => issue(db, safe));
}
async function verifyRefresh(token?: string) {
  if (!token) throw unauthorized();
  try {
    const { payload } = await jwtVerify(token, refreshKey, {
      algorithms: ['HS256'],
      issuer,
      audience: 'velozity-refresh',
    });
    if (!payload.jti || !payload.sub || payload.kind !== 'refresh') throw unauthorized();
    return { id: payload.jti, userId: payload.sub, hash: digest(token) };
  } catch {
    throw unauthorized();
  }
}
export async function refresh(token?: string) {
  const verified = await verifyRefresh(token);
  const result = await transaction(async (db) => {
    const session = await repo.lockSession(db, verified.id);
    if (!session || session.user_id !== verified.userId || session.token_hash !== verified.hash)
      return null;
    // Commit revocation even when replay is rejected; throwing here would roll it back.
    if (session.revoked_at || session.expires_at <= new Date()) {
      await repo.revokeFamily(db, session.family_id);
      return null;
    }
    const user = await repo.getUser(db, session.user_id);
    if (!user?.is_active) {
      await repo.revokeFamily(db, session.family_id);
      return null;
    }
    await repo.revokeSession(db, session.id);
    return issue(db, user, session.family_id);
  });
  if (!result) throw unauthorized();
  return result;
}
export async function logout(token?: string) {
  if (!token) return;
  try {
    const verified = await verifyRefresh(token);
    await transaction(async (db) => {
      const session = await repo.lockSession(db, verified.id);
      if (session?.token_hash === verified.hash) await repo.revokeFamily(db, session.family_id);
    });
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
}
export async function authenticateToken(token?: string) {
  if (!token) throw unauthorized();
  let claims;
  try {
    claims = (
      await jwtVerify(token, accessKey, { algorithms: ['HS256'], issuer, audience: 'velozity-web' })
    ).payload;
  } catch {
    throw unauthorized();
  }
  if (!claims.sub || typeof claims.sid !== 'string' || claims.kind !== 'access' || !claims.exp)
    throw unauthorized();
  const user = await repo.findSessionUser(claims.sid, claims.sub);
  if (!user) throw unauthorized();
  return { user, expiresAt: claims.exp * 1000 };
}
export async function cleanupSessions() {
  await pool.query('DELETE FROM sessions WHERE expires_at < now()');
}
