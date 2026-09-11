import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool, transaction } from './pool.js';

try {
  await transaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(74001)');
    await db.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    for (const name of (await readdir(resolve('migrations')))
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      if ((await db.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount)
        continue;
      await db.query(await readFile(resolve('migrations', name), 'utf8'));
      await db.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      console.info(`Applied ${name}`);
    }
  });
} finally {
  await pool.end();
}
