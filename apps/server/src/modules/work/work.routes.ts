import { Router } from 'express';
import {
  idSchema,
  projectSchema,
  taskSchema,
  taskPatchSchema,
  statusSchema,
  filterSchema,
  activityQuerySchema,
  clientSchema,
  userSchema,
  userPatchSchema,
} from '@velozity/shared';
import { authenticate, roles } from '../../middleware/http.js';
import { notFound } from '../../lib/errors.js';
import { hashPassword } from '../../lib/password.js';
import type { Realtime } from '../../realtime/gateway.js';
import * as repo from './work.repository.js';
import * as service from './work.service.js';

export function workRouter(realtime: Realtime) {
  const router = Router();
  const managers = roles('ADMIN', 'PROJECT_MANAGER');
  const admin = roles('ADMIN');
  router.use(authenticate);
  router.get('/projects', async (req, res) => res.json(await repo.listProjects(req.user)));
  router.get('/projects/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const project = (await repo.listProjects(req.user)).find((p) => p.id === id);
    if (!project) throw notFound();
    res.json(project);
  });
  router.post('/projects', managers, async (req, res) => {
    const result = await service.saveProject(req.user, projectSchema.parse(req.body));
    await realtime.sync(['projects', 'dashboard']);
    res.status(201).json(result);
  });
  router.patch('/projects/:id', managers, async (req, res) => {
    const result = await service.saveProject(
      req.user,
      projectSchema.parse(req.body),
      idSchema.parse(req.params.id),
    );
    await realtime.sync(['projects', 'tasks', 'dashboard']);
    res.json(result);
  });
  router.delete('/projects/:id', managers, async (req, res) => {
    await service.removeProject(req.user, idSchema.parse(req.params.id));
    await realtime.sync(['projects', 'tasks', 'dashboard', 'activity', 'notifications']);
    res.status(204).end();
  });
  router.get('/tasks', async (req, res) =>
    res.json(await repo.listTasks(req.user, filterSchema.parse(req.query))),
  );
  router.get('/tasks/:id', async (req, res) =>
    res.json(await service.readTask(req.user, idSchema.parse(req.params.id))),
  );
  router.post('/tasks', managers, async (req, res) => {
    const task = await service.createTask(req.user, taskSchema.parse(req.body));
    await realtime.sync(['tasks', 'projects', 'dashboard', 'activity', 'notifications'], task.id);
    res.status(201).json(task);
  });
  router.patch('/tasks/:id/status', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const task = await service.changeStatus(req.user, id, statusSchema.parse(req.body));
    await realtime.sync(['tasks', 'projects', 'dashboard', 'activity', 'notifications'], id);
    res.json(task);
  });
  router.patch('/tasks/:id', managers, async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const previous = await service.readTask(req.user, id);
    const task = await service.editTask(req.user, id, taskPatchSchema.parse(req.body));
    await realtime.sync(['tasks', 'projects', 'dashboard', 'activity', 'notifications'], id);
    await realtime.sync(
      ['tasks', 'projects', 'dashboard', 'activity', 'notifications'],
      undefined,
      previous.assigned_developer_id,
    );
    res.json(task);
  });
  router.get(['/activities', '/activities/catchup'], async (req, res) => {
    const q = activityQuerySchema.parse(req.query);
    res.json(await repo.activityFeed(req.user, q.project_id, q.after));
  });
  router.get('/notifications', async (req, res) => res.json(await repo.notificationList(req.user)));
  router.patch('/notifications/read-all', async (req, res) => {
    await repo.markRead(req.user);
    await realtime.sync(['notifications'], undefined, req.user.id);
    res.status(204).end();
  });
  router.patch('/notifications/:id/read', async (req, res) => {
    if (!(await repo.markRead(req.user, idSchema.parse(req.params.id)))) throw notFound();
    await realtime.sync(['notifications'], undefined, req.user.id);
    res.status(204).end();
  });
  router.get('/dashboard', async (req, res) => res.json(await repo.dashboard(req.user)));
  router.get('/clients', managers, async (req, res) => res.json(await repo.listClients(req.user)));
  router.post('/clients', admin, async (req, res) => {
    const result = await repo.insertClient(clientSchema.parse(req.body));
    await realtime.sync(['clients']);
    res.status(201).json(result);
  });
  router.patch('/clients/:id', admin, async (req, res) => {
    const result = await repo.updateClient(
      idSchema.parse(req.params.id),
      clientSchema.parse(req.body),
    );
    if (!result) throw notFound();
    await realtime.sync(['clients', 'projects']);
    res.json(result);
  });
  router.delete('/clients/:id', admin, async (req, res) => {
    if (!(await repo.deleteClient(idSchema.parse(req.params.id)))) throw notFound();
    await realtime.sync(['clients']);
    res.status(204).end();
  });
  router.get('/users', managers, async (req, res) => res.json(await repo.listUsers(req.user)));
  router.post('/users', admin, async (req, res) => {
    const v = userSchema.parse(req.body);
    const user = await repo.insertUser(v, await hashPassword(v.password));
    await realtime.sync(['users']);
    res.status(201).json(user);
  });
  router.patch('/users/:id', admin, async (req, res) => {
    const user = await service.editUser(
      req.user,
      idSchema.parse(req.params.id),
      userPatchSchema.parse(req.body),
    );
    await realtime.sync(['users', 'tasks', 'projects', 'activity']);
    res.json(user);
  });
  router.delete('/users/:id', admin, async (req, res) => {
    await service.editUser(req.user, idSchema.parse(req.params.id), { is_active: false });
    await realtime.sync(['users']);
    res.status(204).end();
  });
  return router;
}
