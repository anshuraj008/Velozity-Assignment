import type { z } from 'zod';
import type {
  User,
  Project,
  Task,
  Client,
  Activity,
  Notification,
  filterSchema,
  projectSchema,
  taskSchema,
  taskPatchSchema,
} from '@velozity/shared';
import { pool, type Db } from '../../db/pool.js';
import { taskScope, projectScope } from './policy.js';
const taskSelect = 't.*,p.name project_name,u.name assignee_name';
const taskJoins =
  'FROM tasks t JOIN projects p ON p.id=t.project_id JOIN users u ON u.id=t.assigned_developer_id';

export async function listProjects(user: User) {
  const params: unknown[] = [];
  const scope = projectScope(user, params);
  const taskFilter =
    user.role === 'DEVELOPER' ? `AND t.assigned_developer_id=$${params.length}` : '';
  return (
    await pool.query<Project>(
      `SELECT p.*,c.name client_name,u.name owner_name,
    count(t.id)::int task_count,count(t.id) FILTER(WHERE t.status='DONE')::int done_count,
    count(t.id) FILTER(WHERE t.is_overdue)::int overdue_count
    FROM projects p JOIN clients c ON c.id=p.client_id JOIN users u ON u.id=p.created_by_id
    LEFT JOIN tasks t ON t.project_id=p.id ${taskFilter} WHERE ${scope}
    GROUP BY p.id,c.name,u.name ORDER BY p.created_at DESC`,
      params,
    )
  ).rows;
}
export async function projectById(db: Db, id: string) {
  return (
    await db.query<{ id: string; created_by_id: string }>(
      'SELECT id,created_by_id FROM projects WHERE id=$1',
      [id],
    )
  ).rows[0];
}
export async function insertProject(db: Db, user: User, v: z.infer<typeof projectSchema>) {
  return (
    await db.query(
      'INSERT INTO projects(name,description,client_id,created_by_id) VALUES($1,$2,$3,$4) RETURNING id',
      [v.name, v.description, v.client_id, user.id],
    )
  ).rows[0];
}
export async function updateProject(db: Db, id: string, v: z.infer<typeof projectSchema>) {
  await db.query('UPDATE projects SET name=$1,description=$2,client_id=$3 WHERE id=$4', [
    v.name,
    v.description,
    v.client_id,
    id,
  ]);
}
export async function deleteProject(db: Db, id: string) {
  await db.query('DELETE FROM projects WHERE id=$1', [id]);
}
export async function listClients(user: User) {
  if (user.role === 'ADMIN' || user.role === 'PROJECT_MANAGER')
    return (await pool.query<Client>('SELECT * FROM clients ORDER BY name')).rows;
  return [];
}
export async function insertClient(v: { name: string; company: string; email: string }) {
  return (
    await pool.query('INSERT INTO clients(name,company,email) VALUES($1,$2,$3) RETURNING *', [
      v.name,
      v.company,
      v.email,
    ])
  ).rows[0];
}
export async function updateClient(
  id: string,
  v: { name: string; company: string; email: string },
) {
  return (
    await pool.query('UPDATE clients SET name=$1,company=$2,email=$3 WHERE id=$4 RETURNING *', [
      v.name,
      v.company,
      v.email,
      id,
    ])
  ).rows[0];
}
export async function deleteClient(id: string) {
  return (await pool.query('DELETE FROM clients WHERE id=$1', [id])).rowCount;
}
export async function listUsers(user: User) {
  return (
    await pool.query<User>(
      `SELECT id,name,email,role,is_active FROM users ${user.role === 'ADMIN' ? '' : "WHERE role='DEVELOPER' AND is_active"} ORDER BY name`,
    )
  ).rows;
}
export async function insertUser(v: { name: string; email: string; role: string }, hash: string) {
  return (
    await pool.query<User>(
      'INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,$3,$4) RETURNING id,name,email,role,is_active',
      [v.name, v.email, v.role, hash],
    )
  ).rows[0];
}
export async function updateUser(
  db: Db,
  id: string,
  v: { name?: string; role?: string; is_active?: boolean },
) {
  return (
    await db.query<User>(
      'UPDATE users SET name=COALESCE($1,name),role=COALESCE($2,role),is_active=COALESCE($3,is_active) WHERE id=$4 RETURNING id,name,email,role,is_active',
      [v.name, v.role, v.is_active, id],
    )
  ).rows[0];
}
export async function hasResponsibilities(db: Db, id: string) {
  return (
    await db.query(
      'SELECT 1 FROM tasks WHERE assigned_developer_id=$1 UNION ALL SELECT 1 FROM projects WHERE created_by_id=$1 LIMIT 1',
      [id],
    )
  ).rowCount;
}
export async function revokeUserSessions(db: Db, id: string) {
  await db.query('UPDATE sessions SET revoked_at=now(),access_revoked_at=now() WHERE user_id=$1', [
    id,
  ]);
}
export async function developerExists(db: Db, id: string) {
  return (
    await db.query("SELECT 1 FROM users WHERE id=$1 AND role='DEVELOPER' AND is_active FOR SHARE", [
      id,
    ])
  ).rowCount;
}
export async function lockUser(db: Db, id: string) {
  return (
    await db.query<User>('SELECT id,name,email,role,is_active FROM users WHERE id=$1 FOR UPDATE', [
      id,
    ])
  ).rows[0];
}

export async function listTasks(user: User, filter: z.infer<typeof filterSchema>) {
  const params: unknown[] = [];
  const parts = [taskScope(user, params)];
  for (const [field, value] of Object.entries({
    project_id: filter.project_id,
    status: filter.status,
    priority: filter.priority,
  })) {
    if (value) {
      params.push(value);
      parts.push(`t.${field}=$${params.length}`);
    }
  }
  if (filter.from) {
    params.push(filter.from);
    parts.push(`t.due_date >= $${params.length}::date`);
  }
  if (filter.to) {
    params.push(filter.to);
    parts.push(`t.due_date < $${params.length}::date + interval '1 day'`);
  }
  const where = parts.join(' AND ');
  const count = (
    await pool.query<{ total: number }>(
      `SELECT count(*)::int total ${taskJoins} WHERE ${where}`,
      params,
    )
  ).rows[0]!.total;
  params.push((filter.page - 1) * 20);
  const rows = (
    await pool.query<Task>(
      `SELECT ${taskSelect} ${taskJoins} WHERE ${where}
    ORDER BY CASE t.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,t.due_date,t.id LIMIT 20 OFFSET $${params.length}`,
      params,
    )
  ).rows;
  return { items: rows, total: count, page: filter.page, page_size: 20 };
}
export async function scopedTask(db: Db, user: User, id: string, lock = false) {
  const params: unknown[] = [id];
  return (
    await db.query<Task & { created_by_id: string }>(
      `SELECT ${taskSelect},p.created_by_id ${taskJoins} WHERE t.id=$1 AND ${taskScope(user, params)} ${lock ? 'FOR UPDATE OF t' : ''}`,
      params,
    )
  ).rows[0];
}
export async function insertTask(db: Db, v: z.infer<typeof taskSchema>) {
  return (
    await db.query<Task>(
      'INSERT INTO tasks(project_id,title,description,assigned_developer_id,priority,due_date) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [v.project_id, v.title, v.description, v.assigned_developer_id, v.priority, v.due_date],
    )
  ).rows[0]!;
}
export async function patchTask(db: Db, id: string, v: z.infer<typeof taskPatchSchema>) {
  await db.query(
    `UPDATE tasks SET title=COALESCE($1,title),description=COALESCE($2,description),assigned_developer_id=COALESCE($3,assigned_developer_id),priority=COALESCE($4,priority),due_date=COALESCE($5,due_date),is_overdue=CASE WHEN $5::timestamptz>now() THEN false ELSE is_overdue END,version=version+1,updated_at=now() WHERE id=$6`,
    [v.title, v.description, v.assigned_developer_id, v.priority, v.due_date, id],
  );
}
export async function setStatus(db: Db, id: string, status: string) {
  await db.query(
    "UPDATE tasks SET status=$1,is_overdue=CASE WHEN $1='DONE' THEN false ELSE is_overdue END,version=version+1,updated_at=now() WHERE id=$2",
    [status, id],
  );
}
// Serialize event-producing transactions so the durable cursor follows commit order.
export async function lockActivityStream(db: Db) {
  await db.query('SELECT pg_advisory_xact_lock(74002)');
}
export async function addActivity(
  db: Db,
  userId: string,
  task: { id: string; project_id: string },
  event: string,
  oldValue: string | null,
  newValue: string | null,
) {
  return (
    await db.query<{ id: string }>(
      'INSERT INTO activities(project_id,task_id,actor_id,event_type,old_value,new_value) VALUES($1,$2,$3,$4,$5,$6) RETURNING id::text',
      [task.project_id, task.id, userId, event, oldValue, newValue],
    )
  ).rows[0]!;
}
export async function notify(db: Db, userId: string, taskId: string, message: string) {
  await db.query('INSERT INTO notifications(user_id,task_id,message) VALUES($1,$2,$3)', [
    userId,
    taskId,
    message,
  ]);
}
export async function clearOldAssignmentNotifications(db: Db, taskId: string, previousId: string) {
  await db.query('DELETE FROM notifications WHERE task_id=$1 AND user_id=$2', [taskId, previousId]);
}
export async function activityFeed(user: User, projectId?: string, after?: string) {
  const params: unknown[] = [];
  const parts = [taskScope(user, params)];
  if (projectId) {
    params.push(projectId);
    parts.push(`a.project_id=$${params.length}`);
  }
  if (after) {
    params.push(after);
    parts.push(`a.id>$${params.length}::bigint`);
  }
  const items = (
    await pool.query<Activity>(
      `SELECT a.id::text,a.task_id,a.project_id,a.event_type,a.old_value,a.new_value,a.created_at,u.name actor_name,t.title task_title,p.name project_name
    FROM activities a JOIN tasks t ON t.id=a.task_id JOIN projects p ON p.id=a.project_id JOIN users u ON u.id=a.actor_id
    WHERE ${parts.join(' AND ')} ORDER BY a.id DESC LIMIT 20`,
      params,
    )
  ).rows.reverse();
  return { items, cursor: items.at(-1)?.id ?? after ?? '0' };
}
export async function notificationList(user: User) {
  const items = (
    await pool.query<Notification>(
      'SELECT id,task_id,message,is_read,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50',
      [user.id],
    )
  ).rows;
  const unread = (
    await pool.query<{ count: number }>(
      'SELECT count(*)::int count FROM notifications WHERE user_id=$1 AND NOT is_read',
      [user.id],
    )
  ).rows[0]!.count;
  return { items, unread };
}
export async function markRead(user: User, id?: string) {
  return (
    await pool.query(
      `UPDATE notifications SET is_read=true WHERE user_id=$1 ${id ? 'AND id=$2' : ''}`,
      [user.id, ...(id ? [id] : [])],
    )
  ).rowCount;
}
export async function dashboard(user: User) {
  const params: unknown[] = [];
  const scope = taskScope(user, params);
  const aggregate = (
    await pool.query<{ total: number; overdue: number; completed: number }>(
      `SELECT count(*)::int total,count(*) FILTER(WHERE t.is_overdue)::int overdue,count(*) FILTER(WHERE t.status='DONE')::int completed ${taskJoins} WHERE ${scope}`,
      params,
    )
  ).rows[0]!;
  const by_status = (
    await pool.query(
      `SELECT t.status,count(*)::int count ${taskJoins} WHERE ${scope} GROUP BY t.status`,
      params,
    )
  ).rows;
  const by_priority = (
    await pool.query(
      `SELECT t.priority,count(*)::int count ${taskJoins} WHERE ${scope} GROUP BY t.priority`,
      params,
    )
  ).rows;
  const upcoming = (
    await pool.query<Task>(
      `SELECT ${taskSelect} ${taskJoins} WHERE ${scope} AND t.status<>'DONE' AND t.due_date>=date_trunc('week',now()) AND t.due_date<date_trunc('week',now())+interval '7 days' ORDER BY t.due_date,t.id LIMIT 6`,
      params,
    )
  ).rows;
  const projectParams: unknown[] = [];
  const projects = (
    await pool.query<{ count: number }>(
      `SELECT count(*)::int count FROM projects p WHERE ${projectScope(user, projectParams)}`,
      projectParams,
    )
  ).rows[0]!.count;
  return { ...aggregate, projects, by_status, by_priority, upcoming };
}
export async function updateOverdue() {
  return (
    await pool.query(
      "UPDATE tasks SET is_overdue=(due_date<now() AND status<>'DONE'),updated_at=now() WHERE is_overdue IS DISTINCT FROM (due_date<now() AND status<>'DONE') RETURNING id,project_id,assigned_developer_id",
    )
  ).rows;
}
