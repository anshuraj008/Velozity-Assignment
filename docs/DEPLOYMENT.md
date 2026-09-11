# Deployment runbook

## Frontend on Vercel

Use the GitHub repository as the source and `apps/web` as the Root Directory. Enable access to source files outside the Root Directory so npm workspaces and `packages/shared` are included.

- Framework preset: Vite.
- Install command: `cd ../.. && npm ci`.
- Build command: `cd ../.. && npm run build -w @velozity/shared && npm run build -w @velozity/web`.
- Output directory: `dist` (relative to `apps/web`).
- Environment: `VITE_API_URL=https://<your-api-host>` with no trailing slash.

`apps/web/vercel.json` provides SPA deep-link routing. Verify `/projects` and `/tasks` on a fresh navigation after deployment. Vite deployment and SPA rewrites are described in [Vercel's official guide](https://vercel.com/docs/frameworks/frontend/vite).

## Persistent API and PostgreSQL

Deploy the root Dockerfile to a host supporting a continuously running Node container and WebSocket upgrades. Provision a PostgreSQL database accessible to that service. The API must not be deployed as a short-lived HTTP-only function; see [Vercel's WebSocket guidance](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections).

Run migrations as a release step: `node dist/db/migrate.js` from `/app/apps/server` in the API image. Start with the default `node dist/server.js`. Use `/api/health` for health checks. Run `node dist/db/seed.js` once against a new, explicitly designated demo database.

| Variable               | Configuration                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `NODE_ENV`             | `production`                                                                               |
| `PORT`                 | Host port, normally 4000; expose it through the service                                    |
| `DATABASE_URL`         | PostgreSQL URL with provider TLS; use `sslmode=verify-full` for certificate validation     |
| `APP_ORIGIN`           | Exact public frontend HTTPS origin, e.g. `https://workspace.example.com`                   |
| `ACCESS_TOKEN_SECRET`  | Random secret, at least 32 characters                                                      |
| `REFRESH_TOKEN_SECRET` | Different random secret, at least 32 characters                                            |
| `COOKIE_SAME_SITE`     | `lax` for same-site frontend/API; `none` only for cross-site HTTPS deployments             |
| `TRUST_PROXY`          | Exact number of trusted proxies in front of Express; normally 1 for a single managed proxy |
| `LOG_LEVEL`            | `info`                                                                                     |
| `SEED_PASSWORD`        | Demo-only password used during seed; at least 12 characters                                |

Prefer same-site HTTPS domains such as `workspace.example.com` and `api.example.com`. Separate provider domains require `SameSite=None; Secure`, and browsers that block third-party cookies may still block refresh. Validate in the target browser; same-site domains avoid that dependency. Never disable certificate validation to make a database connection work.

## Release checks

1. Run `npm ci`, `npm run build`, `npm test`, and `npm run format:check` on the intended commit.
2. Apply migrations to the designated database. Verify the seed only when it is a fresh demo environment.
3. Verify HTTPS login, refresh after access expiry, and logout. Inspect HttpOnly/Secure cookie attributes without logging token values.
4. Use separate browser profiles for both managers and developers. Confirm guessed resource IDs remain denied through the API.
5. Change a task status and observe the authorized second browser; verify unread notifications and distinct-user presence.
6. Disconnect/reconnect a viewer and confirm catch-up. Verify WebSocket upgrades reach the running API.
7. Let the scheduled job mark a past-due task while no task page is open.
8. Configure database backups and verify restore in a separate environment before using real client data.

No deployment has been performed by this runbook. Account access, service configuration, and live URLs must be supplied/established before a hosted release can be verified.
