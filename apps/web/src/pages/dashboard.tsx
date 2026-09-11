import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  ListTodo,
  CheckCircle2,
  Clock3,
  ArrowUpRight,
  ArrowRight,
  Plus,
  CalendarDays,
  Users,
} from 'lucide-react';
import { labels, statuses, type Dashboard as DashboardData, type Project } from '@velozity/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLive } from '../lib/live';
import { ActivityFeed } from '../components/activity';
import { Badge, Empty, ErrorNotice, Loading, formatDate } from '../components/ui';
export function ProjectCard({ project, index = 0 }: { project: Project; index?: number }) {
  const percent = project.task_count
    ? Math.round((project.done_count / project.task_count) * 100)
    : 0;
  return (
    <Link className="project-card" to={`/projects/${project.id}`}>
      <div className="project-card-top">
        <span className={`project-monogram tone-${index % 3}`}>
          {project.name
            .split(' ')
            .map((p) => p[0])
            .slice(0, 2)
            .join('')}
        </span>
        <ArrowUpRight size={17} />
      </div>
      <span className="project-client">{project.client_name}</span>
      <h3>{project.name}</h3>
      <p>{project.description || 'A new project, ready for your team.'}</p>
      <div className="project-progress-label">
        <span>Progress</span>
        <strong>{percent}%</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="project-card-footer">
        <span>
          <ListTodo size={14} />
          {project.done_count}/{project.task_count} tasks
        </span>
        <span className={project.overdue_count ? 'overdue-text' : ''}>
          {project.overdue_count ? `${project.overdue_count} overdue` : 'On track'}
        </span>
      </div>
    </Link>
  );
}
export function Dashboard() {
  const { user } = useAuth();
  const live = useLive();
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/dashboard'),
  });
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/projects') });
  const today = new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const stats = [
    {
      label: 'Projects',
      value: data.projects,
      icon: FolderKanban,
      foot: 'Within your workspace',
      tone: 'violet',
    },
    {
      label: 'Total tasks',
      value: data.total,
      icon: ListTodo,
      foot: 'Across your projects',
      tone: 'blue',
    },
    {
      label: 'Completed',
      value: data.completed,
      icon: CheckCircle2,
      foot: `${data.total ? Math.round((data.completed / data.total) * 100) : 0}% of all tasks`,
      tone: 'green',
    },
    {
      label: 'Overdue',
      value: data.overdue,
      icon: Clock3,
      foot: data.overdue ? 'A little attention needed' : 'Everything is on schedule',
      tone: 'amber',
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LET’S MAKE PROGRESS</span>
          <h1>
            Welcome back, {user?.name.split(' ')[0]} <span className="wave">✳</span>
          </h1>
          <p>Here’s what’s happening with your team today.</p>
        </div>
        <span className="date-pill">
          <CalendarDays size={15} />
          {today}
        </span>
      </div>
      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon, foot, tone }) => (
          <article className="stat-card" key={label}>
            <div>
              <span>{label}</span>
              <span className={`stat-icon ${tone}`}>
                <Icon size={18} />
              </span>
            </div>
            <strong>{value.toString().padStart(2, '0')}</strong>
            <p>{foot}</p>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <section>
            <div className="section-heading">
              <div>
                <h2>
                  Your projects <span className="count-pill">{data.projects}</span>
                </h2>
                <p>A shared view of the work in motion.</p>
              </div>
              <Link className="text-button" to="/projects">
                View all projects
                <ArrowRight size={14} />
              </Link>
            </div>
            {projects.isPending ? (
              <Loading />
            ) : projects.error ? (
              <ErrorNotice error={projects.error} />
            ) : projects.data.length ? (
              <div className="project-grid">
                {projects.data.slice(0, 3).map((p, i) => (
                  <ProjectCard key={p.id} project={p} index={i} />
                ))}
              </div>
            ) : (
              <Empty
                title="Your next project starts here"
                description="Create a project to give your team a shared place to work."
                action={
                  user?.role !== 'DEVELOPER' && (
                    <Link className="button primary" to="/projects?new=1">
                      <Plus size={16} />
                      Create project
                    </Link>
                  )
                }
              />
            )}
          </section>
          <section className="panel due-panel">
            <div className="section-heading">
              <div>
                <h2>Due this week</h2>
                <p>Keep the next milestones in sight.</p>
              </div>
              <Link className="text-button" to="/tasks">
                All tasks
                <ArrowRight size={14} />
              </Link>
            </div>
            {data.upcoming.length ? (
              <div className="upcoming-list">
                {data.upcoming.map((task) => (
                  <Link to={`/tasks?task=${task.id}`} className="upcoming-task" key={task.id}>
                    <span className="task-check" />
                    <div>
                      <strong>{task.title}</strong>
                      <span>{task.project_name}</span>
                    </div>
                    <Badge value={task.priority} />
                    <time>{formatDate(task.due_date)}</time>
                    <ArrowUpRight size={15} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="Some breathing room" description="No open tasks are due this week." />
            )}
          </section>
          <section className="panel workload-panel">
            <div className="section-heading">
              <div>
                <h2>
                  {user?.role === 'PROJECT_MANAGER' ? 'Priority breakdown' : 'Work at a glance'}
                </h2>
                <p>
                  {user?.role === 'PROJECT_MANAGER'
                    ? 'Know where your team’s attention is needed.'
                    : 'Small steps, steady momentum.'}
                </p>
              </div>
            </div>
            <div className="status-breakdown">
              {(user?.role === 'PROJECT_MANAGER'
                ? (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const)
                : statuses
              ).map((value) => {
                const count =
                  (user?.role === 'PROJECT_MANAGER'
                    ? data.by_priority.find((p) => p.priority === value)?.count
                    : data.by_status.find((s) => s.status === value)?.count) ?? 0;
                return (
                  <div key={value}>
                    <div>
                      <span>{labels[value]}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className={`mini-bar ${value.toLowerCase()}`}>
                      <span style={{ width: `${data.total ? (count / data.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        <aside className="dashboard-aside">
          <section className="panel activity-panel">
            <div className="section-heading">
              <h2>Activity feed</h2>
              <span className="live-tag">
                <span className={`connection-dot ${live.connected ? 'online' : ''}`} />
                {live.connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <ActivityFeed compact />
            <Link className="activity-view-all" to="/activity">
              View all activity
              <ArrowRight size={14} />
            </Link>
          </section>
          <div className="team-note">
            <span className="team-note-icon">
              <Users size={22} />
            </span>
            <h3>
              {user?.role === 'ADMIN'
                ? `${live.online} ${live.online === 1 ? 'person' : 'people'} online`
                : 'Better, together.'}
            </h3>
            <p>
              {user?.role === 'ADMIN'
                ? 'Your team’s active connections, updated live.'
                : 'Every update keeps your team moving in the same direction.'}
            </p>
            <div className="team-note-line" />
          </div>
        </aside>
      </div>
    </>
  );
}
