# Klinik Putrijaya Website

Production-oriented public website and staff admin portal for Klinik Putrijaya's Cheras, Sungai Besi, and Puchong branches.

The application combines a static multi-page frontend with an Express/MySQL API. It supports dynamic clinic content, appointments, patient feedback, services and taxonomy, promotions, community activities, performance reporting, uploads, and role-based administration.

The public frontend also hosts the KP Content OS product information, Terms of
Service and bilingual Privacy Policy required for transparent read-only TikTok
integration. These pages are linked directly from the shared site footer.

## Current Phase

The project is in **Endgame**: production QA, SEO, cleanup, backup/recovery, security review, and release freeze take priority over major new features.

Start with:

| Document | Purpose |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Working agreements for Codex and contributors |
| [`PROJECT.md`](PROJECT.md) | Current production facts and conventions |
| [`MEMORY.md`](MEMORY.md) | Durable decisions and recurring pitfalls |
| [`ENDGAME.md`](ENDGAME.md) | Detailed final-release checklist |
| [`ROADMAP.md`](ROADMAP.md) | Prioritized milestones and acceptance evidence |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Components, data flows, roles, storage, and risks |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Local setup, checks, smoke tests, and deployment guardrails |
| [`docs/BASELINE_AUDIT.md`](docs/BASELINE_AUDIT.md) | 2026-08-13 repository-readiness findings |

## Stack

- Frontend: static HTML, CSS, and vanilla JavaScript
- Backend: Node.js 24.x and Express 4
- Database: MySQL/MariaDB-compatible SQL
- Authentication: JWT, bcrypt, active-account checks, and role middleware
- Backend hosting: Railway
- Frontend hosting: documented as Cloudflare Pages; checked-in Firebase files remain and must be reconciled before deployment cleanup
- Persistent media: Railway volume or `UPLOAD_DIR` in production
- Email: SMTP/Nodemailer plus Resend-related support
- Reporting: first-party performance events and Google Search Console integration

## Repository Structure

```text
backend/             Express API, middleware, services, SQL base, package files
backend/migrations/  Services V2 and community activity SQL migrations
database/            Incremental operational SQL migrations
frontend/            Static pages, scripts, styles, and media
scripts/             Dependency-free project checks
docs/                Architecture, development, and audit documentation
.github/workflows/   Pull-request and main-branch checks
```

Important admin distinction:

- `frontend/admin.js` is loaded by the current admin page.
- `frontend/js/admin.js` is an older implementation and should not be edited as production behavior.

## Quick Local Start

Prerequisites: Node.js 24.x, npm, MySQL/MariaDB, and Python 3 or another static server.

```powershell
Copy-Item backend/.env.example backend/.env
npm install --prefix backend
npm run check --prefix backend
npm run dev --prefix backend
```

In a second terminal:

```powershell
python -m http.server 5500 -d frontend
```

Then open:

- `http://127.0.0.1:5500/`
- `http://127.0.0.1:5500/admin.html`
- `http://localhost:4000/api/health`

If PowerShell blocks `npm.ps1`, use `npm.cmd` instead.

### Database warning

The repository does **not yet have a canonical one-command fresh database bootstrap**. The legacy base schema and later migrations are split between `backend/schema.sql`, `database/`, and `backend/migrations/`, and current authentication uses a different admin table from the legacy seed.

Do not rely on historical default credentials and do not apply the inferred SQL sequence to production. Follow the limitations in `docs/DEVELOPMENT.md` and complete the P0 migration-baseline item in `ROADMAP.md` first.

## Configuration

Copy `backend/.env.example` to `backend/.env` and set local values. The template covers:

- application port, environment, frontend URL, allowed origins, and public backend URL;
- MySQL host, port, user, password, database, pool limit, and optional TLS;
- JWT secret and lifetime;
- SMTP sender configuration;
- upload storage.

Never commit the real environment file, credentials, private keys, database dumps, access tokens, or patient information.

## Development Checks

```powershell
npm run check --prefix backend
```

The command checks JavaScript syntax, JSON, local HTML references, required guidance files, tracked credential filenames, the Node runtime, and Git whitespace. GitHub Actions runs the same command on pull requests and pushes to `main`.

Automated unit, integration, migration, and browser tests are still roadmap work. A passing baseline check does not by itself prove the release is safe.

## Change and Release Policy

- Inspect the current implementation and read `AGENTS.md` before changing code.
- Keep mobile fixes scoped when desktop is already approved.
- Treat server-side role checks as the security boundary.
- Never connect the browser directly to MySQL.
- Do not push, merge, deploy, rotate secrets, change production settings, or run production migrations without explicit approval.
- Update project documentation when durable architecture or operating decisions change.

## Production

- Public domain: [https://klinikputrijaya.com](https://klinikputrijaya.com)
- Production API currently referenced by frontend code: `https://backend-production-d730.up.railway.app/api`
- Health endpoint: `/api/health`

Provider dashboards, credentials, DNS, databases, and deployments are intentionally not documented with secrets in this repository.
