# TravelorAI

Travel platform for Uzbekistan: public website + agency CRM + admin panel
(`website/`, Next.js), API (`backend/`, Express + Prisma + PostgreSQL + Redis),
Android app (`mobile/`, Expo bare) and a Windows CRM shell (`desktop/`, Tauri v2).

| Dir | Stack | Local port |
|---|---|---|
| `backend/` | Node 20, Express 4, Prisma 5, PostgreSQL 16, Redis 7 | 4000 |
| `website/` | Next.js 16, React, TypeScript | 3000 |
| `mobile/` | Expo SDK 54, Expo Router | 8081 (Metro) |
| `desktop/` | Tauri v2 (loads https://travelorai.com/agency) | — |

Agent/deploy rules: **read [`AGENTS.md`](AGENTS.md) first.**
Production deploy: `scripts/deploy-backend.sh`, `scripts/deploy-website.sh`,
`scripts/rollback.sh` (never by hand, never with docker compose).

---

## Run locally

Requirements: Node.js 20 LTS, Git, and either **Docker Desktop** (option A)
or a native **PostgreSQL 16** (option B). Commands below are for
**Windows PowerShell**; on macOS/Linux use `cp` instead of `Copy-Item`.

Local ports (all on 127.0.0.1, configurable in the root `.env`):

| Service | Host port | Why not the default |
|---|---|---|
| PostgreSQL | **5435** | 5432/5433 are often taken by other local Postgres |
| Redis | **6381** | 6379/6380 likewise |
| Backend API | 4000 | |
| Website | 3000 | |

### Option A — everything in Docker Desktop

```powershell
git clone https://github.com/KSultonboy/TravelorAI.git
cd TravelorAI

# 1. Root .env for docker compose (gitignored). Fill ADMIN_USERNAME,
#    ADMIN_PASSWORD, ADMIN_SESSION_SECRET, ADMIN_SECRET_KEY — there are no
#    defaults and compose refuses to start without them.
Copy-Item .env.example .env
notepad .env
#    random values: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Optional: backend/.env for API keys (SMTP, Google, Yandex ...).
#    DATABASE_URL / REDIS_URL from it are ignored inside compose.
Copy-Item backend\.env.example backend\.env

# 3. Start postgres + redis + backend + website
docker compose up -d --build

# 4. Create the schema and demo data (first time, and after pulling new migrations)
docker compose exec backend npm run db:setup:dev
docker compose exec backend npm run db:seed
```

Open http://localhost:3000 (website), http://localhost:3000/admin (admin, with
the `ADMIN_USERNAME`/`ADMIN_PASSWORD` from `.env`), and
http://localhost:4000/api/v1/health (API).

Useful:

```powershell
docker compose logs -f backend website
docker compose restart backend
docker compose build backend          # after backend/package.json changes
docker compose down                   # stop (data kept)
docker compose down -v                # stop and DELETE the local database
cd backend; npx prisma studio         # DB GUI (needs backend/.env DATABASE_URL pointing to 127.0.0.1:5435)
```

Source code is bind-mounted: backend restarts on save (nodemon), the website
hot-reloads (`next dev`).

> If you already run standalone containers on 5435/6381 (e.g.
> `travelorai-dev-postgres` / `travelorai-dev-redis`), either stop them, change
> `TRAVELORAI_PG_PORT` / `TRAVELORAI_REDIS_PORT` in `.env`, or use option B
> with those containers as the database.

### Option B — without Docker (native PostgreSQL)

1. Install PostgreSQL 16 (Windows installer from postgresql.org) and create the
   database (psql as the `postgres` superuser):

   ```sql
   CREATE USER travelorai WITH PASSWORD 'travelorai_pass';
   CREATE DATABASE travelorai_db OWNER travelorai;
   ```

   Redis is optional for development — the backend starts and serves without it.
   (Or run only the databases in Docker: `docker compose up -d postgres redis`.)

2. Backend:

   ```powershell
   cd backend
   npm ci
   Copy-Item .env.example .env
   notepad .env
   ```

   In `backend/.env` set at least:

   ```dotenv
   NODE_ENV=development
   HOST=0.0.0.0
   PORT=4000
   # native Postgres on 5432 — or 127.0.0.1:5435 if Postgres runs in compose
   DATABASE_URL=postgresql://travelorai:travelorai_pass@127.0.0.1:5432/travelorai_db
   REDIS_URL=redis://127.0.0.1:6381
   ADMIN_SECRET_KEY=<same value as in website/.env.local>
   ```

   ```powershell
   npx prisma generate
   npm run db:setup:dev      # schema (migrations + manual migrations)
   npm run db:seed           # demo data
   npm run dev               # http://localhost:4000/api/v1/health
   ```

3. Website (new terminal):

   ```powershell
   cd website
   npm ci
   notepad .env.local
   ```

   Minimal `website/.env.local`:

   ```dotenv
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
   ADMIN_API_URL=http://localhost:4000/api/v1
   AGENCY_API_URL=http://localhost:4000/api/v1
   ADMIN_SECRET_KEY=<same value as backend/.env>
   ADMIN_USERNAME=<your local admin login>
   ADMIN_PASSWORD=<your local admin password>
   ADMIN_SESSION_SECRET=<32+ random characters>
   # optional: NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=
   ```

   ```powershell
   npm run dev               # http://localhost:3000
   ```

### Mobile (Android, against your local backend)

The phone cannot reach `localhost` of your PC — use the PC's LAN IP.

1. Find the IP: `ipconfig` → "IPv4 Address" of your Wi-Fi adapter, e.g. `192.168.1.25`.
2. Make the backend reachable on the LAN:
   - Docker (option A): set `TRAVELORAI_BACKEND_BIND=0.0.0.0` in the root `.env`,
     then `docker compose up -d backend`.
   - Native (option B): `HOST=0.0.0.0` in `backend/.env`.
   - Allow inbound TCP 4000 in Windows Defender Firewall for **Private** networks
     only; the phone must be on the same Wi-Fi.
3. Configure and start the app:

   ```powershell
   cd mobile
   npm ci
   Copy-Item .env.example .env
   # in mobile/.env:
   #   EXPO_PUBLIC_API_URL=http://192.168.1.25:4000/api/v1
   npm run start:dev         # needs the TravelorAI dev-client build on the phone
   ```

   Check from the phone's browser first: `http://192.168.1.25:4000/api/v1/health`.
   **Never publish an OTA update (`eas update`) from a machine whose
   `mobile/.env` points to a LAN IP** — see AGENTS.md §5.

### Desktop CRM

See [`desktop/README.md`](desktop/README.md).

---

## Checks (same as CI)

```powershell
cd backend; npm ci; npx prisma generate; npx jest --coverage=false
cd website; npm ci; npx tsc --noEmit; npx next build
cd mobile;  npm ci; npx tsc --noEmit
```

CI: `.github/workflows/ci.yml` (website lint runs as a separate non-blocking job).

## Secrets

Never commit `.env*` (except `*.env.example`), `credentials.json`, keystores,
SSH keys, the Tauri updater key or Google service-account JSON. Production
runtime secrets live only on the server (`/app/.env` inside `voyageai_backend`,
`/root/travelorai-admin.env` for the website).
