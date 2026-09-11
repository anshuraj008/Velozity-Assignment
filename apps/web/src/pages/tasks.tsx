import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Pencil,
} from 'lucide-react';
import {
  labels,
  statuses,
  priorities,
  type Task,
  type TaskPage,
  type Project,
  type Status,
} from '@velozity/shared';
import { api, json } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Avatar, Badge, Empty, ErrorNotice, Loading, Modal, formatDate } from '../components/ui';
import { TaskForm } from '../components/forms';

export function TaskDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['tasks', 'detail', id],
    queryFn: () => api<Task>(`/tasks/${id}`),
  });
  const cache = useQueryClient();
  const { user } = useAuth();
  const [edit, setEdit] = useState(false);
  const update = useMutation({
    mutationFn: (status: Status) =>
      api(`/tasks/${id}/status`, json('PATCH', { status, version: query.data?.version })),
    onSuccess: () => cache.invalidateQueries(),
    onError: () => cache.invalidateQueries({ queryKey: ['tasks'] }),
  });
  if (edit && query.data) return <TaskForm task={query.data} onClose={() => setEdit(false)} />;
  return (
    <Modal title="Task details" onClose={onClose} wide>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorNotice error={query.error} />
      ) : (
        <>
          <div className="task-detail-heading">
            <span className="eyebrow">{query.data.project_name}</span>
            <h2>{query.data.title}</h2>
            <div className="task-detail-badges">
              <Badge value={query.data.priority} />
              {query.data.is_overdue && <span className="overdue-text">Overdue</span>}
            </div>
          </div>
          <p className="task-description">
            {query.data.description || 'No description added yet.'}
          </p>
          <div className="detail-metadata">
            <div>
              <span>Assigned to</span>
              <strong>
                <Avatar name={query.data.assignee_name} small />
                {query.data.assignee_name}
              </strong>
            </div>
            <div>
              <span>Due date</span>
              <strong>
                <CalendarDays size={16} />
                {formatDate(query.data.due_date)} (UTC)
              </strong>
            </div>
          </div>
          <label>
            Status
            <select
              aria-label="Status"
              value={query.data.status}
              disabled={update.isPending}
              onChange={(e) => update.mutate(e.target.value as Status)}
            >
              {statuses.map((s) => (
                <option value={s} key={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
          </label>
          {update.error && <ErrorNotice error={update.error} />}
          <div className="form-actions">
            {user?.role !== 'DEVELOPER' && (
              <button className="button" onClick={() => setEdit(true)}>
                <Pencil size={15} />
                Edit task
              </button>
            )}
            <button className="button primary" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
export function TaskList({
  projectId,
  embedded = false,
}: {
  projectId?: string;
  embedded?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const filter = new URLSearchParams();
  for (const key of ['status', 'priority', 'from', 'to', 'page']) {
    const value = params.get(key);
    if (value) filter.set(key, value);
  }
  if (projectId) filter.set('project_id', projectId);
  else if (params.get('project_id')) filter.set('project_id', params.get('project_id')!);
  const query = useQuery({
    queryKey: ['tasks', 'list', filter.toString()],
    queryFn: () => api<TaskPage>(`/tasks?${filter}`),
  });
  const projects = useQuery({
    queryKey: ['projects'],
    queryFn: () => api<Project[]>('/projects'),
    enabled: !embedded,
  });
  function setFilter(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  }
  const selected = params.get('task');
  const tasks =
    query.data?.items.filter((t) => t.title.toLowerCase().includes(search.toLowerCase())) ?? [];
  return (
    <>
      {!embedded && (
        <div className="page-heading">
          <div>
            <span className="eyebrow">THE NEXT STEP STARTS HERE</span>
            <h1>{user?.role === 'DEVELOPER' ? 'My tasks' : 'Tasks'}</h1>
            <p>A little clarity for everything on your list.</p>
          </div>
          {user?.role !== 'DEVELOPER' && (
            <button className="button primary" onClick={() => setCreating(true)}>
              <Plus size={17} />
              Create task
            </button>
          )}
        </div>
      )}
      <section className="panel tasks-panel">
        {embedded && (
          <div className="section-heading">
            <h2>Project tasks</h2>
            {user?.role !== 'DEVELOPER' && (
              <button className="button primary small-button" onClick={() => setCreating(true)}>
                <Plus size={15} />
                Add task
              </button>
            )}
          </div>
        )}
        <div className="task-toolbar">
          <div className="filter-title">
            <SlidersHorizontal size={16} />
            <span>Filters</span>
          </div>
          <label className="sr-only" htmlFor="task-status">
            Filter by status
          </label>
          <select
            id="task-status"
            value={params.get('status') ?? ''}
            onChange={(e) => setFilter('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="task-priority">
            Filter by priority
          </label>
          <select
            id="task-priority"
            value={params.get('priority') ?? ''}
            onChange={(e) => setFilter('priority', e.target.value)}
          >
            <option value="">All priorities</option>
            {priorities.map((p) => (
              <option key={p} value={p}>
                {labels[p]}
              </option>
            ))}
          </select>
          {!embedded && (
            <select
              aria-label="Filter by project"
              value={params.get('project_id') ?? ''}
              onChange={(e) => setFilter('project_id', e.target.value)}
            >
              <option value="">All projects</option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <div className="date-filters">
            <input
              aria-label="Due date from"
              title="Due date from (UTC)"
              type="date"
              value={params.get('from') ?? ''}
              onChange={(e) => setFilter('from', e.target.value)}
            />
            <span>–</span>
            <input
              aria-label="Due date to"
              title="Due date to (UTC)"
              type="date"
              value={params.get('to') ?? ''}
              onChange={(e) => setFilter('to', e.target.value)}
            />
          </div>
          <button
            className="text-button"
            onClick={() => {
              setParams({});
              setSearch('');
            }}
          >
            Reset
          </button>
        </div>
        <div className="table-caption">
          <span>
            {query.data?.total ?? 0} tasks <span className="muted">· Priority, then due date</span>
          </span>
          <input
            className="table-search"
            aria-label="Search this page of tasks"
            placeholder="Find a task on this page…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorNotice error={query.error} retry={() => void query.refetch()} />
        ) : !tasks.length ? (
          <Empty
            title="Nothing on this list yet"
            description="Try another filter, or create a task to get things moving."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Due date</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <button
                        className="task-title-button"
                        onClick={() => setFilter('task', task.id)}
                      >
                        {task.title}
                      </button>
                      <span className="table-subtitle">{task.project_name}</span>
                    </td>
                    <td>
                      <Badge value={task.status} />
                    </td>
                    <td>
                      <Badge value={task.priority} />
                    </td>
                    <td>
                      <span className="assignee-cell">
                        <Avatar name={task.assignee_name} small />
                        <span>{task.assignee_name.split(' ')[0]}</span>
                      </span>
                    </td>
                    <td>
                      <span className={task.is_overdue ? 'overdue-text' : ''}>
                        {formatDate(task.due_date)}
                      </span>
                      {task.is_overdue && (
                        <span className="table-subtitle overdue-text">Overdue</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Open ${task.title}`}
                        onClick={() => setFilter('task', task.id)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {query.data && (
          <div className="pagination">
            <span>
              Page {query.data.page} of {Math.max(1, Math.ceil(query.data.total / 20))}
            </span>
            <div>
              <button
                className="button small-button"
                disabled={query.data.page <= 1}
                onClick={() => setFilter('page', String(query.data.page - 1))}
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                className="button small-button"
                disabled={query.data.page * 20 >= query.data.total}
                onClick={() => setFilter('page', String(query.data.page + 1))}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </section>
      {creating && <TaskForm projectId={projectId} onClose={() => setCreating(false)} />}{' '}
      {selected && <TaskDetails id={selected} onClose={() => setFilter('task', '')} />}
    </>
  );
}
