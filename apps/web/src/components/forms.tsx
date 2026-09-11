import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  labels,
  priorities,
  roles,
  projectSchema,
  taskSchema,
  userSchema,
  clientSchema,
  type Project,
  type Client,
  type User,
  type Task,
} from '@velozity/shared';
import { api, json } from '../lib/api';
import { Modal, ErrorNotice, Loading } from './ui';
const values = (form: HTMLFormElement) => Object.fromEntries(new FormData(form).entries());
export function ProjectForm({ project, onClose }: { project?: Project; onClose: () => void }) {
  const cache = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api<Client[]>('/clients') });
  const save = useMutation({
    mutationFn: (v: unknown) =>
      api(project ? `/projects/${project.id}` : '/projects', json(project ? 'PATCH' : 'POST', v)),
    onSuccess: () => {
      void cache.invalidateQueries();
      onClose();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = projectSchema.safeParse(values(e.currentTarget));
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0]?.message));
      return;
    }
    setError(null);
    save.mutate(parsed.data);
  }
  return (
    <Modal title={project ? 'Edit project' : 'Create a project'} onClose={onClose}>
      <p className="modal-intro">Give your team a clear home for the next piece of work.</p>
      <form onSubmit={submit}>
        <label>
          Project name
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            placeholder="e.g. Website redesign"
            defaultValue={project?.name}
          />
        </label>
        <label>
          Client
          <select
            aria-label="Client"
            name="client_id"
            required
            defaultValue={project?.client_id ?? ''}
          >
            <option value="" disabled>
              Select a client
            </option>
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company} · {c.name}
              </option>
            ))}
          </select>
        </label>
        {clients.error && <ErrorNotice error={clients.error} />}
        <label>
          Description
          <textarea
            name="description"
            maxLength={4000}
            rows={4}
            placeholder="What are we working toward?"
            defaultValue={project?.description}
          />
        </label>
        {(error || save.error) && <ErrorNotice error={error || save.error} />}
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={save.isPending || !clients.data?.length}>
            {save.isPending ? 'Saving…' : project ? 'Save changes' : 'Create project'}
          </button>
        </div>
        {clients.data?.length === 0 && (
          <p className="field-hint">
            An admin needs to add a client before you can create a project.
          </p>
        )}
      </form>
    </Modal>
  );
}
export function TaskForm({
  task,
  projectId,
  onClose,
}: {
  task?: Task;
  projectId?: string;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/projects') });
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<User[]>('/users') });
  const save = useMutation({
    mutationFn: (v: unknown) =>
      api(task ? `/tasks/${task.id}` : '/tasks', json(task ? 'PATCH' : 'POST', v)),
    onSuccess: () => {
      void cache.invalidateQueries();
      onClose();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = values(e.currentTarget);
    const date = new Date(`${raw.due_date}T17:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      setError(new Error('Choose a valid due date.'));
      return;
    }
    const parsed = taskSchema.safeParse({
      ...raw,
      project_id: task?.project_id ?? raw.project_id,
      due_date: date.toISOString(),
    });
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0]?.message));
      return;
    }
    setError(null);
    const { project_id, ...patch } = parsed.data;
    save.mutate(task ? patch : parsed.data);
  }
  return (
    <Modal title={task ? 'Edit task' : 'Create a task'} onClose={onClose}>
      <p className="modal-intro">Make the next step clear, with an owner and a due date.</p>
      {projects.isPending || users.isPending ? (
        <Loading />
      ) : projects.error || users.error ? (
        <ErrorNotice error={projects.error || users.error} />
      ) : (
        <form onSubmit={submit}>
          <label>
            Title
            <input
              name="title"
              required
              minLength={2}
              maxLength={120}
              defaultValue={task?.title}
              placeholder="What needs to happen?"
            />
          </label>
          {!task && (
            <label>
              Project
              <select
                aria-label="Project"
                name="project_id"
                defaultValue={projectId ?? ''}
                required
              >
                <option value="" disabled>
                  Select a project
                </option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Description
            <textarea
              name="description"
              rows={3}
              maxLength={4000}
              defaultValue={task?.description}
              placeholder="Add context and acceptance criteria"
            />
          </label>
          <label>
            Assigned developer
            <select
              aria-label="Assigned developer"
              name="assigned_developer_id"
              required
              defaultValue={task?.assigned_developer_id ?? ''}
            >
              <option value="" disabled>
                Select a developer
              </option>
              {users.data
                ?.filter((u) => u.role === 'DEVELOPER' && u.is_active)
                .map((u) => (
                  <option value={u.id} key={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Priority
              <select
                aria-label="Priority"
                name="priority"
                defaultValue={task?.priority ?? 'MEDIUM'}
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {labels[p]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Due date (UTC)
              <input
                name="due_date"
                type="date"
                required
                defaultValue={task?.due_date.slice(0, 10)}
              />
            </label>
          </div>
          {(error || save.error) && <ErrorNotice error={error || save.error} />}
          <div className="form-actions">
            <button className="button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : task ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
export function ClientForm({ client, onClose }: { client?: Client; onClose: () => void }) {
  const cache = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const save = useMutation({
    mutationFn: (v: unknown) =>
      api(client ? `/clients/${client.id}` : '/clients', json(client ? 'PATCH' : 'POST', v)),
    onSuccess: () => {
      void cache.invalidateQueries();
      onClose();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = clientSchema.safeParse(values(e.currentTarget));
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0]?.message));
      return;
    }
    setError(null);
    save.mutate(parsed.data);
  }
  return (
    <Modal title={client ? 'Edit client' : 'Add a client'} onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Contact name
          <input name="name" required minLength={2} maxLength={120} defaultValue={client?.name} />
        </label>
        <label>
          Company
          <input
            name="company"
            required
            minLength={2}
            maxLength={120}
            defaultValue={client?.company}
          />
        </label>
        <label>
          Email
          <input name="email" type="email" required defaultValue={client?.email} />
        </label>
        {(error || save.error) && <ErrorNotice error={error || save.error} />}
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save client'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function UserForm({ user, onClose }: { user?: User; onClose: () => void }) {
  const cache = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const save = useMutation({
    mutationFn: (v: unknown) =>
      api(user ? `/users/${user.id}` : '/users', json(user ? 'PATCH' : 'POST', v)),
    onSuccess: () => {
      void cache.invalidateQueries();
      onClose();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = values(e.currentTarget);
    if (user) {
      save.mutate({ name: raw.name, role: raw.role });
      return;
    }
    const parsed = userSchema.safeParse(raw);
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0]?.message));
      return;
    }
    setError(null);
    save.mutate(parsed.data);
  }
  return (
    <Modal title={user ? 'Edit team member' : 'Add a team member'} onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Full name
          <input name="name" required minLength={2} maxLength={120} defaultValue={user?.name} />
        </label>
        {!user && (
          <>
            <label>
              Email
              <input name="email" type="email" required autoComplete="off" />
            </label>
            <label>
              Initial password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
              <span className="field-hint">
                At least 12 characters. Share securely with the team member.
              </span>
            </label>
          </>
        )}
        <label>
          Role
          <select aria-label="Role" name="role" defaultValue={user?.role ?? 'DEVELOPER'}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {labels[role]}
              </option>
            ))}
          </select>
        </label>
        {(error || save.error) && <ErrorNotice error={error || save.error} />}
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save member'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
