import 'dotenv/config';
import { pool } from '../apps/server/src/db/pool.js';
import { hashPassword } from '../apps/server/src/lib/password.js';

async function run() {
  const newPassword = process.env.SEED_PASSWORD || 'FlowDesk@2026';
  console.log(`Hashing new password: ${newPassword}...`);
  const hash = await hashPassword(newPassword);

  const result = await pool.query(
    'UPDATE users SET password_hash = $1 RETURNING id, name, email, role',
    [hash],
  );

  console.log(`Successfully updated ${result.rowCount} user(s) to new password!`);
  result.rows.forEach((u) => {
    console.log(`  - [${u.role}] ${u.name} (${u.email})`);
  });

  await pool.end();
}

run().catch((err) => {
  console.error('Failed to update passwords:', err);
  process.exit(1);
});
