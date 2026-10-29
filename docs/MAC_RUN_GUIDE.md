# Mac Run Guide (Website + KPOne)

How to run both projects on a Mac for local editing. Nothing here touches production. The website and KPOne are separate apps with separate databases.

| | Website (this repo) | KPOne |
|---|---|---|
| Stack | Static HTML/JS + Node 24 + MySQL | Laravel 13 + Vue/Inertia + PostgreSQL 18 |
| Frontend URL | http://127.0.0.1:5500 | http://localhost:8000 |
| API | http://localhost:4000/api | same app (Laravel) |

## 0. Common tools (once)

```bash
xcode-select --install
```

```bash
brew install git
```

```bash
brew install --cask visual-studio-code
```

```bash
mkdir -p ~/Projects && cd ~/Projects
```

```bash
git clone https://github.com/putrijayamediateam/MiniWeb_KlinikPutrijaya_Fullstack.git
```

```bash
git clone https://github.com/putrijayamediateam/KPOne.git
```

## 1. Website

### Install

```bash
brew install node@24 mysql
```

```bash
brew link --overwrite --force node@24
```

```bash
node -v   # must print v24.x
```

```bash
cd ~/Projects/MiniWeb_KlinikPutrijaya_Fullstack
```

```bash
cp backend/.env.example backend/.env
```

```bash
npm install --prefix backend
```

Edit `backend/.env` (never commit it). For local use set `NODE_ENV=development`, `DB_HOST=localhost`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=klinik_putrijaya_local`, and a long random `JWT_SECRET`. Leave `RESEND_API_KEY`, `SMTP_*` blank so no real emails are sent.

### Option 1: edit content and layout only (no database)

The pages are static, so you can edit HTML/CSS/JS and view them without the backend:

```bash
python3 -m http.server 5500 -d frontend
```

Open http://127.0.0.1:5500/. Never open the HTML files with `file://`.

Pages that load data (services, doctors, promotions, activities, booking) call the API URL set in `frontend/js/api.js`, which points at the production Railway backend. The production CORS list may block `localhost:5500`, so these sections can show empty or error states locally. That is expected and is not a bug in your change.

### Option 2: full local stack (needs a local database)

There is no one-command database setup yet. This is the P0 item in `ROADMAP.md`, and `backend/schema.sql` alone does not match production (`admin_users` vs `admins`). Only choose this if you have a verified backup of the production database to restore into a disposable local database:

```bash
brew services start mysql
```

```bash
mysql -u root -e "CREATE DATABASE klinik_putrijaya_local CHARACTER SET utf8mb4;"
```

Then restore your backup into `klinik_putrijaya_local` only. Check `database/07_booking_gender_identity.sql` first: it contains `USE railway;`, so do not run it unedited.

Run the backend and frontend in two terminals:

```bash
npm run dev --prefix backend
```

```bash
python3 -m http.server 5500 -d frontend
```

- Site: http://127.0.0.1:5500/
- Admin: http://127.0.0.1:5500/admin.html
- Health: http://localhost:4000/api/health (needs the database)

Pointing `frontend/js/api.js` at `http://localhost:4000/api` for local testing is fine, but do not commit that change.

### Check before committing

```bash
npm run check --prefix backend
```

## 2. KPOne

### Install

```bash
brew install php@8.4 composer node postgresql@18
```

```bash
brew services start postgresql@18
```

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

On an Intel Mac replace `/opt/homebrew` with `/usr/local`. PHP needs `pdo_pgsql`, `intl`, `sodium`, `mbstring`; the Homebrew build includes them. Verify with `php -m | grep -E "pdo_pgsql|intl|sodium"`.

### Database

```bash
psql postgres -c "CREATE ROLE kpone LOGIN PASSWORD 'choose-a-local-password';"
```

```bash
psql postgres -c "CREATE DATABASE kpone OWNER kpone ENCODING 'UTF8';"
```

### App

```bash
cd ~/Projects/KPOne
```

```bash
cp .env.example .env
```

Edit `.env`: set `DB_PASSWORD` to the password above. Leave `GOOGLE_CLIENT_*` blank unless you are testing Google sign-in.

```bash
composer install
```

```bash
npm ci
```

```bash
php artisan key:generate
```

```bash
php artisan migrate --seed
```

### Run

```bash
composer run dev
```

Open http://localhost:8000. In `local` only, the seeder creates a fictional account: `dev.admin@kpone.test` / `KPOne-Dev-Only!`. Never use this account in production.

To create a real first Director on an empty local database, run `php artisan kpone:bootstrap-director`.

### Check before committing

```bash
composer lint
```

```bash
php artisan test
```

The default test run uses in-memory SQLite. PostgreSQL contention tests are skipped locally and run in CI.

## 3. Running both together

Run them side by side: website on port 5500 (API on 4000), KPOne on 8000. They use different databases, so there are no conflicts. The planned website-from-KPOne content API will be added to KPOne and consumed by `frontend/js/api.js`.

## 4. Safety rules

- Never commit `.env` files, database dumps or real patient data.
- Do not apply SQL or migrations to production from your Mac.
- Use synthetic data in KPOne. Its rules forbid real patient data in local or test environments.
