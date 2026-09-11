CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text NOT NULL UNIQUE,
  password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('ADMIN','PROJECT_MANAGER','DEVELOPER')),
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, company text NOT NULL, email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text NOT NULL DEFAULT '',
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_owner_idx ON projects(created_by_id);
CREATE INDEX projects_client_idx ON projects(client_id);
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL, description text NOT NULL DEFAULT '', assigned_developer_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'TODO' CHECK(status IN ('TODO','IN_PROGRESS','IN_REVIEW','DONE')),
  priority text NOT NULL CHECK(priority IN ('LOW','MEDIUM','HIGH','CRITICAL')), due_date timestamptz NOT NULL,
  is_overdue boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_assignee_status_idx ON tasks(assigned_developer_id,status);
CREATE INDEX tasks_project_status_idx ON tasks(project_id,status);
CREATE INDEX tasks_project_priority_idx ON tasks(project_id,priority);
CREATE INDEX tasks_due_idx ON tasks(due_date) WHERE status <> 'DONE';
CREATE TABLE activities (
  id bigserial PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, actor_id uuid NOT NULL REFERENCES users(id),
  event_type text NOT NULL, old_value text, new_value text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activities_project_cursor_idx ON activities(project_id,id DESC);
CREATE INDEX activities_task_cursor_idx ON activities(task_id,id DESC);
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE, message text NOT NULL, is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_recipient_unread_idx ON notifications(user_id,is_read,created_at DESC);
CREATE TABLE sessions (
  id uuid PRIMARY KEY, family_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id), token_hash text NOT NULL,
  expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_family_idx ON sessions(family_id);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
