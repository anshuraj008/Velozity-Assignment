import type { Db } from './pool.js';
import { hashPassword } from '../lib/password.js';

export async function seedData(db: Db, password: string) {
  if ((await db.query('SELECT 1 FROM users LIMIT 1')).rowCount)
    throw new Error('Seed requires an empty database. Existing data has been preserved.');
  const hash = await hashPassword(password);
  const people = [
    ['Anshu Raj', 'admin', 'ADMIN'],
    ['Maya Chen', 'maya', 'PROJECT_MANAGER'],
    ['James Wilson', 'james', 'PROJECT_MANAGER'],
    ['Arjun Mehta', 'arjun', 'DEVELOPER'],
    ['Sofia Reyes', 'sofia', 'DEVELOPER'],
    ['Ankita Sharma', 'ankita', 'DEVELOPER'],
    ['Priya Shah', 'priya', 'DEVELOPER'],
  ];
  const users: string[] = [];
  for (const [name, alias, role] of people)
    users.push(
      (
        await db.query<{ id: string }>(
          'INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,$3,$4) RETURNING id',
          [name, `${alias}@velozity.test`, role, hash],
        )
      ).rows[0]!.id,
    );
  const clients: string[] = [];
  for (const [name, company, email] of [
    ['Olivia Martin', 'Forma Studio', 'olivia@forma.example'],
    ['Ethan Park', 'Northstar Labs', 'ethan@northstar.example'],
    ['Isabella Rossi', 'Arc Commerce', 'isabella@arc.example'],
  ]) {
    clients.push(
      (
        await db.query<{ id: string }>(
          'INSERT INTO clients(name,company,email) VALUES($1,$2,$3) RETURNING id',
          [name, company, email],
        )
      ).rows[0]!.id,
    );
  }
  const projects = [
    [
      'Brand & website refresh',
      'A clearer digital home for Forma. Bringing the new identity to every customer touchpoint.',
    ],
    ['Analytics platform', 'Turning Northstar’s product data into useful, everyday decisions.'],
    ['Commerce experience', 'A considered shopping experience, from discovery to delivery.'],
  ];
  const titles = [
    [
      'Build responsive navigation',
      'Connect contact form to API',
      'Review homepage accessibility',
      'Implement case study layout',
      'Complete design token library',
      'Optimize image delivery',
    ],
    [
      'Create reporting endpoints',
      'Build overview metrics',
      'Review event ingestion',
      'Implement date range filters',
      'Set up analytics schema',
      'Add export job',
    ],
    [
      'Integrate product search',
      'Build cart interactions',
      'Review checkout flow',
      'Implement order history',
      'Create product card variants',
      'Configure payment sandbox',
    ],
  ];
  const states = ['IN_PROGRESS', 'TODO', 'IN_REVIEW', 'TODO', 'DONE', 'IN_PROGRESS'];
  const priority = ['HIGH', 'CRITICAL', 'MEDIUM', 'MEDIUM', 'LOW', 'HIGH'];
  for (let p = 0; p < projects.length; p++) {
    const owner = users[p === 2 ? 2 : 1]!;
    const project = (
      await db.query<{ id: string }>(
        'INSERT INTO projects(name,description,client_id,created_by_id) VALUES($1,$2,$3,$4) RETURNING id',
        [...projects[p]!, clients[p], owner],
      )
    ).rows[0]!.id;
    for (let t = 0; t < 6; t++) {
      const developer = users[3 + ((p + t) % 4)]!;
      const due = new Date();
      due.setUTCDate(due.getUTCDate() + (t === 0 ? -2 : t === 1 ? -1 : t + 1));
      due.setUTCHours(17, 0, 0, 0);
      const task = (
        await db.query<{ id: string }>(
          'INSERT INTO tasks(project_id,title,description,assigned_developer_id,status,priority,due_date,is_overdue) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
          [
            project,
            titles[p]![t],
            `Deliver ${titles[p]![t]!.toLowerCase()} with clear loading, empty, and error states. Include keyboard accessibility and verify on mobile before requesting review.`,
            developer,
            states[t],
            priority[t],
            due,
            t < 2,
          ],
        )
      ).rows[0]!.id;
      await db.query(
        "INSERT INTO activities(project_id,task_id,actor_id,event_type,new_value,created_at) VALUES($1,$2,$3,'TASK_ASSIGNED',$4,now()-($5::int*interval '15 minutes'))",
        [project, task, owner, developer, 20 - p * 6 - t],
      );
      if (states[t] !== 'TODO')
        await db.query(
          "INSERT INTO activities(project_id,task_id,actor_id,event_type,old_value,new_value) VALUES($1,$2,$3,'TASK_STATUS_CHANGED','TODO',$4)",
          [project, task, developer, states[t]],
        );
      await db.query('INSERT INTO notifications(user_id,task_id,message) VALUES($1,$2,$3)', [
        developer,
        task,
        `You were assigned “${titles[p]![t]}”.`,
      ]);
      if (states[t] === 'IN_REVIEW')
        await db.query('INSERT INTO notifications(user_id,task_id,message) VALUES($1,$2,$3)', [
          owner,
          task,
          `“${titles[p]![t]}” is ready for review.`,
        ]);
    }
  }
}
