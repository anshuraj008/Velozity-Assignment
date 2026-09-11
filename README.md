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

| Role                | Name            | Email                  | Password        |
| :------------------ | :-------------- | :--------------------- | :-------------- |
| **Admin**           | Workspace Admin | `admin@velozity.test`  | `FlowDesk@2026` |
| **Project Manager** | Maya Lin        | `maya@velozity.test`   | `FlowDesk@2026` |
| **Project Manager** | James Wilson    | `james@velozity.test`  | `FlowDesk@2026` |
| **Developer**       | Arjun Mehta     | `arjun@velozity.test`  | `FlowDesk@2026` |
| **Developer**       | Sofia Rossi     | `sofia@velozity.test`  | `FlowDesk@2026` |
| **Developer**       | Ankita Sharma   | `ankita@velozity.test` | `FlowDesk@2026` |
| **Developer**       | Priya Patel     | `priya@velozity.test`  | `FlowDesk@2026` |

_Note: New user passwords must have at least 8 characters including uppercase, lowercase, number, and a special symbol._

---

## 👥 Role Permissions Overview

| Feature                                           |      Admin      | Project Manager |     Developer     |
| :------------------------------------------------ | :-------------: | :-------------: | :---------------: |
| **Manage Team Members** (Add / Edit / Deactivate) |     ✅ Yes      | ❌ (View only)  |       ❌ No       |
| **Manage Clients** (Add / Edit / Delete)          |     ✅ Yes      | ❌ (View only)  |       ❌ No       |
| **Manage Projects** (Create / Edit / Delete)      | ✅ All Projects | ✅ Own Projects |       ❌ No       |
| **Create & Assign Tasks**                         | ✅ All Projects | ✅ Own Projects |       ❌ No       |
| **Update Task Status** (`TODO` ➔ `DONE`)          |  ✅ All Tasks   | ✅ Own Projects | ✅ Assigned Tasks |
| **Live Activity Feed & Notifications**            |  ✅ All Events  | ✅ Own Projects | ✅ Assigned Tasks |
| **Live Online Users Counter**                     |     ✅ Yes      |      ❌ No      |       ❌ No       |

---

## 🛠️ Helpful Commands

| Command             | What it does                                                    |
| :------------------ | :-------------------------------------------------------------- |
| `npm run dev`       | Starts both frontend (`5173`) and backend (`4000`) concurrently |
| `npm run typecheck` | Checks TypeScript types across the entire project               |
| `npm test`          | Runs the automated integration tests (26 test cases)            |
| `npm run test:e2e`  | Runs Playwright end-to-end browser tests                        |
| `npm run build`     | Builds the production bundle for client and server              |

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
