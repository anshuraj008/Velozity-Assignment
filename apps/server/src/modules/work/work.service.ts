import type { z } from 'zod';
import type {
  User,
  projectSchema,
  taskSchema,
  taskPatchSchema,
  statusSchema,
  userPatchSchema,
} from '@velozity/shared';
import { pool, transaction } from '../../db/pool.js';
import { AppError, notFound } from '../../lib/errors.js';
import { canManageProject } from './policy.js';
import * as repo from './work.repository.js';

export async function saveProject(user: User, input: z.infer<typeof projectSchema>, id?: string) {
  return transaction(async (db) => {
    if (!id) {
      canManageProject(user, user.id);
      return repo.insertProject(db, user, input);
    }
    const project = await repo.projectById(db, id);
    if (!project) throw notFound();
    canManageProject(user, project.created_by_id);
    await repo.updateProject(db, id, input);
    return { id };
  });
}
export async function removeProject(user: User, id: string) {
  await transaction(async (db) => {
    const project = await repo.projectById(db, id);
    if (!project) throw notFound();
    canManageProject(user, project.created_by_id);
    await repo.deleteProject(db, id);
  });
}
export async function createTask(user: User, input: z.infer<typeof taskSchema>) {
  return transaction(async (db) => {
    await repo.lockActivityStream(db);
    const project = await repo.projectById(db, input.project_id);
    if (!project) throw notFound();
    canManageProject(user, project.created_by_id);
    if (!(await repo.developerExists(db, input.assigned_developer_id)))
      throw new AppError(400, 'INVALID_ASSIGNEE', 'Choose an active developer.');
    const task = await repo.insertTask(db, input);
    await repo.addActivity(db, user.id, task, 'TASK_ASSIGNED', null, input.assigned_developer_id);
    await repo.notify(
      db,
      input.assigned_developer_id,
      task.id,
      `You were assigned “${task.title}”.`,
    );
    return task;
  });
}
export async function editTask(user: User, id: string, input: z.infer<typeof taskPatchSchema>) {
  return transaction(async (db) => {
    await repo.lockActivityStream(db);
    const task = await repo.scopedTask(db, user, id, true);
    if (!task) throw notFound();
    canManageProject(user, task.created_by_id);
    if (
      input.assigned_developer_id &&
      !(await repo.developerExists(db, input.assigned_developer_id))
    )
      throw new AppError(400, 'INVALID_ASSIGNEE', 'Choose an active developer.');
    await repo.patchTask(db, id, input);
    const reassigned =
      input.assigned_developer_id && input.assigned_developer_id !== task.assigned_developer_id;
    await repo.addActivity(
      db,
      user.id,
      task,
      reassigned ? 'TASK_ASSIGNED' : 'TASK_UPDATED',
      reassigned ? task.assigned_developer_id : null,
      reassigned ? input.assigned_developer_id! : null,
    );
    if (reassigned) {
      await repo.clearOldAssignmentNotifications(db, id, task.assigned_developer_id);
      await repo.notify(
        db,
        input.assigned_developer_id!,
        id,
        `You were assigned “${input.title ?? task.title}”.`,
      );
    }
    return repo.scopedTask(db, user, id);
  });
}
export async function changeStatus(user: User, id: string, input: z.infer<typeof statusSchema>) {
  return transaction(async (db) => {
    await repo.lockActivityStream(db);
    const task = await repo.scopedTask(db, user, id, true);
    if (!task) throw notFound();
    if (task.version !== input.version)
      throw new AppError(409, 'STALE_TASK', 'This task changed. Refresh it before updating.');
    if (task.status === input.status) return task;
    await repo.setStatus(db, id, input.status);
    await repo.addActivity(db, user.id, task, 'TASK_STATUS_CHANGED', task.status, input.status);
    if (input.status === 'IN_REVIEW')
      await repo.notify(db, task.created_by_id, id, `“${task.title}” is ready for review.`);
    return repo.scopedTask(db, user, id);
  });
}
export async function readTask(user: User, id: string) {
  const task = await repo.scopedTask(pool, user, id);
  if (!task) throw notFound();
  return task;
}
export async function editUser(actor: User, id: string, input: z.infer<typeof userPatchSchema>) {
  return transaction(async (db) => {
    const existing = await repo.lockUser(db, id);
    if (!existing) throw notFound();
    if (id === actor.id && (input.is_active === false || (input.role && input.role !== actor.role)))
      throw new AppError(
        409,
        'SELF_CHANGE',
        'You cannot deactivate yourself or change your own role.',
      );
    if (input.role && input.role !== existing.role && (await repo.hasResponsibilities(db, id)))
      throw new AppError(
        409,
        'USER_IN_USE',
        'Reassign this user’s projects and tasks before changing their role.',
      );
    const result = await repo.updateUser(db, id, input);
    if (input.role || input.is_active === false) await repo.revokeUserSessions(db, id);
    return result;
  });
}
