# Baseline Repository Audit

_Inspection date: 2026-08-13_

_Baseline: clean `main` at `d07b077` (`Appointment prevent horizontal page sliding`)_

## Scope

This was a structural and development-readiness inspection of the tracked repository. It covered Git state, documentation, source layout, package/configuration files, Express composition, route and middleware patterns, frontend entry points, SQL history, asset layout, and available checks.

It was not a full penetration test, production data review, live deployment audit, or database restore test. No production settings, secrets, database, DNS, provider configuration, or deployed files were changed.

## Inventory

| Area | Observed |
|---|---:|
| JavaScript | 49 files |
| HTML | 26 files |
| CSS | 17 files |
| SQL | 11 files |
| Markdown | 4 pre-existing files |
| Frontend tree | about 157 MB / 268 files |
| Backend tree | about 11 MB / 47 files |

The application is a production-oriented static frontend plus Express/MySQL backend, not merely the small training example described by the old README.

## Checks Run Before Workspace Changes

- Git status: clean `main`, aligned with `origin/main`.
- Existing `npm run check`: passed, but covered only four backend files.
- JavaScript syntax: all 49 JavaScript files parsed successfully with Node 24.18.0.
- JSON: tracked configuration/package JSON parsed in the baseline inspection.
- `git diff --check`: clean before modifications.
- Tracked secret-like filenames: only the allowed `backend/.env.example` matched.
- GitHub workspace configuration: no `.github` directory or automated workflow existed.
- Test/lint tooling: no unit/integration/e2e framework, ESLint, Prettier, or CSS linter was found.

## High-Priority Findings

### 1. Database reconstruction is not reliable

The legacy base schema, `database/`, and `backend/migrations/` do not form a documented, automatically tracked migration chain. Current authentication queries `admins`, but `backend/schema.sql` seeds `admin_users`. A later migration creates `admins`, and another uses `USE railway` directly.

Impact: a fresh environment may not match production, recovery is harder to prove, and an operator can apply SQL to the wrong target.

Action: create a canonical schema baseline plus ordered migration runner and prove fresh-build and restore flows in a disposable database.

### 2. Automated verification was too narrow

The previous backend check parsed four files, while the repository has 49 JavaScript files and many static page references. No CI or automated tests existed.

Action in this setup: add a dependency-free repository checker and GitHub Actions workflow. Follow-up: add API and browser tests.

### 3. Setup documentation was stale and unsafe

The old README targeted Node 18, described a much smaller application, and documented a default `admin/admin123` login even though current code and database history have moved to a different admin model.

Action in this setup: replace the README with the current architecture and remove the default-password guidance.

### 4. Admin maintainability risk

`frontend/admin.js`, the script actually loaded by `admin.html`, is roughly 13,000 lines. An older `frontend/js/admin.js` remains present but is not loaded. Admin CSS is similarly layered across large base and upgrade files.

Impact: small changes have a large regression surface and contributors may edit the wrong file.

Action: freeze behavior, add browser/API tests, extract by module, then remove confirmed legacy code.

### 5. Security review candidates

Evidence observed during structural inspection:

- the upload route uses JWT verification but does not currently reload active-account/role state;
- upload validation trusts the request MIME declaration and should also verify file signatures/content;
- existing static images are served by an early middleware before Helmet and again later after Helmet;
- frontend JavaScript contains many HTML-rendering sinks that need source-by-source escaping review;
- third-party admin chart/export scripts load from CDNs and need availability/integrity/CSP decisions;
- session revocation and other Endgame security items remain open.

These are candidates for the dedicated Endgame security pass, not claims that the whole application is compromised.

### 6. Deployment and asset ambiguity

`PROJECT.md` identifies Cloudflare Pages as frontend hosting, while root and frontend Firebase hosting files remain tracked. The frontend tree also contains runtime upload files and the backend tree contains a smaller duplicate `backend/frontend/images` set.

Impact: cleanup or deployment work could target the wrong provider or delete live content assumptions.

Action: confirm provider source of truth, inventory assets, and define persistent upload/database backup and restore procedures before removal.

## Strengths Already Present

- Explicit CORS allowlist and development origins.
- Helmet and `x-powered-by` disabled.
- API no-store caching policy and body-size limits.
- General API and auth/signup-specific rate limiting.
- JWT verification plus active-account and role middleware for most protected operations.
- Parameter placeholders are widely used for SQL values.
- Production database configuration requires explicit values and supports TLS.
- Persistent-upload storage is required in production.
- Password reset tokens are random, hashed in storage, expiring, single-use, and transactionally consumed.
- Existing Endgame, project, and memory documents contain useful production knowledge.

## Verification Gaps Remaining

- No local database was provisioned, so server startup and route behavior were not exercised.
- No production or staging deployment was opened or mutated.
- Dependency advisories were not queried from the network.
- No accessibility, cross-browser, responsive visual, performance, SEO crawler, or full security scan was run.
- Backup and restore were not tested.

These gaps are intentionally carried into `ROADMAP.md` instead of being represented as completed work.
