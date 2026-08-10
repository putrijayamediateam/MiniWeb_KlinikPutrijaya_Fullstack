# Klinik Putrijaya Website — PROJECT.md

_Last reviewed against `main`: 2026-08-10_

## Purpose

Klinik Putrijaya public website and internal staff admin portal.

## Production stack

- Frontend: static multi-page HTML/CSS/vanilla JavaScript
- Frontend hosting: Cloudflare Pages
- Backend: Node.js + Express
- Database: MySQL
- Backend hosting: Railway
- Production domain: https://klinikputrijaya.com
- Production API currently referenced by the frontend: `https://backend-production-d730.up.railway.app/api`
- Backend package name: `klinik-putrijaya-backend`
- Backend entry point: `backend/server.js`
- Node engine declared by backend: `24.x`

## Confirmed backend packages

Current `backend/package.json` includes:

- `express`
- `mysql2`
- `jsonwebtoken`
- `bcryptjs`
- `cors`
- `helmet`
- `express-rate-limit`
- `multer`
- `dotenv`
- `nodemailer`
- `resend`
- Google auth/API libraries

## Confirmed API route families

Mounted in `backend/server.js`:

- `/api/auth`
- `/api/admin-users`
- `/api/uploads`
- `/api/doctors`
- `/api/service-categories`
- `/api/service-subcategories`
- `/api/service-catalog`
- `/api/services`
- `/api/performance/google-search`
- `/api/performance`
- `/api/bookings`
- `/api/feedback`

Optional route files are mounted when present for:

- `/api/branches`
- `/api/promotions`
- `/api/activities`

## Confirmed application-level protections already present

`backend/server.js` currently includes:

- `helmet()` security headers
- explicit CORS configuration based on environment variables
- `app.disable('x-powered-by')`
- production `trust proxy`
- JSON/form body limits of 2 MB
- `Cache-Control: no-store` for `/api`
- general API rate limiting
- generic API 404 response
- generic 500 response to clients
- database health check at `/api/health`

These are useful controls but do not replace the dedicated Endgame Security Pass.

## Public website structure

Known public pages include:

- `/`
- `/about`
- `/branches`
- `/cheras`
- `/sungai-besi`
- `/puchong`
- `/doctors`
- `/services`
- `/service-detail`
- `/promotions`
- `/activities`
- `/little-shield`
- `/feedback`
- `/appointment`

The shared public navigation is generated from `frontend/js/main.js`.

Current shared navigation structure:

- Home
- About
  - About Us
  - Our Branches
  - Resident Doctors
- Services
  - dynamically hydrated from `/api/service-categories`
- Promotions
- Community
  - Activities & CSR
  - Little Shield Programme
  - Patient Feedback
- Contact Us

## Service architecture

Service categories are database-driven rather than hardcoded in the public navigation.

`frontend/js/main.js` fetches `/api/service-categories`, filters active categories, sorts by `sort_order` and name, then builds service links using the category slug.

## Admin system

Known admin entry points:

- `/admin`
- `/admin-approvals`

Known operational areas developed in the project include:

- authentication
- bookings
- performance
- feedback
- doctors
- services
- Service Setup / taxonomy
- promotions
- activities
- user management / approvals
- uploads

Role decisions previously established:

- Admin / CA: operational access focused on bookings/performance
- Manager: management-level operational modules
- Superadmin: privileged management including users/approvals

Server-side authorization is the real security boundary. Hiding a button or tab in frontend JavaScript is UX only.

## Git / secret hygiene

The repository `.gitignore` currently excludes:

- `.env` files
- `node_modules`
- Google service-account/search-console credential files
- credentials directories
- database/deployment backups
- logs
- editor files
- temporary/backup files

Safe `.env.example` files are explicitly allowed.

## Development conventions

1. Inspect the current repository file before proposing an exact replacement.
2. Prefer editing an existing CSS rule over appending another override.
3. Remove obsolete duplicate CSS/JS once its replacement is verified.
4. Do not change an approved desktop layout when solving a mobile-only problem.
5. Keep horizontal scrolling for wide admin tables inside their table wrapper, never the whole page.
6. Do not hardcode database-driven service categories into public navigation.
7. Run syntax checks and `git diff --check` before committing.
8. Increment static asset cache-busting query versions when required.
9. Never paste or commit real `.env` values, patient data, credentials or private keys.

## Source-of-truth rule

This file documents durable architecture and conventions, but current repository code wins if they conflict.

When a durable architecture decision changes, update this file and `MEMORY.md` in the same workstream.