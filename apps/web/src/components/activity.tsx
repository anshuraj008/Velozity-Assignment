import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ArrowRight, UserPlus, PenLine } from 'lucide-react';
import { labels, type ActivityPage, type Status } from '@velozity/shared';
import { api } from '../lib/api';
import { useLive } from '../lib/live';
import { Avatar, Empty, ErrorNotice, Loading, relativeDate } from './ui';
export function ActivityFeed({
  projectId,
  taskId,
  compact = false,
  fullPage = false,
}: {
  projectId?: string;
  taskId?: string;
  compact?: boolean;
  fullPage?: boolean;
}) {
  const live = useLive();
  const [projectFilter, setProjectFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [statusOnly, setStatusOnly] = useState(false);
  const query = useQuery({
    queryKey: ['activity', projectId, taskId],
    queryFn: () =>
      api<ActivityPage>(
        `/activities?${new URLSearchParams({
          ...(projectId ? { project_id: projectId } : {}),
          ...(taskId ? { task_id: taskId } : {}),
        })}`,
      ),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  const allItems = [...query.data.items].reverse();
  const projects = [
    ...new Map(allItems.map((item) => [item.project_id, item.project_name])).entries(),
  ];
  const users = [...new Map(allItems.map((item) => [item.actor_name, item.actor_name])).keys()];
  const filteredItems = allItems.filter(
    (item) =>
      (!projectFilter || item.project_id === projectFilter) &&
      (!userFilter || item.actor_name === userFilter) &&
      (!statusOnly || item.event_type === 'TASK_STATUS_CHANGED'),
  );
  const items = filteredItems.slice(0, compact ? 6 : 20);
  const header = fullPage && (
    <div className="activity-page-header">
      <div className="activity-page-title">
        <div>
          <span className="eyebrow">EVERY STEP, IN ONE PLACE</span>
          <h1>Activity</h1>
          <p>The latest updates across your workspace.</p>
        </div>
        <span className="live-tag activity-live-tag">
          <span className={`connection-dot ${live.connected ? 'online' : ''}`} />
          {live.connected ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
      <div className="activity-filters" aria-label="Activity filters">
        <label>
          <span className="sr-only">Filter by project</span>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="">All projects</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by user</span>
          <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)}>
            <option value="">All users</option>
            {users.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by activity type</span>
          <select
            value={statusOnly ? 'status' : ''}
            onChange={(event) => setStatusOnly(event.target.value === 'status')}
          >
            <option value="">All activity</option>
            <option value="status">Status changes</option>
          </select>
        </label>
      </div>
    </div>
  );
  if (!items.length)
    return (
      <>
        {header}
        <Empty
          title="A fresh start"
          description="Task assignments and status changes will appear here as your team works."
        />
      </>
    );
  return (
    <>
      {header}
      <div className="activity-list">
        {items.map((item) => (
          <article className="activity-item" key={item.id}>
            <div className="activity-avatar">
              <Avatar name={item.actor_name} small />
              <span className="activity-action">
                {item.event_type === 'TASK_ASSIGNED' ? (
                  <UserPlus size={10} />
                ) : item.event_type === 'TASK_STATUS_CHANGED' ? (
                  <Check size={10} />
                ) : (
                  <PenLine size={10} />
                )}
              </span>
            </div>
            <div className="activity-body">
              <p>
                <strong>{item.actor_name}</strong>{' '}
                {item.event_type === 'TASK_ASSIGNED'
                  ? 'assigned a task'
                  : item.event_type === 'TASK_STATUS_CHANGED'
                    ? 'updated a task'
                    : 'edited a task'}
              </p>
              <p className="activity-task">{item.task_title}</p>
              {item.event_type === 'TASK_STATUS_CHANGED' && (
                <div className="activity-transition">
                  <span>{labels[item.old_value as Status] ?? item.old_value}</span>
                  <ArrowRight size={11} />
                  <span>{labels[item.new_value as Status] ?? item.new_value}</span>
                </div>
              )}
              <div className="activity-meta">
                <span>{item.project_name}</span>
                <time title={new Date(item.created_at).toLocaleString()} dateTime={item.created_at}>
                  {relativeDate(item.created_at)}
                </time>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
