import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, CheckCheck } from 'lucide-react';
import { labels, type Notification, type Status } from '@velozity/shared';
import { Link } from 'react-router-dom';
import { api, json } from '../lib/api';
import { Empty, ErrorNotice, Loading, relativeDate } from '../components/ui';

type NotificationData = { items: Notification[]; unread: number };

export function NotificationsPage() {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationData>('/notifications'),
  });
  const read = useMutation({
    mutationFn: (id?: string) =>
      api(id ? `/notifications/${id}/read` : '/notifications/read-all', json('PATCH')),
    onMutate: async (id) => {
      await cache.cancelQueries({ queryKey: ['notifications'] });
      const previous = cache.getQueryData<NotificationData>(['notifications']);
      cache.setQueryData<NotificationData>(['notifications'], (current) => {
        if (!current) return current;
        const items = current.items.map((item) =>
          !id || item.id === id ? { ...item, is_read: true } : item,
        );
        return { items, unread: items.filter((item) => !item.is_read).length };
      });
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) cache.setQueryData(['notifications'], context.previous);
    },
    onSettled: () => cache.invalidateQueries({ queryKey: ['notifications'] }),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KEEP THE WORK MOVING</span>
          <h1>Notifications</h1>
          <p>Assignments, reviews, and other updates that need your attention.</p>
        </div>
        <button
          className="button"
          disabled={read.isPending || !query.data.unread}
          onClick={() => read.mutate(undefined)}
        >
          <CheckCheck size={16} />
          Mark all as read
        </button>
      </div>
      <section className="panel notifications-page-panel">
        {!query.data.items.length ? (
          <Empty
            title="You’re all caught up"
            description="New assignments and review requests will appear here."
          />
        ) : (
          <div className="notification-list">
            {query.data.items.map((notification) => (
              <article
                key={notification.id}
                className={`notification-item ${notification.is_read ? '' : 'unread'}`}
              >
                <div className="notification-symbol">
                  <ArrowUpRight size={18} />
                </div>
                <div>
                  <p>{notification.message}</p>
                  {notification.task_title && <strong>{notification.task_title}</strong>}
                  {notification.new_value && notification.actor_name && (
                    <span className="notification-context">
                      {notification.actor_name} moved it to{' '}
                      {labels[notification.new_value as Status] ?? notification.new_value}
                    </span>
                  )}
                  <time>{relativeDate(notification.created_at)}</time>
                  {notification.task_id && (
                    <Link to={`/tasks?task=${notification.task_id}`}>Open task</Link>
                  )}
                </div>
                {!notification.is_read && (
                  <button
                    className="text-button"
                    disabled={read.isPending}
                    onClick={() => read.mutate(notification.id)}
                  >
                    Mark read
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
