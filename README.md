# FlowDesk Workspace

A real-time project and task management application designed for agency teams. Admins manage the workspace, Project Managers create and track their client projects, and Developers update their assigned tasks with live real-time sync across all users.

---

## 🚀 How to Run Locally

### Prerequisites

- **Node.js**: v22+ installed
- **npm**: v10+ installed

### Step 1: Install Dependencies

```sh
npm ci
```

### Step 2: Setup Database & Environment

```sh
npm run setup:local
npm run db:local
```

_(Keep this terminal open for the local database)_

### Step 3: Run Migrations, Seed & Start Dev Server

In a **new terminal tab/window**:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

### Step 4: Open in Browser

Visit **[http://localhost:5173](http://localhost:5173)** to access the app!

- **Frontend App**: http://localhost:5173
- **Backend API**: http://localhost:4000
- **API Health Check**: http://localhost:4000/api/health

---

## 🔑 Demo Login Accounts

All demo accounts use the same default password:

> **Password for all accounts:** `FlowDesk@2026`

| Role            | Email                  |
| --------------- | ---------------------- |
| Admin           | `admin@velozity.test`  |
| Project Manager | `maya@velozity.test`   |
| Project Manager | `james@velozity.test`  |
| Developer       | `arjun@velozity.test`  |
| Developer       | `sofia@velozity.test`  |
| Developer       | `ankita@velozity.test` |
| Developer       | `priya@velozity.test`  |

_Note: New user passwords must have at least 8 characters including uppercase, lowercase, number, and a special symbol._

---

## Access rules

| Capability                  | Admin                    | Project manager           | Developer                     |
| --------------------------- | ------------------------ | ------------------------- | ----------------------------- |
| Manage users and clients    | All                      | View team and client list | No                            |
| Read projects               | All                      | Created by that manager   | Projects with assigned tasks  |
| Create/edit/delete projects | All                      | Create and manage own     | No                            |
| Create/assign/edit tasks    | All                      | Within own projects       | No                            |
| Change task status          | All                      | Within own projects       | Assigned tasks only           |
| Activity and catch-up       | All workspace events     | Events in own projects    | Events on assigned tasks only |
| Notifications               | Own inbox                | Own inbox                 | Own inbox                     |
| Online-user count           | Live distinct-user count | No                        | No                            |

---

## Commands

| Command              | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `npm run dev`        | Starts both frontend (`5173`) and API (`4000`) dev servers concurrently |
| `npm run build`      | Type-check and compile shared package, server, and client               |
| `npm run typecheck`  | Run TypeScript verification across all workspaces                       |
| `npm test`           | Run integration test suite using isolated PostgreSQL                    |
| `npm run test:e2e`   | Run Playwright end-to-end browser workflows                             |
| `npm run db:migrate` | Apply database schema migrations                                        |
| `npm run db:seed`    | Populate database with demo users, projects, and tasks                  |
| `npm start`          | Run compiled production server                                          |

---

## 🐳 Docker Setup (Optional)

If you prefer running everything in Docker:

```sh
# 1. Copy environment variables
cp .env.example .env

# 2. Build and start containers
docker compose up --build -d

# 3. Seed demo accounts
docker compose exec api node dist/db/seed.js
```

Open **http://localhost:8080** in your browser.

---

## 💻 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TanStack Query, Lucide Icons, Vanilla CSS (with responsive dark Cyprus/Sand theme)
- **Backend**: Node.js, Express 5, TypeScript
- **Database**: PostgreSQL (Native SQL queries with connection pooling)
- **Real-Time**: Socket.IO (Authenticated WebSocket events & presence)
- **Validation**: Zod (Shared schemas between client and server)
- **Security**: Scrypt password hashing, JWT token rotation, HttpOnly cookies, CSRF Origin protection
