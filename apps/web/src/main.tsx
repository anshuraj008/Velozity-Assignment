import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import { LiveProvider } from './lib/live';
import { ApiError } from './lib/api';
import { Shell } from './components/shell';
import { Loading } from './components/ui';
import { ActivityFeed } from './components/activity';
import { Login } from './pages/login';
import { Dashboard } from './pages/dashboard';
import { Projects, ProjectDetails } from './pages/projects';
import { TaskList } from './pages/tasks';
import { Directory } from './pages/directory';
import { NotificationsPage } from './pages/notifications';
import './styles.css';

const cache = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: true,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    },
    mutations: { retry: false },
  },
});
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fatal-error">
        <h1>Something went wrong.</h1>
        <p>Your saved work is still on the server. Reload the workspace to continue.</p>
        <button className="button primary" onClick={() => window.location.reload()}>
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Login />;
  return (
    <LiveProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetails />} />
          <Route path="tasks" element={<TaskList />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route
            path="activity"
            element={
              <section className="panel full-activity">
                <ActivityFeed fullPage />
              </section>
            }
          />
          <Route
            path="clients"
            element={
              user.role === 'ADMIN' ? <Directory kind="clients" /> : <Navigate to="/" replace />
            }
          />
          <Route
            path="team"
            element={
              user.role === 'ADMIN' || user.role === 'PROJECT_MANAGER' ? (
                <Directory kind="users" />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LiveProvider>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={cache}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
