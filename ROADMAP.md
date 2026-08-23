# Klinik Putrijaya Delivery Roadmap

_Established 2026-08-13 from `main` at `d07b077`._

The project remains in Endgame. Reliability, patient/staff workflow correctness, security, recovery, and maintainability come before major new features or AI integrations.

## Success Definition

The current release is ready to freeze when:

- a fresh database and a restore can be reproduced from versioned instructions;
- critical public/admin journeys pass on desktop and mobile;
- authorization, upload, patient-data, and authentication risks have been reviewed and critical findings fixed;
- MySQL and uploaded images have tested backup/restore procedures;
- every PR runs baseline checks and critical flows have automated coverage;
- deployment ownership, rollback, and monitoring are documented;
- no P0/P1 item below remains open.

## Milestone 0 — Reproducible Foundation (P0)

| Item | Outcome | Acceptance evidence | Status |
|---|---|---|---|
| Canonical database baseline | One documented schema plus ordered migrations for local/staging/production | Fresh disposable DB build and schema verification pass | Not started |
| Migration runner/history | Applied migrations are recorded and environment names are configurable | Repeat run is safe; `USE railway` removed from future workflow | Not started |
| Admin bootstrap | Secure first-admin process replaces legacy default credentials | Fresh environment can create one superadmin without a committed password | Not started |
| Baseline repository checks | All JS/JSON/local HTML references and secret filenames checked | `npm run check --prefix backend` and CI pass | Added; verify in first PR |
| Test foundation | API test harness with isolated test DB | Health, auth, role denial, booking validation, and one CRUD flow pass | Not started |
| Deployment source of truth | Frontend provider and release path confirmed | Cloudflare/Firebase decision and rollback steps recorded | Not started |

## Milestone 1 — Production QA and Critical Security (P0/P1)

Use `ENDGAME.md` as the detailed manual checklist.

1. Run the public/admin/mobile production QA matrix and record PASS/FIX/RETEST evidence.
2. Add browser end-to-end coverage for navigation, services, appointment submission, admin login, role access, booking status, and one content CRUD flow.
3. Review every protected endpoint against the role matrix using direct API tests.
4. Add active-account/role enforcement and content-signature validation to uploads.
5. Audit all DOM HTML sinks and eliminate unsafe rendering of API/user content.
6. Verify auth/reset/booking/feedback rate limits, password policy, JWT lifetime, and disabled-account behavior.
7. Decide CSP and third-party admin dependency strategy.
8. Confirm production CORS, proxy trust, Helmet/static middleware order, error logging, and patient-data minimization.

Exit criteria: no unresolved critical/high security issue and every critical public/admin journey has recorded evidence.

## Milestone 2 — Recovery and Operations (P1)

1. Document MySQL backup schedule, retention, encryption, owners, and restore commands.
2. Back up persistent uploads separately and test a restore with database references intact.
3. Document Railway rollback, environment/volume verification, and health checks.
4. Document frontend rollback for the confirmed hosting provider.
5. Define monitoring for API health, error rate, booking failures, email failures, storage capacity, and database availability.
6. Create a short incident runbook for account compromise, data exposure, bad release, and lost uploads.

Exit criteria: a non-production restore drill succeeds and a rollback owner can follow the runbook without relying on unwritten knowledge.

## Milestone 3 — Maintainability (P1/P2)

1. Freeze admin behavior with tests, then split `frontend/admin.js` by authentication, bookings, performance, content, services, activities, and users.
2. Consolidate admin CSS and reduce override/`!important` layers without redesigning approved screens.
3. Confirm and remove the unused `frontend/js/admin.js`, `index-backup.html`, `admin-diff.txt`, duplicate `backend/frontend` assets, and other stale files.
4. Add consistent lint/format tooling with a reviewable one-time formatting strategy.
5. Split the largest backend routes into handlers/services/repositories with focused tests.
6. Introduce an asset manifest/lifecycle so runtime uploads are not casually committed as source assets.
7. Replace duplicated API-base literals with one deployment-controlled configuration path.

Exit criteria: routine changes touch focused modules, checks remain fast, and legacy removals are proven by tests and production smoke checks.

## Milestone 4 — Release, Observe, and Improve (P2)

1. Complete SEO/indexing pass and production smoke test.
   The public KP Content OS product, terms and bilingual privacy pages are now
   included in the source and require production URL verification during the
   next release smoke test.
2. Tag a release and begin a controlled development freeze.
3. Observe real usage for two to four weeks.
4. Review booking completion, failures, page performance, admin friction, and staff feedback.
5. Prioritize a V2 backlog from observed evidence rather than assumptions.

## Post-Endgame Options (P3)

Only after the freeze criteria are met:

- staff knowledge assistant over approved clinic documentation;
- read-only operational summaries through narrowly scoped APIs;
- user-confirmed booking status actions;
- scheduled health/QA/analytics briefs;
- content workflow improvements backed by staff feedback.

Never expose a generic SQL tool, production secrets, unrestricted patient records, or unconfirmed write actions to an AI integration.

## Working Backlog Rules

- Keep each work item tied to an observable user, staff, security, recovery, or operational outcome.
- Add owner, acceptance evidence, risk, and rollback notes before starting production-affecting work.
- Finish P0 before P2 unless the user explicitly changes priorities.
- Update this roadmap, `ENDGAME.md`, and `MEMORY.md` when a milestone changes state.
