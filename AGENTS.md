# Klinik Putrijaya Repository Guidance

## Mission

Maintain and improve the Klinik Putrijaya public website and staff admin portal without disrupting patient-facing or staff workflows. The project is in the Endgame phase: production reliability, QA, security, recovery, and maintainability take priority over major feature expansion.

## Read Before Changing Code

1. Read `PROJECT.md` for current architecture and production facts.
2. Read `MEMORY.md` for durable product decisions and recurring pitfalls.
3. Read `ENDGAME.md` and `ROADMAP.md` before choosing priorities.
4. Read `docs/DEVELOPMENT.md` before running or changing the application.
5. Read `docs/ARCHITECTURE.md` before changing routes, roles, database tables, deployment, uploads, or shared frontend behavior.

Current code wins when documentation conflicts with the repository. Correct the documentation in the same change when durable facts have changed.

## Architecture Boundaries

- `frontend/` is a static multi-page HTML/CSS/vanilla JavaScript application.
- `backend/` is the Node.js 24 + Express REST API.
- MySQL is the system of record. Browser code must never connect directly to MySQL.
- `frontend/js/api.js` is the shared public API client.
- `frontend/js/main.js` owns shared public navigation and layout behavior.
- `frontend/admin.js` is the production admin dashboard bundle loaded by `frontend/admin.html`.
- `frontend/js/admin.js` is an older implementation and is not loaded by the current admin page. Do not edit it as if it were production code.
- Upload metadata belongs in MySQL; upload binaries live below the configured persistent upload root.
- Server-side middleware and route checks are the authorization boundary. Hidden tabs and buttons are UX only.

## Standard Workflow

1. Inspect the current file and its callers before proposing a replacement.
2. Confirm the Git worktree is clean enough to isolate the requested change. Preserve unrelated user changes.
3. Make the smallest coherent change that addresses the request.
4. Update tests/checks and durable documentation when behavior or architecture changes.
5. Run `npm run check --prefix backend` from the repository root.
6. Run focused runtime or browser checks appropriate to the changed flow.
7. Review `git diff --check`, `git status --short`, and the final diff before handoff.

## Development Commands

From the repository root:

```powershell
Copy-Item backend/.env.example backend/.env
npm install --prefix backend
npm run check --prefix backend
npm run dev --prefix backend
python -m http.server 5500 -d frontend
```

On Windows systems that block `npm.ps1`, use `npm.cmd` instead of `npm`.

There is not yet a trustworthy one-command database bootstrap. Follow `docs/DEVELOPMENT.md` and treat the migration-baseline item in `ROADMAP.md` as P0. Never apply SQL to production without an explicit backup, target confirmation, and user approval.

## Coding Rules

### General

- Target Node.js 24.x as declared by `backend/package.json`.
- Prefer small functions and focused modules over extending already-large files.
- Do not add a production dependency without explaining why and obtaining approval.
- Do not make unrelated cleanup part of a focused bug fix.
- Preserve extensionless production URLs and existing public SEO behavior.
- Increment relevant static asset cache-busting query versions when a changed asset might otherwise remain cached.

### Frontend

- Preserve the approved desktop layout when solving mobile-only problems.
- Keep wide-table scrolling inside `.table-wrap`; never introduce body-level horizontal scrolling.
- Edit existing CSS rules instead of stacking override blocks. Remove obsolete duplicates after verification.
- Do not hardcode database-driven service categories into navigation or service pages.
- Treat any string written with `innerHTML` or `insertAdjacentHTML` as untrusted unless it is escaped or built from controlled constants.
- Prefer moving new admin behavior into focused modules rather than growing `frontend/admin.js`.

### Backend

- Use parameterized MySQL values. Any interpolated identifier or sort expression must come from an explicit allowlist.
- Public write endpoints require abuse controls, input validation, minimal responses, and safe logging.
- Protected routes should use `requireAdmin`, `requireActiveAdmin`, and the narrowest role middleware that fits.
- Never log passwords, reset tokens, JWTs, patient identity values, complete request bodies, SMTP credentials, or database credentials.
- Keep API error responses generic in production while retaining useful server-side diagnostics.
- Validate uploaded file content and authorization; do not rely only on filenames, extensions, or browser-supplied MIME types.

### Database

- Do not edit an already-applied production migration in place. Add a new ordered migration.
- Every schema change needs an apply plan, rollback/recovery plan, and verification query.
- Use `utf8mb4` consistently.
- Minimize collection and retention of patient identity and booking information.
- Keep local, staging, and production database names configurable; do not add new hardcoded `USE railway` statements.

## Security and Privacy

- Never commit or paste real `.env` values, private keys, patient data, database exports, access tokens, or provider credentials.
- Do not publish, deploy, push, merge, rotate secrets, change production settings, or run production migrations without explicit user approval.
- Treat bookings, identity numbers, phone numbers, email addresses, feedback, and admin account data as sensitive.
- Do not weaken CORS, Helmet, rate limits, authentication, role checks, upload limits, or cache controls merely to make a test pass.
- Flag suspected security defects separately; do not silently expand a normal feature change into an unreviewed security redesign.

## Definition of Done

A change is ready for review only when:

- the requested behavior is implemented and scoped correctly;
- `npm run check --prefix backend` passes;
- focused manual or automated checks for the affected flow pass;
- schema/configuration/deployment implications are documented;
- no secret or patient data is present in the diff;
- relevant `README.md`, `PROJECT.md`, `MEMORY.md`, `ENDGAME.md`, or `ROADMAP.md` entries are updated;
- the final diff has been inspected for unrelated changes.

## Code Review Rules

Prioritize findings that can cause patient-data exposure, unauthorized admin actions, lost uploads, broken booking flows, incorrect clinic/WhatsApp information, production downtime, or irreversible database changes. Treat layout polish and style consistency as lower priority unless they block use of a patient or staff workflow.
