import { useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Activity,
  Users,
  Building2,
  LogOut,
  Bell,
  ChevronDown,
  PanelLeft,
  CheckCheck,
  ArrowUpRight,
  Command,
} from 'lucide-react';
import { labels, type Notification } from '@velozity/shared';
import { useAuth } from '../lib/auth';
import { useLive } from '../lib/live';
import { api, json } from '../lib/api';
import { Avatar, Modal, Empty, ErrorNotice, Loading, relativeDate } from './ui';

export function Shell() {
  const { user, logout } = useAuth();
  const live = useLive();
  const location = useLocation();
  const cache = useQueryClient();
  const [navOpen, setNavOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [logoutError, setLogoutError] = useState<unknown>(null);
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ items: Notification[]; unread: number }>('/notifications'),
  });
  const read = useMutation({
    mutationFn: (id?: string) =>
      api(id ? `/notifications/${id}/read` : '/notifications/read-all', json('PATCH')),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['notifications'] }),
  });
  if (!user) return null;
  const links = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/tasks', label: user.role === 'DEVELOPER' ? 'My tasks' : 'Tasks', icon: ListTodo },
    { to: '/activity', label: 'Activity', icon: Activity },
    ...(user.role === 'ADMIN'
      ? [
          { to: '/clients', label: 'Clients', icon: Building2 },
          { to: '/team', label: 'Team members', icon: Users },
        ]
      : []),
  ];
  const current = links.find((l) =>
    l.to === '/' ? location.pathname === '/' : location.pathname.startsWith(l.to),
  );
  return (
    <div className="app-shell">
      {navOpen && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <Link className="brand" to="/">
          <span className="brand-mark">v</span>velozity<span className="brand-period">.</span>
        </Link>
        <div className="workspace-switch">
          <div className="workspace-icon">
            <Command size={18} />
          </div>
          <div>
            <strong>Agency workspace</strong>
            <span>Project management</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setNavOpen(false)}>
              <Icon size={18} />
              <span>{to === '/tasks' && user.role !== 'DEVELOPER' ? 'Tasks' : label}</span>
              {to === '/activity' && <span className="nav-live" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className={`connection-dot ${live.connected ? 'online' : ''}`} />
            <strong>{live.connected ? 'Workspace is live' : 'Connecting to workspace'}</strong>
            <p>
              {live.connected
                ? 'Changes stay in sync with your team.'
                : 'Live updates will resume when connected.'}
            </p>
          </div>
          <div className="sidebar-user">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <span>{labels[user.role]}</span>
            </div>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => void logout().catch(setLogoutError)}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setNavOpen(true)}
            >
              <PanelLeft size={20} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{current?.label ?? 'Project details'}</strong>
          </div>
          <div className="topbar-right">
            <span className="live-pill">
              <span className={`connection-dot ${live.connected ? 'online' : ''}`} />
              {live.connected ? 'Live updates' : 'Reconnecting'}
            </span>
            <span className="topbar-divider" />
            <button
              className="notification-button icon-button"
              aria-label={`Notifications, ${query.data?.unread ?? 0} unread`}
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
              {!!query.data?.unread && (
                <span className="notification-count">
                  {query.data.unread > 9 ? '9+' : query.data.unread}
                </span>
              )}
            </button>
            <Avatar name={user.name} small />
          </div>
        </header>
        <main className="main-content">
          {Boolean(logoutError) && <ErrorNotice error={logoutError} />}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Velozity workspace</span>
          <span>Good work happens together.</span>
        </footer>
      </div>
      {notifications && (
        <Modal title="Notifications" onClose={() => setNotifications(false)}>
          <div className="notifications-toolbar">
            <span>{query.data?.unread ?? 0} unread</span>
            <button
              className="text-button"
              disabled={read.isPending || !query.data?.unread}
              onClick={() => read.mutate(undefined)}
            >
              <CheckCheck size={15} />
              Mark all as read
            </button>
          </div>
          {query.isPending ? (
            <Loading />
          ) : query.error ? (
            <ErrorNotice error={query.error} />
          ) : !query.data?.items.length ? (
            <Empty
              title="You’re all caught up"
              description="New assignments and review requests will appear here."
            />
          ) : (
            <div className="notification-list">
              {query.data.items.map((n) => (
                <article key={n.id} className={`notification-item ${n.is_read ? '' : 'unread'}`}>
                  <div className="notification-symbol">
                    <ArrowUpRight size={18} />
                  </div>
                  <div>
                    <p>{n.message}</p>
                    <time>{relativeDate(n.created_at)}</time>
                    {n.task_id && (
                      <Link to={`/tasks?task=${n.task_id}`} onClick={() => setNotifications(false)}>
                        Open task
                      </Link>
                    )}
                  </div>
                  {!n.is_read && (
                    <button
                      className="text-button"
                      disabled={read.isPending}
                      onClick={() => read.mutate(n.id)}
                    >
                      Mark read
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
          {read.error && <ErrorNotice error={read.error} />}
        </Modal>
      )}
    </div>
  );
}
