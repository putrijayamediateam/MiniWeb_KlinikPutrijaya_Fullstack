# Klinik Putrijaya Website — ENDGAME.md

_Last updated: 2026-08-10_

The project is in the **Endgame** phase.

No major feature expansion should happen until this checklist is complete unless priorities are explicitly changed.

---

# Phase 1 — Production QA Audit

Status: **NEXT / IN PROGRESS**

Use these labels:

- PASS
- FIX
- RETEST
- N/A

## Public pages

- [ ] Homepage
- [ ] About
- [ ] Branches
- [ ] Cheras
- [ ] Sungai Besi
- [ ] Puchong
- [ ] Doctors
- [ ] Services — every active category
- [ ] Service detail — valid service
- [ ] Service detail — invalid/missing service
- [ ] Promotions
- [ ] Activities
- [ ] Little Shield
- [ ] Feedback
- [ ] Appointment
- [ ] KP Content OS product information
- [ ] KP Content OS Terms of Service — English and Bahasa Melayu
- [ ] KP Content OS Privacy Policy — English and Bahasa Melayu
- [ ] 404

## Public interactions

- [ ] Shared navigation desktop
- [ ] Shared navigation mobile
- [ ] Dynamic Services dropdown
- [ ] Service category pills
- [ ] Service filtering
- [ ] Branch/contact modal
- [ ] WhatsApp links
- [ ] Booking validation
- [ ] Booking submission
- [ ] Image/fallback behavior
- [ ] Homepage panel scroller
- [ ] Homepage counters
- [ ] Little Shield poster slider
- [ ] Promotions carousel

## Admin

- [ ] Login
- [ ] Logout
- [ ] Forgot/reset password
- [ ] Admin role access
- [ ] Manager role access
- [ ] Superadmin role access
- [ ] Admin Approvals
- [ ] Bookings
- [ ] Booking status updates
- [ ] Booking WhatsApp action
- [ ] Booking pagination
- [ ] Booking export
- [ ] Performance
- [ ] Feedback
- [ ] Doctors CRUD
- [ ] Services CRUD
- [ ] Service category CRUD
- [ ] Service subcategory CRUD
- [ ] Promotions CRUD
- [ ] Activities CRUD
- [ ] User Management
- [ ] Uploads
- [ ] Modal flows
- [ ] Error states

## Mobile / responsive

- [ ] Public header
- [ ] Homepage hero
- [ ] Little Shield
- [ ] Public cards/grids
- [ ] Admin login
- [ ] Admin header
- [ ] Admin tabs
- [ ] Admin actions
- [ ] Booking status/action columns
- [ ] Tables scroll only inside wrappers
- [ ] No body-level horizontal overflow

---

# Phase 2 — SEO / Indexing Final Pass

- [ ] HTTPS canonical domain
- [ ] HTTP → HTTPS
- [ ] `.html` / extensionless consistency
- [ ] canonical tags
- [ ] service-detail dynamic canonical
- [ ] `robots.txt`
- [ ] `sitemap.xml`
- [ ] noindex admin/auth/utility pages
- [ ] favicon
- [ ] page titles
- [ ] meta descriptions
- [ ] branch local SEO
- [ ] internal links
- [ ] KP Content OS product, terms and privacy footer links
- [ ] Search Console URL inspection
- [ ] reindex priority pages after final changes

---

# Phase 3 — Code Cleanup

- [ ] Remove dead CSS
- [ ] Remove duplicate CSS
- [ ] Reduce unnecessary `!important`
- [ ] Remove obsolete JavaScript helpers
- [ ] Remove stale comments
- [ ] Consolidate responsive rules where safe
- [ ] Remove unused legacy admin styles
- [ ] Run syntax checks
- [ ] Run `git diff --check`
- [ ] Regression-test public site
- [ ] Regression-test admin

Rule: cleanup must not redesign pages that are already approved.

---

# Phase 4 — Backup & Recovery

- [ ] Confirm MySQL backup strategy
- [ ] Export current production schema safely
- [ ] Secure production data backup procedure
- [ ] Upload/image backup strategy
- [ ] Restore test
- [ ] Railway rollback procedure
- [ ] Cloudflare Pages rollback procedure
- [ ] Document recovery steps
- [ ] Define backup retention

---

# Phase 5 — Security Pass

Current backend already includes Helmet, explicit CORS handling and a general API rate limiter. These are starting controls only; this phase verifies the full security model.

## Authentication

- [ ] Login-specific rate limiting
- [ ] Signup-specific rate limiting where applicable
- [ ] Forgot-password-specific rate limiting
- [ ] Public booking abuse/rate limiting
- [ ] Password policy
- [ ] JWT/session lifetime
- [ ] Logout/revocation behavior
- [ ] Password reset token security
- [ ] Disabled-account behavior
- [ ] MFA strategy for privileged accounts

## Authorization

- [ ] Audit every protected endpoint
- [ ] Admin cannot access Manager/Superadmin endpoints
- [ ] Manager cannot access Superadmin-only endpoints
- [ ] Direct API calls return 401/403 correctly
- [ ] Frontend visibility is never relied on for authorization

## Database

- [ ] Parameterized queries everywhere
- [ ] Least-privilege production DB user
- [ ] No direct browser-to-DB access
- [ ] No public database credentials
- [ ] Production DB network/access review

## Application security

- [ ] XSS review
- [ ] IDOR/BOLA review
- [ ] CORS production allowlist review
- [ ] Helmet/security-header review
- [ ] CSP feasibility
- [ ] upload MIME validation
- [ ] upload size limits
- [ ] safe/randomized filenames
- [ ] upload path traversal review
- [ ] production error handling
- [ ] no stack traces or sensitive internals sent to clients

## Patient information

- [ ] APIs return only necessary fields
- [ ] no unnecessary patient data in analytics
- [ ] no unnecessary patient data in URLs
- [ ] logging review
- [ ] browser storage review
- [ ] cache/no-store behavior review
- [ ] privileged data-access logging strategy

## Staff phishing / account security

- [ ] Staff bookmark official `/admin`
- [ ] Staff do not log in through links received by email/WhatsApp
- [ ] Password manager encouraged
- [ ] MFA on clinic email
- [ ] MFA on GitHub
- [ ] MFA on Cloudflare
- [ ] MFA on Railway
- [ ] privileged-account inventory

## Incident response

- [ ] Disable compromised staff account
- [ ] Revoke sessions/tokens
- [ ] Rotate affected secrets
- [ ] Inspect access/application logs
- [ ] Preserve evidence
- [ ] Restore clean data/system if necessary
- [ ] Document escalation/contact process

---

# Phase 6 — Final Release / Freeze

- [ ] All critical QA items passed
- [ ] SEO pass complete
- [ ] Cleanup regression-tested
- [ ] Backup restore proven
- [ ] Security pass complete
- [ ] Production version tagged
- [ ] Release notes written
- [ ] Development freeze begins
- [ ] Observe real usage for 2–4 weeks
- [ ] Collect staff feedback
- [ ] Plan V2 only after observation period

---

# Post-Endgame — V2 / AI Integration

Not part of Endgame.

Potential order:

1. Klinik Putrijaya Staff GPT / knowledge assistant
2. Read-only operational API tools
3. Controlled write actions
4. Scheduled/conditional operational agents

AI integrations must use narrowly scoped tools and must never receive unrestricted database access.
