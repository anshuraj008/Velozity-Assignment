import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  ArrowLeft,
  Pencil,
  Trash2,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Users,
} from 'lucide-react';
import type { Project, TaskPage } from '@velozity/shared';
import { api, json } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ProjectCard } from './dashboard';
import { TaskList } from './tasks';
import { ActivityFeed } from '../components/activity';
import { ProjectForm } from '../components/forms';
import { Empty, ErrorNotice, Loading, Modal } from '../components/ui';
export function Projects() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/projects') });
  const items =
    query.data?.filter((p) =>
      `${p.name} ${p.client_name}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FROM BRIEF TO DELIVERY</span>
          <h1>Projects</h1>
          <p>A home for every idea your team is bringing to life.</p>
        </div>
        {user?.role !== 'DEVELOPER' && (
          <button className="button primary" onClick={() => setParams({ new: '1' })}>
            <Plus size={17} />
            Create project
          </button>
        )}
      </div>
      <div className="page-toolbar">
        <span>{query.data?.length ?? 0} projects in your workspace</span>
        <input
          aria-label="Search projects"
          placeholder="Find a project or client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorNotice error={query.error} />
      ) : items.length ? (
        <div className="all-projects-grid">
          {items.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </div>
      ) : (
        <Empty
          title="Room for your next big idea"
          description="Create a project or try another search."
        />
      )}
      {params.get('new') && user?.role !== 'DEVELOPER' && (
        <ProjectForm onClose={() => setParams({})} />
      )}
    </>
  );
}
export function ProjectDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const cache = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<'overview' | 'tasks' | 'activity'>('overview');
  const query = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api<Project>(`/projects/${id}`),
  });
  const tasks = useQuery({
    queryKey: ['tasks', 'project-overview', id],
    queryFn: () => api<TaskPage>(`/tasks?project_id=${id}`),
    enabled: Boolean(id),
  });
  const remove = useMutation({
    mutationFn: () => api(`/projects/${id}`, json('DELETE')),
    onSuccess: () => {
      void cache.invalidateQueries();
    },
  });
  if (remove.isSuccess)
    return (
      <Empty
        title="Project deleted"
        description="The project and its tasks have been removed."
        action={
          <Link className="button" to="/projects">
            Back to projects
          </Link>
        }
      />
    );
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} />;
  const project = query.data;
  const projectTasks = tasks.data?.items ?? [];
  const team = [
    ...new Map(
      projectTasks.map((task) => [task.assigned_developer_id, task.assignee_name]),
    ).entries(),
  ];
  const upcoming = projectTasks.filter((task) => task.status !== 'DONE').slice(0, 3);
  const nextDue = upcoming[0]?.due_date;
  const completion = project.task_count
    ? Math.round((project.done_count / project.task_count) * 100)
    : 0;
  return (
    <>
      <Link className="back-link" to="/projects">
        <ArrowLeft size={15} />
        Projects
      </Link>
      <div className="project-detail-heading">
        <div>
          <span className="eyebrow">
            <Building2 size={13} />
            {project.client_name}
          </span>
          <h1>{project.name}</h1>
          <p>
            {project.owner_name} / {project.client_name}
          </p>
        </div>
        <div className="project-detail-actions">
          <span className={`project-health ${project.overdue_count ? 'attention' : ''}`}>
            <span />
            {project.overdue_count ? 'Needs attention' : 'On track'}
          </span>
          {user?.role !== 'DEVELOPER' && (
            <div className="inline-actions">
              <button className="button" onClick={() => setEdit(true)}>
                <Pencil size={15} />
                Edit project
              </button>
              <button
                className="icon-button danger"
                aria-label="Delete project"
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={17} />
              </button>
            </div>
          )}
        </div>
      </div>
      <nav className="project-tabs" aria-label="Project views">
        {(['overview', 'tasks', 'activity'] as const).map((value) => (
          <button
            className={tab === value ? 'active' : ''}
            key={value}
            onClick={() => setTab(value)}
          >
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </button>
        ))}
      </nav>
      {tab === 'overview' && (
        <div className="project-overview">
          <section className="project-summary-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PROJECT SUMMARY</span>
                <h2>{project.description || 'A clear view of the work in motion.'}</h2>
              </div>
              {nextDue && (
                <span className="project-due">
                  <CalendarDays size={15} />
                  Due{' '}
                  {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
                    new Date(nextDue),
                  )}
                </span>
              )}
            </div>
            <div className="project-detail-progress">
              <div>
                <span>{completion}% complete</span>
                <strong>
                  {project.done_count}/{project.task_count} tasks
                </strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${completion}%` }} />
              </div>
            </div>
            <div className="project-summary-grid">
              <div>
                <strong>{project.task_count}</strong>
                <span>Tasks</span>
              </div>
              <div>
                <strong>{project.done_count}</strong>
                <span>Completed</span>
              </div>
              <div>
                <strong>{team.length}</strong>
                <span>Developers</span>
              </div>
              <div>
                <strong>{project.overdue_count}</strong>
                <span>Overdue</span>
              </div>
            </div>
          </section>
          <div className="project-overview-columns">
            <section className="panel project-overview-panel">
              <div className="section-heading">
                <h2>
                  <Users size={17} /> Team
                </h2>
              </div>
              {team.length ? (
                <div className="project-team-list">
                  {team.map(([developerId, name]) => (
                    <span className="project-team-member" key={developerId} title={name}>
                      <span className="project-team-avatar">
                        {name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)}
                      </span>
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="project-empty-note">No developers assigned yet.</p>
              )}
            </section>
            <section className="panel project-overview-panel">
              <div className="section-heading">
                <h2>
                  <Clock3 size={17} /> Upcoming tasks
                </h2>
                <button className="text-button" onClick={() => setTab('tasks')}>
                  View all
                </button>
              </div>
              {upcoming.length ? (
                <div className="project-upcoming-list">
                  {upcoming.map((task) => (
                    <button
                      className="project-upcoming-task"
                      key={task.id}
                      onClick={() => setTab('tasks')}
                    >
                      <span>
                        <strong>{task.title}</strong>
                        <small>{task.assignee_name}</small>
                      </span>
                      <time>
                        {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
                          new Date(task.due_date),
                        )}
                      </time>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="project-empty-note">
                  <CheckCircle2 size={16} /> No open tasks due.
                </p>
              )}
            </section>
          </div>
          <section className="panel project-activity project-recent-activity">
            <div className="section-heading">
              <h2>Recent activity</h2>
              <button className="text-button" onClick={() => setTab('activity')}>
                View all
              </button>
            </div>
            <ActivityFeed projectId={id} compact />
          </section>
        </div>
      )}
      {tab === 'tasks' && <TaskList projectId={id} embedded />}
      {tab === 'activity' && (
        <section className="panel project-activity">
          <div className="section-heading">
            <h2>Project activity</h2>
          </div>
          <ActivityFeed projectId={id} />
        </section>
      )}
      {edit && <ProjectForm project={project} onClose={() => setEdit(false)} />}{' '}
      {deleting && (
        <Modal title="Delete this project?" onClose={() => setDeleting(false)}>
          <p className="modal-intro">
            This removes “{project.name}”, its tasks, activity, and related notifications. This
            cannot be undone.
          </p>
          {remove.error && <ErrorNotice error={remove.error} />}
          <div className="form-actions">
            <button className="button" onClick={() => setDeleting(false)}>
              Keep project
            </button>
            <button
              className="button destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? 'Deleting…' : 'Delete project'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
