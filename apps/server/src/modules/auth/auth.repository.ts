import type { User } from '@velozity/shared';
import { pool, type Db } from '../../db/pool.js';
export const safeUserColumns = 'id,name,email,role,is_active';
export async function findUserByEmail(email: string) {
  return (
    await pool.query<User & { password_hash: string }>(
      `SELECT ${safeUserColumns},password_hash FROM users WHERE email=$1`,
      [email],
    )
  ).rows[0];
}
export async function findSessionUser(sessionId: string, userId: string) {
  return (
    await pool.query<User>(
      `SELECT u.id,u.name,u.email,u.role,u.is_active FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=$1 AND u.id=$2 AND u.is_active AND s.access_revoked_at IS NULL AND s.expires_at>now()`,
      [sessionId, userId],
    )
  ).rows[0];
}
export async function insertSession(
  db: Db,
  session: { id: string; family: string; userId: string; hash: string; expires: Date },
) {
  await db.query(
    'INSERT INTO sessions(id,family_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4,$5)',
    [session.id, session.family, session.userId, session.hash, session.expires],
  );
}
export async function lockSession(db: Db, id: string) {
  return (
    await db.query<{
      id: string;
      family_id: string;
      user_id: string;
      token_hash: string;
      revoked_at: Date | null;
      expires_at: Date;
    }>('SELECT * FROM sessions WHERE id=$1 FOR UPDATE', [id])
  ).rows[0];
}
export async function revokeFamily(db: Db, family: string) {
  await db.query(
    'UPDATE sessions SET revoked_at=COALESCE(revoked_at,now()),access_revoked_at=COALESCE(access_revoked_at,now()) WHERE family_id=$1',
    [family],
  );
}
export async function revokeSession(db: Db, id: string) {
  await db.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [id]);
}
export async function getUser(db: Db, id: string) {
  return (await db.query<User>(`SELECT ${safeUserColumns} FROM users WHERE id=$1`, [id])).rows[0];
}
