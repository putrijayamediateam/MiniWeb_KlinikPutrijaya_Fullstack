# Development Guide

## Supported Local Environment

- Node.js 24.x (matches `backend/package.json`)
- npm 11 or a compatible version
- MySQL 8.x or a compatible MariaDB release
- Python 3 or another static HTTP server for `frontend/`

Do not open the frontend directly with a `file://` URL. Serve it over HTTP so browser origin, CORS, module, and API behavior match development expectations.

## First-Time Setup

From the repository root:

```powershell
Copy-Item backend/.env.example backend/.env
npm install --prefix backend
```

On Windows systems where PowerShell blocks `npm.ps1`, run `npm.cmd` instead:

```powershell
npm.cmd install --prefix backend
```

Edit `backend/.env` locally. Never paste its values into chat or commit it.

Required production settings and normal local equivalents are documented in `backend/.env.example`:

- application/origins: `PORT`, `NODE_ENV`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `BACKEND_PUBLIC_URL`;
- MySQL: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CONNECTION_LIMIT`, optional TLS settings;
- authentication: `JWT_SECRET`, `JWT_EXPIRES_IN`;
- mail: Resend values, `BOOKING_NOTIFICATION_EMAILS`, SMTP values, and `MAIL_FROM`;
- uploads: `UPLOAD_DIR` or Railway's injected volume path.

## Database Setup Status

There is currently no safe one-command fresh database bootstrap.

The historical sequence appears to be:

1. `backend/schema.sql`;
2. `database/01_upgrade_schema.sql`;
3. selected later files in `database/`;
4. ordered files in `backend/migrations/`.

However, the legacy schema creates `admin_users` while current routes use `admins`, the migration history is split, and at least one migration hardcodes the production-style `railway` database name. Do not automate or apply this inferred sequence to production.

Until the P0 migration-baseline roadmap item is complete:

- use a disposable local database for investigation;
- take and verify a backup before production SQL;
- confirm the target database explicitly;
- record every applied migration;
- verify affected tables/columns immediately afterward;
- obtain user approval before touching production.

## Run the Application

Terminal 1:

```powershell
npm run dev --prefix backend
```

Terminal 2:

```powershell
python -m http.server 5500 -d frontend
```

Open:

- public site: `http://127.0.0.1:5500/`;
- admin: `http://127.0.0.1:5500/admin.html`;
- API health: `http://localhost:4000/api/health`.

The health endpoint requires a working database connection. The backend intentionally does not start successfully when MySQL is unavailable.

## Development Checks

Run the repository check from the root:

```powershell
npm run check --prefix backend
```

It performs dependency-free checks for:

- JavaScript syntax across backend and frontend source;
- JSON parsing;
- local HTML asset/page references;
- required project guidance files;
- forbidden tracked secret/credential filenames;
- Node major-version compatibility;
- whitespace errors reported by `git diff --check`.

The same command runs in `.github/workflows/project-checks.yml` for pushes to `main` and pull requests.

These are baseline checks, not a substitute for tests. The repository still needs unit, API integration, database migration, and browser end-to-end coverage.

## Focused Manual Smoke Checks

For public changes, check the affected desktop and mobile page plus:

- navigation and dynamic Services menu;
- valid and invalid API states;
- booking validation/submission if touched;
- WhatsApp and clinic contact information if touched;
- no body-level horizontal overflow;
- no browser console errors.

For admin changes, check with the narrowest affected role plus a role that must be denied:

- login/logout and expired-token behavior;
- module visibility and direct API authorization;
- loading, empty, error, and paginated states;
- CRUD confirmation and error paths;
- table scrolling on mobile;
- export/chart third-party assets if touched.

For backend changes, check:

- expected 2xx response;
- validation failure;
- unauthenticated 401;
- authenticated but unauthorized 403;
- missing resource 404;
- safe 500 behavior;
- database mutation and rollback behavior where applicable.

## Database Change Checklist

1. Create a new ordered migration; do not rewrite an applied migration.
2. Avoid hardcoded environment database names.
3. Make reruns safe where practical.
4. Include a verification query.
5. Document rollback/recovery, especially for destructive changes.
6. Test against a disposable copy.
7. Back up production and confirm the target before applying.
8. Update `docs/ARCHITECTURE.md`, `PROJECT.md`, and `MEMORY.md` if the durable model changes.

## Deployment Guardrails

- A passing syntax check does not authorize deployment.
- Confirm whether the frontend source of truth is Cloudflare Pages or Firebase before changing deployment files.
- Confirm Railway environment variables and persistent volume status before backend deployment.
- Back up both MySQL and persistent uploads before risky releases.
- Never push, merge, deploy, rotate secrets, or run production migrations without explicit approval.

## Working in Codex Worktrees

Managed worktrees start from tracked Git content. If a worktree needs a local ignored file such as `backend/.env`, copy it intentionally into that worktree or add a narrowly scoped `.worktreeinclude` only after considering the secret-copying implications. Never commit the local environment file.
