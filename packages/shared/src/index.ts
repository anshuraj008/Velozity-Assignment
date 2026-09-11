import { z } from 'zod';

export const roles = ['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER'] as const;
export const statuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Role = (typeof roles)[number];
export type Status = (typeof statuses)[number];
export type Priority = (typeof priorities)[number];
export const labels: Record<Role | Status | Priority, string> = {
  ADMIN: 'Admin',
  PROJECT_MANAGER: 'Project manager',
  DEVELOPER: 'Developer',
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};
export const idSchema = z.uuid();
const name = z.string().trim().min(2).max(120);
const description = z.string().trim().max(4000).default('');
const email = z.email().trim().toLowerCase().max(254);
export const passwordSchema = z.string().min(12).max(128);
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const userSchema = z
  .object({ name, email, role: z.enum(roles), password: passwordSchema })
  .strict();
export const userPatchSchema = z
  .object({
    name: name.optional(),
    role: z.enum(roles).optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field');
export const clientSchema = z.object({ name, company: name, email }).strict();
export const projectSchema = z.object({ name, description, client_id: idSchema }).strict();
export const taskSchema = z
  .object({
    project_id: idSchema,
    title: name,
    description,
    assigned_developer_id: idSchema,
    priority: z.enum(priorities),
    due_date: z.iso.datetime({ offset: true }),
  })
  .strict();
export const taskPatchSchema = taskSchema
  .omit({ project_id: true })
  .extend({ description: z.string().trim().max(4000) })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field');
export const statusSchema = z
  .object({ status: z.enum(statuses), version: z.number().int().positive() })
  .strict();
export const filterSchema = z
  .object({
    project_id: idSchema.optional(),
    status: z.enum(statuses).optional(),
    priority: z.enum(priorities).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, 'Start date must be before end date');
export const activityQuerySchema = z
  .object({
    project_id: idSchema.optional(),
    task_id: idSchema.optional(),
    after: z
      .string()
      .regex(/^\d{1,19}$/)
      .refine((v) => BigInt(v) <= 9223372036854775807n)
      .optional(),
  })
  .strict();
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
}
export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
}
export interface Project {
  id: string;
  name: string;
  description: string;
  client_id: string;
  client_name: string;
  created_by_id: string;
  owner_name: string;
  task_count: number;
  done_count: number;
  overdue_count: number;
}
export interface Task {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  assigned_developer_id: string;
  assignee_name: string;
  status: Status;
  priority: Priority;
  due_date: string;
  is_overdue: boolean;
  version: number;
}
export interface Activity {
  id: string;
  task_id: string;
  project_id: string;
  project_name: string;
  task_title: string;
  actor_name: string;
  event_type: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}
export interface Notification {
  id: string;
  task_id: string | null;
  message: string;
  task_title?: string;
  project_name?: string;
  actor_name?: string;
  old_value?: string | null;
  new_value?: string | null;
  is_read: boolean;
  created_at: string;
}
export interface ActivityPage {
  items: Activity[];
  cursor: string;
}
export interface TaskPage {
  items: Task[];
  total: number;
  page: number;
  page_size: number;
}
export interface Dashboard {
  projects: number;
  total: number;
  overdue: number;
  completed: number;
  by_status: { status: Status; count: number }[];
  by_priority: { priority: Priority; count: number }[];
  upcoming: Task[];
}
