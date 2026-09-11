import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import request from 'supertest';
import { io as connect, type Socket } from 'socket.io-client';
import pg from 'pg';

const state = vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.APP_ORIGIN = 'http://localhost:5173';
  process.env.DATABASE_URL = 'postgresql://unused:unused@localhost/unused';
  process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-32-characters-minimum';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-32-characters-minimum';
  process.env.LOG_LEVEL = 'silent';
  return { db: null as any };
});
vi.mock('../src/db/pool.js', () => ({
  pool: { query: (sql: string, values?: unknown[]) => state.db.query(sql, values) },
  transaction: (work: any) => state.db.transaction(work),
}));
import { createApp } from '../src/app.js';
import { createGateway, type Realtime } from '../src/realtime/gateway.js';
import { seedData } from '../src/db/seed-data.js';
import { updateOverdue } from '../src/modules/work/work.repository.js';

const origin = 'http://localhost:5173';
const password = 'Test-password-2026!';
let server: Server;
let realtime: Realtime;
let base: string;
let closeDb: () => Promise<void>;
const auth: Record<string, { token: string; cookie: string; user: any }> = {};
let tasks: any[];
let projects: any[];
const sockets: Socket[] = [];
function call(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  role = 'admin',
  body?: Record<string, unknown>,
) {
  const r = request(server)[method](`/api${path}`).set('Origin', origin);
  if (auth[role]) r.set('Authorization', `Bearer ${auth[role]!.token}`);
  return body === undefined ? r : r.send(body);
}
async function login(alias: string) {
  const res = await call('post', '/auth/login', 'none', {
    email: `${alias}@velozity.test`,
    password,
  });
  expect(res.status).toBe(200);
  return {
    token: res.body.accessToken,
    cookie: res.headers['set-cookie'][0].split(';')[0],
    user: res.body.user,
  };
}
async function socketFor(role: string) {
  const socket = connect(base, {
    transports: ['websocket'],
    auth: { token: auth[role]!.token },
    extraHeaders: { Origin: origin },
    reconnection: false,
    forceNew: true,
  });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}
function event<T = any>(socket: Socket, name: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Missing ${name}`)), 4000);
    socket.once(name, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

beforeAll(async () => {
  const migrationSql = (
    await Promise.all(
      (await readdir('migrations'))
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => readFile(`migrations/${name}`, 'utf8')),
    )
  ).join('\n');
  if (process.env.TEST_DATABASE_URL) {
    const schema = `test_${Date.now()}`;
    const bootstrap = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await bootstrap.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.searchParams.set('options', `-c search_path=${schema},public`);
    const pool = new pg.Pool({ connectionString: url.toString() });
    state.db = {
      query: (sql: string, v?: unknown[]) => pool.query(sql, v),
      transaction: async (work: any) => {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          const r = await work(c);
          await c.query('COMMIT');
          return r;
        } catch (e) {
          await c.query('ROLLBACK');
          throw e;
        } finally {
          c.release();
        }
      },
    };
    closeDb = async () => {
      await pool.end();
      await bootstrap.query(`DROP SCHEMA ${schema} CASCADE`);
      await bootstrap.end();
    };
    await state.db.query(migrationSql);
  } else {
    const db = new PGlite();
    await db.waitReady;
    const adapt = (client: any) => ({
      query: async (sql: string, v?: unknown[]) => {
        const r = await client.query(sql, v);
        return { rows: r.rows, rowCount: r.affectedRows || r.rows.length };
      },
    });
    state.db = {
      ...adapt(db),
      transaction: (work: any) => db.transaction((tx) => work(adapt(tx))),
    };
    await db.exec(migrationSql);
    closeDb = () => db.close();
  }
  await state.db.transaction((db: any) => seedData(db, password));
  server = createServer();
  realtime = createGateway(server);
  server.on('request', createApp(realtime));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  for (const alias of ['admin', 'maya', 'james', 'arjun', 'sofia'])
    auth[alias] = await login(alias);
  tasks = (await call('get', '/tasks')).body.items;
  projects = (await call('get', '/projects')).body;
});
afterAll(async () => {
  for (const socket of sockets) socket.disconnect();
  await realtime?.close();
  await closeDb?.();
});

describe('Authentication and request boundaries', () => {
  it('keeps existing access tokens valid during rotation and revokes them on logout', async () => {
    const session = await login('sofia');
    const rotated = await call('post', '/auth/refresh', 'none').set('Cookie', session.cookie);
    expect(rotated.status).toBe(200);
    expect(
      (await request(server).get('/api/tasks').set('Authorization', `Bearer ${session.token}`))
        .status,
    ).toBe(200);
    const nextCookie = rotated.headers['set-cookie'][0].split(';')[0];
    await call('post', '/auth/logout', 'none').set('Cookie', nextCookie);
    expect(
      (await request(server).get('/api/tasks').set('Authorization', `Bearer ${session.token}`))
        .status,
    ).toBe(401);
  });
  it('returns sanitized users and an HttpOnly refresh cookie', async () => {
    const res = await call('post', '/auth/login', 'none', {
      email: 'admin@velozity.test',
      password,
    });
    expect(res.status).toBe(200);
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.refresh).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(res.headers['set-cookie'][0]).toContain('SameSite=Lax');
  });
  it('rejects incorrect credentials without revealing account existence', async () => {
    for (const email of ['admin@velozity.test', 'missing@velozity.test']) {
      const r = await call('post', '/auth/login', 'none', {
        email,
        password: 'incorrect-password',
      });
      expect(r.status).toBe(401);
      expect(r.body.error.code).toBe('INVALID_CREDENTIALS');
    }
  });
  it('rejects missing and tampered access tokens', async () => {
    expect((await call('get', '/projects', 'none')).status).toBe(401);
    expect(
      (
        await request(server)
          .get('/api/projects')
          .set('Authorization', `Bearer ${auth.admin!.token.slice(0, -5)}wrong`)
      ).status,
    ).toBe(401);
  });
  it('enforces Origin on cookie-authenticated mutations', async () => {
    const r = await request(server)
      .post('/api/auth/refresh')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', auth.admin!.cookie);
    expect(r.status).toBe(403);
  });
  it('rotates refresh tokens, revokes the family on replay, and rejects the replacement', async () => {
    const session = await login('sofia');
    const rotated = await call('post', '/auth/refresh', 'none').set('Cookie', session.cookie);
    expect(rotated.status).toBe(200);
    const next = rotated.headers['set-cookie'][0].split(';')[0];
    expect(next).not.toBe(session.cookie);
    expect((await call('post', '/auth/refresh', 'none').set('Cookie', session.cookie)).status).toBe(
      401,
    );
    expect((await call('post', '/auth/refresh', 'none').set('Cookie', next)).status).toBe(401);
    expect(
      (
        await request(server)
          .get('/api/projects')
          .set('Authorization', `Bearer ${rotated.body.accessToken}`)
      ).status,
    ).toBe(401);
  });
  it('revokes the access session on logout', async () => {
    const session = await login('sofia');
    expect((await call('post', '/auth/logout', 'none').set('Cookie', session.cookie)).status).toBe(
      204,
    );
    expect(
      (await request(server).get('/api/tasks').set('Authorization', `Bearer ${session.token}`))
        .status,
    ).toBe(401);
  });
  it('rejects invalid IDs and unknown mutation fields', async () => {
    expect((await call('get', '/tasks/not-an-id')).status).toBe(400);
    expect(
      (
        await call('patch', `/tasks/${tasks[0].id}/status`, 'admin', {
          status: 'DONE',
          version: 1,
          role: 'ADMIN',
        })
      ).status,
    ).toBe(400);
    expect((await call('get', '/tasks?from=2026-10-01&to=2026-01-01')).status).toBe(400);
  });
});
describe('Role and ownership isolation', () => {
  it('seeds all roles, 3 projects, 18 tasks, and overdue work', async () => {
    const users = (await call('get', '/users')).body;
    expect(users.filter((u: any) => u.role === 'ADMIN')).toHaveLength(1);
    expect(users.filter((u: any) => u.role === 'PROJECT_MANAGER')).toHaveLength(2);
    expect(users.filter((u: any) => u.role === 'DEVELOPER')).toHaveLength(4);
    expect(projects).toHaveLength(3);
    expect(tasks).toHaveLength(18);
    expect(tasks.filter((t) => t.is_overdue).length).toBeGreaterThanOrEqual(2);
  });
  it('prevents developers from accessing management data or creating projects', async () => {
    for (const path of ['/users', '/clients'])
      expect((await call('get', path, 'arjun')).status).toBe(403);
    expect((await call('post', '/projects', 'arjun', {})).status).toBe(403);
  });
  it('limits PMs to their own projects for both reads and writes', async () => {
    const mine = (await call('get', '/projects', 'maya')).body;
    expect(mine.every((p: any) => p.created_by_id === auth.maya!.user.id)).toBe(true);
    const other = projects.find((p) => p.created_by_id === auth.james!.user.id);
    expect((await call('get', `/projects/${other.id}`, 'maya')).status).toBe(404);
    expect(
      (
        await call('patch', `/projects/${other.id}`, 'maya', {
          name: other.name,
          description: 'Changed',
          client_id: other.client_id,
        })
      ).status,
    ).toBe(404);
  });
  it('rejects guessed task IDs and scopes developer task aggregates', async () => {
    const mine = (await call('get', '/tasks', 'arjun')).body.items;
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((t: any) => t.assigned_developer_id === auth.arjun!.user.id)).toBe(true);
    const other = tasks.find((t) => t.assigned_developer_id !== auth.arjun!.user.id);
    expect((await call('get', `/tasks/${other.id}`, 'arjun')).status).toBe(404);
    expect(
      (
        await call('patch', `/tasks/${other.id}/status`, 'arjun', {
          status: 'DONE',
          version: other.version,
        })
      ).status,
    ).toBe(404);
    expect((await call('get', '/dashboard', 'arjun')).body.total).toBe(mine.length);
  });
  it('blocks developer edits beyond status even on their own tasks', async () => {
    const own = tasks.find((t) => t.assigned_developer_id === auth.arjun!.user.id);
    expect((await call('patch', `/tasks/${own.id}`, 'arjun', { title: 'Override' })).status).toBe(
      403,
    );
  });
  it('validates filters, priority ordering, and page bounds', async () => {
    const res = await call('get', '/tasks?status=TODO&priority=CRITICAL');
    expect(res.body.items.every((t: any) => t.status === 'TODO' && t.priority === 'CRITICAL')).toBe(
      true,
    );
    expect((await call('get', '/tasks?page=0')).status).toBe(400);
    expect((await call('get', '/tasks?page=100')).body.items).toEqual([]);
  });
});
describe('Task transactions, catch-up, and notifications', () => {
  it('preserves descriptions on partial edits and rejects empty patches', async () => {
    const task = (await call('get', '/tasks')).body.items[0];
    expect((await call('patch', `/tasks/${task.id}`, 'admin', {})).status).toBe(400);
    const changed = await call('patch', `/tasks/${task.id}`, 'admin', { priority: 'HIGH' });
    expect(changed.status).toBe(200);
    expect(changed.body.description).toBe(task.description);
  });
  it('allows only one of two concurrent changes using the same version', async () => {
    const task = (await call('get', '/tasks')).body.items.find((t: any) => t.status === 'TODO');
    const result = await Promise.all([
      call('patch', `/tasks/${task.id}/status`, 'admin', {
        status: 'IN_PROGRESS',
        version: task.version,
      }),
      call('patch', `/tasks/${task.id}/status`, 'admin', { status: 'DONE', version: task.version }),
    ]);
    expect(result.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  it('commits a status change, actor activity, and PM review notification together', async () => {
    const task = (await call('get', '/tasks', 'arjun')).body.items.find(
      (t: any) => t.status !== 'IN_REVIEW',
    );
    const result = await call('patch', `/tasks/${task.id}/status`, 'arjun', {
      status: 'IN_REVIEW',
      version: task.version,
    });
    expect(result.status).toBe(200);
    const activity = await state.db.query(
      "SELECT * FROM activities WHERE task_id=$1 AND event_type='TASK_STATUS_CHANGED' ORDER BY id DESC LIMIT 1",
      [task.id],
    );
    expect(activity.rows[0].actor_id).toBe(auth.arjun!.user.id);
    expect(activity.rows[0].old_value).toBe(task.status);
    expect(activity.rows[0].new_value).toBe('IN_REVIEW');
    const notices = await state.db.query(
      'SELECT * FROM notifications WHERE task_id=$1 AND user_id=$2',
      [task.id, projects.find((p) => p.id === task.project_id).created_by_id],
    );
    expect(notices.rows.length).toBeGreaterThan(0);
  });
  it('rejects a stale version without another activity record', async () => {
    const task = (await call('get', '/tasks', 'arjun')).body.items[0];
    const before = (await state.db.query('SELECT count(*) FROM activities')).rows[0].count;
    expect(
      (
        await call('patch', `/tasks/${task.id}/status`, 'arjun', {
          status: 'DONE',
          version: task.version + 10,
        })
      ).status,
    ).toBe(409);
    expect((await state.db.query('SELECT count(*) FROM activities')).rows[0].count).toBe(before);
  });
  it('rolls back task changes when activity insertion fails', async () => {
    const task = (await call('get', '/tasks')).body.items.find((t: any) => t.status !== 'DONE');
    await state.db.query(
      "ALTER TABLE activities ADD CONSTRAINT test_activity_failure CHECK (new_value IS DISTINCT FROM 'DONE') NOT VALID",
    );
    try {
      expect(
        (
          await call('patch', `/tasks/${task.id}/status`, 'admin', {
            status: 'DONE',
            version: task.version,
          })
        ).status,
      ).toBe(500);
      expect((await call('get', `/tasks/${task.id}`)).body.status).toBe(task.status);
    } finally {
      await state.db.query('ALTER TABLE activities DROP CONSTRAINT test_activity_failure');
    }
  });
  it('returns only the last 20 missed events, ascending and scoped, without duplicates after cursor', async () => {
    const global = (await call('get', '/activities/catchup?after=0')).body;
    expect(global.items).toHaveLength(20);
    expect(
      global.items.every(
        (a: any, i: number) => i === 0 || BigInt(a.id) > BigInt(global.items[i - 1].id),
      ),
    ).toBe(true);
    expect((await call('get', `/activities/catchup?after=${global.cursor}`)).body.items).toEqual(
      [],
    );
    const mine = (await call('get', '/activities/catchup?after=0', 'arjun')).body.items;
    const taskIds = new Set(
      (await call('get', '/tasks', 'arjun')).body.items.map((t: any) => t.id),
    );
    expect(mine.every((a: any) => taskIds.has(a.task_id))).toBe(true);
  });
  it('marks notifications read only for their recipient', async () => {
    const mine = (await call('get', '/notifications', 'arjun')).body;
    expect(mine.unread).toBeGreaterThan(0);
    expect((await call('patch', `/notifications/${mine.items[0].id}/read`, 'sofia')).status).toBe(
      404,
    );
    expect((await call('patch', `/notifications/${mine.items[0].id}/read`, 'arjun')).status).toBe(
      204,
    );
    expect((await call('get', '/notifications', 'arjun')).body.unread).toBe(mine.unread - 1);
    await call('patch', '/notifications/read-all', 'arjun');
    expect((await call('get', '/notifications', 'arjun')).body.unread).toBe(0);
  });
  it('runs overdue processing independently and idempotently', async () => {
    const task = tasks[0];
    await state.db.query(
      "UPDATE tasks SET status='TODO',due_date=now()-interval '1 day',is_overdue=false WHERE id=$1",
      [task.id],
    );
    expect((await updateOverdue()).length).toBeGreaterThan(0);
    expect((await call('get', `/tasks/${task.id}`)).body.is_overdue).toBe(true);
    expect(await updateOverdue()).toEqual([]);
    await state.db.query("UPDATE tasks SET status='DONE' WHERE id=$1", [task.id]);
    await updateOverdue();
    expect((await call('get', `/tasks/${task.id}`)).body.is_overdue).toBe(false);
  });
});
describe('WebSocket transport and delivery', () => {
  it('rejects unauthenticated connections', async () => {
    const socket = connect(base, {
      transports: ['websocket'],
      extraHeaders: { Origin: origin },
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    const err = await event<Error>(socket, 'connect_error');
    expect(err.message).toBe('UNAUTHENTICATED');
    socket.disconnect();
  });
  it('delivers changes only to task-authorized viewers using WebSocket', async () => {
    const developer = await socketFor('arjun');
    const other = await socketFor('sofia');
    const admin = await socketFor('admin');
    expect(developer.io.engine.transport.name).toBe('websocket');
    const leaked: any[] = [];
    other.on('sync', (value) => leaked.push(value));
    const task = (await call('get', '/tasks', 'arjun')).body.items[0];
    const received = event(developer, 'sync');
    const adminReceived = event(admin, 'sync');
    const res = await call('patch', `/tasks/${task.id}/status`, 'arjun', {
      status: task.status === 'DONE' ? 'TODO' : 'DONE',
      version: task.version,
    });
    expect(res.status).toBe(200);
    expect((await received).resources).toContain('activity');
    expect((await adminReceived).resources).toContain('tasks');
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(leaked).toEqual([]);
    developer.disconnect();
    other.disconnect();
    admin.disconnect();
  });
  it('recovers an event written while disconnected from PostgreSQL', async () => {
    const before = (await call('get', '/activities/catchup?after=0', 'arjun')).body.cursor;
    const task = (await call('get', '/tasks', 'arjun')).body.items[0];
    await call('patch', `/tasks/${task.id}/status`, 'arjun', {
      status: task.status === 'DONE' ? 'TODO' : 'DONE',
      version: task.version,
    });
    const socket = await socketFor('arjun');
    const missed = (await call('get', `/activities/catchup?after=${before}`, 'arjun')).body;
    expect(missed.items.some((a: any) => a.task_id === task.id)).toBe(true);
    socket.disconnect();
  });
  it('removes old notifications and denies old assignees after reassignment', async () => {
    const task = (await call('get', '/tasks', 'arjun')).body.items[0];
    expect(
      (
        await call('patch', `/tasks/${task.id}`, 'admin', {
          assigned_developer_id: auth.sofia!.user.id,
        })
      ).status,
    ).toBe(200);
    expect((await call('get', `/tasks/${task.id}`, 'arjun')).status).toBe(404);
    expect(
      (await call('get', '/notifications', 'arjun')).body.items.some(
        (n: any) => n.task_id === task.id,
      ),
    ).toBe(false);
    expect(
      (await call('get', '/activities', 'arjun')).body.items.some(
        (a: any) => a.task_id === task.id,
      ),
    ).toBe(false);
  });
});
