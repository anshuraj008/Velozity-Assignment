import { config } from 'dotenv';
import { spawn } from 'node:child_process';
config({ path: 'apps/server/.env', quiet: true });
if (!process.env.DATABASE_URL)
  throw new Error('Configure DATABASE_URL and start PostgreSQL first.');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this helper through npm run test:postgres.');
const child = spawn(process.execPath, [npmCli, 'test'], {
  stdio: 'inherit',
  env: { ...process.env, TEST_DATABASE_URL: process.env.DATABASE_URL },
});
child.on('exit', (code) => process.exit(code ?? 1));
