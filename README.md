# DocSync MVP

Next.js (App Router) + TypeScript + **local PostgreSQL** implementation of the DocSync MVP specification pack in the repository `spec/` folder (read order starts at `spec/15-decisions-assumptions.md`).

UI reference exports live next to this app at [`../visily/`](../visily/) (for example `visily-projects-dashboard.jpg`).

## Prerequisites

- Node.js 20+
- **PostgreSQL** running on your Mac (no Docker required). Easiest paths:
  - **Homebrew:** `brew install postgresql@16`, then `brew services start postgresql@16`
  - **Postgres.app:** install from [postgresapp.com](https://postgresapp.com/) and start the server from the app

Create an empty database named `docsync` (once):

```bash
createdb docsync
```

If `createdb` fails with “role does not exist”, use Postgres.app’s GUI to create a database, or run `createuser -s $(whoami)` first. If login still fails, set `DATABASE_URL` to include your macOS username, for example:

`postgresql://YOUR_USERNAME@localhost:5432/docsync`

## Quick start

1. Copy environment defaults:

   ```bash
   cp .env.example .env.local
   ```

   Set `AUTH_SECRET` to any random string **at least 32 characters** (used to sign session cookies). Adjust `DATABASE_URL` if your Postgres user, host, port, or database name differs.

2. Install dependencies:

   ```bash
   npm install
   ```

3. **One command** — apply migrations (if needed) and start the app:

   ```bash
   npm run dev
   ```

   This runs [`scripts/dev.mjs`](scripts/dev.mjs): migrations from [`db/migrations/001_local_postgres.sql`](db/migrations/001_local_postgres.sql), then `next dev`.

4. Open [http://localhost:3000](http://localhost:3000), use **Create account** or **Sign in** with email and password only.

### Commands

| Script | Purpose |
|--------|---------|
| `npm run dev` | Migrate (if needed) **+** Next.js dev server |
| `npm run dev:next` | Next.js only (Postgres must already be migrated) |
| `npm run db:migrate` | Apply pending SQL migrations |

### Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string for your **local** server. |
| `AUTH_SECRET` | Secret for signing HTTP-only session cookies (HS256); minimum 32 characters. |

### Authentication (minimal, local dev)

- Email + password stored in Postgres (`users.password_hash` with bcrypt).
- Sessions are **signed JWTs** in an HTTP-only cookie (`docsync_session`).
- No password reset, no email verification, no OAuth, no external auth providers.

The public routes `POST /api/auth/login` and `POST /api/auth/register` create sessions; all other `/api/*` routes expect a valid session cookie (or `Authorization: Bearer <jwt>` for scripts).

**Security:** registration is open on whoever can reach the server—fine for local development only.

### Database

Schema lives in [`db/migrations/001_local_postgres.sql`](db/migrations/001_local_postgres.sql): enums, `users`, `projects`, `openapi_specs`, `scan_runs`, `drift_issues`, and RPC helpers:

- `insert_running_scan(user_id, …)` — inserts a `running` scan and enforces the concurrent-scan guard.
- `finalize_scan_run(user_id, …)` — completes the scan row, inserts drift issues, and updates denormalized project fields.

Access control is enforced in application code by filtering on `user_id`.

To wipe the dev database and re-run migrations:

```bash
dropdb docsync && createdb docsync && npm run db:migrate
```

### Latest-scan-only issues

The issues list and issue detail APIs only surface rows tied to the **latest completed** successful scan (`status = completed`, `result in (drift, no_drift)`), matching `spec/09-data-model.md`.

## Drift engine

- Version string stored on each run: `drift-engine@1.0.0` (`spec/11-scan-engine-spec.md`).
- Rules implemented: **R1–R4**, plus **R3** for OpenAPI 3.x only (Swagger 2.0 skips R3). **R5** is not implemented (optional in the spec).
- Documentation fetch uses a **10s** timeout and does **not** fail the entire scan on failure (`spec/14-edge-cases.md`).
- OpenAPI parse/validate uses a **3s** watchdog (`spec/14-edge-cases.md`).
- Overall scan work is bounded by a **30s** client-side race in the API route (returns `error` result if exceeded).

## Scan execution model

`POST /api/projects/:id/scans` runs **synchronously** and returns **HTTP 200** with a completed `scanRun` payload when finished (`spec/10-api-and-server-actions.md` synchronous MVP alternative). The UI still shows a blocking “scanning” state until the request completes.

## Security note

`documentation_source_url` is user-controlled. The MVP only allows `http`/`https` URLs at validation time; be aware of SSRF considerations in production deployments (`spec/14-edge-cases.md`).

## Product scope guardrails

Do not ship required user paths for items listed in `spec/05-out-of-scope.md` (notifications inbox, GitHub OAuth as a requirement, continuous monitoring as a Must, and so on).
