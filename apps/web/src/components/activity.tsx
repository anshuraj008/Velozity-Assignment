import { useQuery } from '@tanstack/react-query';
import { Check, ArrowRight, UserPlus, PenLine } from 'lucide-react';
import { labels, type ActivityPage, type Status } from '@velozity/shared';
import { api } from '../lib/api';
import { Avatar, Empty, ErrorNotice, Loading, relativeDate } from './ui';
export function ActivityFeed({
  projectId,
  compact = false,
}: {
  projectId?: string;
  compact?: boolean;
}) {
  const query = useQuery({
    queryKey: ['activity', projectId],
    queryFn: () => api<ActivityPage>(`/activities${projectId ? `?project_id=${projectId}` : ''}`),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  const items = [...query.data.items].reverse().slice(0, compact ? 6 : 20);
  if (!items.length)
    return (
      <Empty
        title="A fresh start"
        description="Task assignments and status changes will appear here as your team works."
      />
    );
  return (
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
  );
}
