import EmbeddedPostgres from 'embedded-postgres';
import { config } from 'dotenv';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
config({ path: 'apps/server/.env', quiet: true });
if (!process.env.DATABASE_URL) throw new Error('Run npm run setup:local first.');
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('local-db only starts a local database. Use your external database separately.');
const databaseDir = resolve('.local/postgres');
mkdirSync(resolve('.local'), { recursive: true });
const db = new EmbeddedPostgres({
  databaseDir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port) || 5432,
  persistent: true,
  authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: (message) => {
    if (String(message).includes('FATAL')) console.error(message);
  },
});
if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await db.initialise();
await db.start();
const client = db.getPgClient('postgres', '127.0.0.1');
await client.connect();
const name = url.pathname.slice(1);
if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('Use a simple lowercase local database name.');
const found = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
await client.end();
if (!found.rowCount) await db.createDatabase(name);
console.info(
  `Local PostgreSQL ready at 127.0.0.1:${url.port || 5432}. Data persists in .local/postgres. Keep this terminal open.`,
);
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await db.stop();
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
