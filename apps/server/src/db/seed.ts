import { passwordSchema } from '@velozity/shared';
import { pool, transaction } from './pool.js';
import { seedData } from './seed-data.js';
try {
  const password = passwordSchema.parse(process.env.SEED_PASSWORD);
  if (password.startsWith('replace-'))
    throw new Error('Set SEED_PASSWORD to a real demo password.');
  await transaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(74003)');
    await seedData(db, password);
  });
  console.info(
    'Seeded 7 users, 3 clients, 3 projects, 18 tasks, activity, and notifications. Demo emails are listed in README.md.',
  );
} finally {
  await pool.end();
}
