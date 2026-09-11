import type { User } from '@velozity/shared';
import { AppError, notFound } from '../../lib/errors.js';

export function taskScope(user: User, params: unknown[], task = 't', project = 'p') {
  if (user.role === 'ADMIN') return 'TRUE';
  params.push(user.id);
  return user.role === 'PROJECT_MANAGER'
    ? `${project}.created_by_id=$${params.length}`
    : `${task}.assigned_developer_id=$${params.length}`;
}
export function projectScope(user: User, params: unknown[]) {
  if (user.role === 'ADMIN') return 'TRUE';
  params.push(user.id);
  return user.role === 'PROJECT_MANAGER'
    ? `p.created_by_id=$${params.length}`
    : `EXISTS(SELECT 1 FROM tasks scoped_task WHERE scoped_task.project_id=p.id AND scoped_task.assigned_developer_id=$${params.length})`;
}
export function canManageProject(user: User, ownerId: string) {
  if (user.role === 'DEVELOPER')
    throw new AppError(403, 'FORBIDDEN', 'Only project managers and admins can manage projects.');
  if (user.role !== 'ADMIN' && ownerId !== user.id) throw notFound();
}
