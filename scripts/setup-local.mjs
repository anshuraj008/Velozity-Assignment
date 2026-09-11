import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
const secret = () => randomBytes(32).toString('hex');
const dbPassword = secret();
if (!existsSync('apps/server/.env')) {
  writeFileSync(
    'apps/server/.env',
    `NODE_ENV=development\nPORT=4000\nDATABASE_URL=postgresql://velozity:${dbPassword}@localhost:55432/velozity\nAPP_ORIGIN=http://localhost:5173\nACCESS_TOKEN_SECRET=${secret()}\nREFRESH_TOKEN_SECRET=${secret()}\nCOOKIE_SAME_SITE=lax\nTRUST_PROXY=0\nLOG_LEVEL=info\nSEED_PASSWORD=${randomBytes(15).toString('base64url')}\n`,
  );
  console.info(
    'Created apps/server/.env with generated local credentials. Find the demo login password in SEED_PASSWORD.',
  );
} else console.info('Preserved existing apps/server/.env.');
if (!existsSync('apps/web/.env')) writeFileSync('apps/web/.env', 'VITE_API_URL=\n');
