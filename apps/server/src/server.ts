import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createGateway } from './realtime/gateway.js';
import { startJobs } from './jobs/overdue.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { pool } from './db/pool.js';

const server = createServer();
const realtime = createGateway(server);
server.on('request', createApp(realtime));
pool.on('error', (err) => logger.error({ err }, 'Idle database connection failed'));
await pool.query('SELECT 1');
const stopJobs = startJobs(realtime);
server.listen(env.PORT, '0.0.0.0', () => logger.info({ port: env.PORT }, 'API listening'));
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  await stopJobs();
  await realtime.close();
  await pool.end();
  clearTimeout(deadline);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
