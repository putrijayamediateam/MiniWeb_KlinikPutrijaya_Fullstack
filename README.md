# Klinik Putrijaya — Mini Website (Extended)

This project extends the original static "MiniWeb_KlinikPutrijaya" site with a real
**Node.js + Express + MySQL backend**, turning it from a static informational page into
a full-stack web application. It's built for an Industrial Training report that needs to
demonstrate computing-based development: backend logic, a database, authentication, and
CRUD operations — not just front-end styling.

## What was added

| # | Feature | Where it lives |
|---|---------|-----------------|
| 1 | **Appointment Booking System** | "Book with us" section on the homepage → `bookings` table |
| 2 | **Admin Dashboard** (login + management) | `frontend/admin.html` |
| 3 | **Dynamic content from a database** | Doctors section now fetches live data from the API instead of hardcoded HTML |
| 4 | **Patient Feedback / Reviews** | "Patient voices" section, with admin moderation before display |
| 5 | **Search / filter** | Search box + branch dropdown above the Doctors section |

Under the hood this is a genuine 3-tier architecture:
- **Frontend**: the original HTML/CSS/JS site (unchanged visual identity), now calling a REST API
- **Backend**: Express.js REST API (`/backend`) with JWT authentication for admin routes
- **Database**: MySQL (schema in `backend/schema.sql`)

---

## 1. Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [MySQL](https://dev.mysql.com/downloads/) 8.x (or MariaDB) running locally or on a server
- A code editor and a terminal

---

## 2. Set up the database

```bash
# Log into MySQL and run the schema (creates DB, tables, and seed data)
mysql -u root -p --default-character-set=utf8mb4 < backend/schema.sql
```

> **Important:** use `--default-character-set=utf8mb4` or names like "Women's Health" and
> special characters (—, ') will get corrupted. This matches your DB's utf8mb4 charset.

This creates a `klinik_putrijaya` database with tables for branches, doctors, services,
bookings, feedback, and admin_users — pre-filled with the clinic's real content (branches,
doctors, services) taken from the original site.

**Default admin login:** username `admin`, password `admin123`.
Change this immediately after your first login (see Section 5).

---

## 3. Set up and run the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in your real MySQL credentials:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_NAME=klinik_putrijaya
JWT_SECRET=make_this_a_long_random_string
CORS_ORIGIN=http://localhost:5500
```

> `CORS_ORIGIN` must match whatever URL you'll open the frontend from (see step 4).
> If you use VS Code's "Live Server" extension, it's usually `http://127.0.0.1:5500`.

Install dependencies and start the server:

```bash
npm install
npm start
```

You should see:
```
Klinik Putrijaya API running on http://localhost:4000
```

Test it's alive: open `http://localhost:4000/api/health` in a browser — you should see
`{"status":"ok", ...}`.

---

## 4. Run the frontend

The frontend is still plain static files, so any static server works. Easiest options:

**Option A — VS Code Live Server extension**
Right-click `frontend/index.html` → "Open with Live Server".

**Option B — Python's built-in server**
```bash
cd frontend
python3 -m http.server 5500
```
Then open `http://localhost:5500/index.html`.

If your frontend runs on a different port/URL than what you set in `CORS_ORIGIN`, the
API calls will be blocked by the browser (CORS). Update `.env` and restart the backend
if needed.

> If you ever deploy the backend somewhere other than `localhost:4000`, update
> `API_BASE` at the top of `frontend/js/api.js` (or set `window.KP_API_BASE` before
> that script loads).

---

## 5. Using the Admin Dashboard

Go to `http://localhost:5500/admin.html` (also linked at the bottom of the homepage
footer as "Staff login").

Log in with the default credentials (`admin` / `admin123`), then:
- **Bookings** — view all appointment requests, change status (pending → confirmed →
  completed/cancelled), delete
- **Feedback** — approve patient reviews before they appear publicly, or delete spam
- **Doctors** — add/edit/deactivate/delete doctors (changes appear live on the homepage)
- **Services** — same CRUD for services

To change the admin password, call the API directly once logged in (there's no UI for
this yet — a good improvement to mention in your report as future work):
```bash
curl -X POST http://localhost:4000/api/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"your_new_password"}'
```

---

## 6. Project structure

```
backend/
  server.js          # Express app entry point
  db.js              # MySQL connection pool
  schema.sql          # Database schema + seed data
  .env.example        # Environment variable template
  middleware/
    auth.js           # JWT verification middleware
  routes/
    auth.js           # Admin login
    branches.js        # GET branches
    doctors.js          # GET (public, search/filter) + POST/PUT/DELETE (admin)
    services.js          # GET (public) + POST/PUT/DELETE (admin)
    bookings.js           # POST (public) + GET/PUT/DELETE (admin)
    feedback.js            # POST + GET approved (public) + moderation (admin)

frontend/
  index.html          # Main site (booking + feedback sections added, doctors now dynamic)
  admin.html           # Staff dashboard
  js/
    api.js              # Shared fetch wrapper for talking to the backend
    site-dynamic.js      # Doctors search/filter, booking form, feedback logic
    admin.js               # Dashboard login, tables, CRUD modals
  css/
    admin.css              # Dashboard styling (matches the site's brand colours)
  images/                  # Unchanged
```

---

## 7. How this maps to "computing-based development"

For your report, here's the honest breakdown of what each feature demonstrates:

- **Backend/server-side programming**: Express routes with input validation (e.g. phone
  number format, future-date checks for bookings, rating range checks for feedback)
- **Database design**: a normalized MySQL schema with foreign keys (branches → doctors,
  branches/doctors/services → bookings) and enum-based status fields
- **Authentication & authorization**: JWT-based login, protected admin routes, bcrypt
  password hashing
- **CRUD operations**: full create/read/update/delete for doctors and services, plus
  create/read/update(status)/delete for bookings and feedback
- **Dynamic, data-driven front end**: the doctors section (and booking dropdowns) are no
  longer hardcoded — they reflect whatever's in the database
- **Search/filter logic**: client-driven query parameters (`?q=` and `?branch=`) handled
  server-side with parameterized SQL (protecting against SQL injection)

## Notes / possible improvements to mention as "future work"

- Doctor photo uploads (currently just a text path to an image file)
- Email/SMS notifications when a booking is confirmed
- Pagination for the bookings/feedback tables once data grows
- A proper "forgot password" flow for admin accounts
- HTTPS + a real deployed hosting environment (currently designed for local development)
