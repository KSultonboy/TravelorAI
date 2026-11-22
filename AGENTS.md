# TravelorAI — Agent Rules (Codex, Claude, humans)

**READ THIS FIRST. These rules are mandatory for everyone working in this repo.**
Last rewritten: 2026-11-22 (after the production audit).

## 1. Git: which code is current

State on 2026-11-22 (verify with the commands below — this changes):

- `origin/integration/full-merge` is the historical integration branch, but it is
  **behind** the real work: `codex/crm-finance-visual-hierarchy` is 74 commits
  ahead of it and `fix/critical-auth-bugs` (which contains the finance branch)
  is 76 ahead. `origin/main` has 2 commits that are not in
  `integration/full-merge` and lacks 169 that are.
- **The lead engineer will reconcile these into one main line.** Until that is
  announced here, branch from `fix/critical-auth-bugs` and do not merge or
  rebase the long-lived branches yourself.
- Before ANY work:
  ```bash
  git fetch origin
  git log --oneline -5 origin/fix/critical-auth-bugs origin/integration/full-merge
  git rev-list --left-right --count origin/integration/full-merge...HEAD
  ```
  If your checkout lacks commits that are on the branch you are based on,
  **STOP and update first** — working on a stale base has destroyed work before.
- Never commit directly to `main` (protected; changes go through PRs).
- Do not leave work uncommitted. Commit to a feature branch and push.
- CI (`.github/workflows/ci.yml`) must be green: backend jest, website
  `tsc` + `next build`, mobile `tsc`. Website lint is reported but non-blocking.

## 2. Architecture facts (do not regress these)

- **Agency CRM = one component:** `website/components/agency/KvCabinet.tsx`,
  mounted by `website/app/agency/page.tsx` (+ `app/agency/reset-password`).
  Helpers: `components/agency/{CrmCompetitionPages,ExecutiveReportsPage}.tsx`,
  `lib/agency/*`. The multi-page "portal v2" (`app/agency/{leads,tours,profile}`,
  `AgencyShell`, `LeadsBoard`, ...) was **removed on 2026-07-13** and the old
  `AgencyPortal.tsx` monolith before that. Do not recreate either.
- **Admin panel** (`website/app/admin/`): `page` (dashboard), `billing`,
  `bookings`, `feedback`, `listings`, `partners`, `partners/new`, `reports`,
  `tariffs`, `users`, plus `login`. Admin login is checked by the website
  (`/api/admin-auth/*`) against `ADMIN_USERNAME`/`ADMIN_PASSWORD` — there are no
  default credentials anywhere; production rejects weak values.
- Backend `server.js` uses `dotenv {override:true}`; runtime secrets live in
  `/app/.env` inside the `voyageai_backend` container (Google client allowlist,
  SMTP, JWT secrets). Do not remove that mechanism. In production the backend
  refuses to start with missing/weak secrets (`backend/src/config/env.js`).
- Agency Google login: `POST /api/v1/agency/auth/google` + `googleAuthSchema` +
  `AgencyAccount.googleId` — required for the website Google button.
- Desktop (`desktop/`, Tauri v2) is a thin shell around
  `https://travelorai.com/signin?as=agency` → `/agency`. Only 4 app commands are
  exposed to the remote page, only on `/agency*` and `/signin*`; installing an
  update or opening a saved file needs a native user confirmation. See
  `desktop/README.md` before touching it.
- Local development: `docker-compose.yml` + root `.env` (README "Run locally").
  That compose file is **dev only** — it is never used on the server.

## 3. Production (178.18.245.174, ssh alias `rux-backend`) — STRICT

The server is **shared with unrelated projects** (beautly, depiloved,
maftunimtour, n8n, ruxshona-erp). Touch only TravelorAI containers, images,
files and nginx vhost. Never prune/restart by broad filters.

| What | How it runs |
|---|---|
| `voyageai_backend` | podman, `--network host --restart unless-stopped -v /root/travelorai-uploads:/app/uploads`, `node server.js` on 127.0.0.1:4000, secrets in `/app/.env` inside the container |
| `travelorai_website` | podman, `--network host --restart unless-stopped --env-file /root/travelorai-admin.env`, `next start` on 127.0.0.1:3100 |
| PostgreSQL 16 (5433), Redis (6380) | snap-docker (moby) — **do not touch** |
| nginx | host nginx + certbot TLS. Canonical config: `ops/nginx/travelorai.com.conf` |
| Images | `localhost/voyageai_backend:*`, `localhost/voyageai_website:*` |

- **NEVER create a second container on the same port.** The `docker` CLI on
  the server is symlinked to podman; a second holder of 4000/3100 causes a
  restart-policy port war that silently swallows deploys (2026-06-12: live
  fixes were wiped). Never `docker run` / `docker compose up` TravelorAI on the
  server. The deploy scripts check for foreign port holders and abort.

### Deploy — only with the scripts

From a developer machine with `ssh rux-backend` access, at the repo root:

```bash
scripts/deploy-backend.sh --dry-run <git-ref>   # read-only preflight + plan
scripts/deploy-backend.sh <git-ref>
scripts/deploy-website.sh --dry-run <git-ref>
scripts/deploy-website.sh <git-ref>
scripts/rollback.sh backend --list              # images + deploy history
scripts/rollback.sh backend [image-tag]         # default: newest pre-deploy-*
```

What they do (`scripts/lib/remote.sh`): `git archive` of the committed
`backend/` or `website/` at the ref (uncommitted changes are never deployed) →
upload → `podman commit` snapshot `:pre-deploy-<ts>` → build
`:deploy-<ts>-<sha>` FROM that snapshot (old source wiped, `/app/.env`,
uploads and `public/desktop/*.exe` kept; backend `npm ci --omit=dev` +
`prisma generate`; website `npm ci` + `next build` with the production
`NEXT_PUBLIC_*`) → backend only: `pg_dump` backup, then
`prisma migrate deploy` in a one-off container, abort on failure → `podman rm -f`
+ `podman run` with the identical flags → health check
(`127.0.0.1:4000/api/v1/health` / `127.0.0.1:3100/` must be 200 within 90 s)
→ **automatic rollback** to the snapshot if unhealthy → keep last 5 images.
History: `/root/travelorai-deploy/history.log` on the server.

- Website build values (public, not secrets): `NEXT_PUBLIC_SITE_URL=https://travelorai.com`,
  `NEXT_PUBLIC_API_URL=https://travelorai.com/api/v1`,
  `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=401741517790-11c61fghvchvld521kdi0fu4ee1mo2af.apps.googleusercontent.com`
  (NOT `65326209075-...` — that Google project is inaccessible).
- Migrations are not reverted by a rollback: every migration must be
  backward compatible with the previous release (expand → deploy → contract).
- **Migration baseline (production).** Until 2026-11-22 the production
  `_prisma_migrations` table was empty although the schema already matched the
  repo (tables were created by hand / `db push`). On 2026-11-22 the three
  `20261122*` migrations were applied with psql and every migration folder was
  marked applied with `prisma migrate resolve --applied`. From then on
  `migrate deploy` only runs new folders. The deploy script refuses to migrate a
  database whose `_prisma_migrations` is empty. Production also has extra columns
  not in `schema.prisma` (`Tour.discount`, `priceBasisPeople`, `priceLockMinutes`,
  `priceLockUntil`, `Feedback.status`): never generate a migration that drops them
  without checking the data first (`prisma migrate diff` from the prod URL shows them).
- **Website admin env** (`/root/travelorai-admin.env`, passed with `--env-file`):
  `ADMIN_USERNAME` ≥ 12 chars, `ADMIN_PASSWORD` ≥ 12 chars, `ADMIN_SESSION_SECRET`
  ≥ 32 random chars, none of them a known default — otherwise the admin login
  returns 503 in production.
- The website's server-side proxies must reach the backend on loopback
  (`HOME_API_URL` / `AGENCY_API_URL` / `ADMIN_API_URL` = `http://127.0.0.1:4000/api/v1`);
  going through the public URL makes every user look like the server's own IP.
- The old in-place method (`podman cp` + `podman exec ... next build` +
  `podman restart`) is retired: it left no rollback point.

### Verify after any change

```bash
ssh rux-backend 'curl -s -o /dev/null -w "%{http_code}\n" 127.0.0.1:4000/api/v1/health;
  curl -s -o /dev/null -w "%{http_code}\n" 127.0.0.1:3100/;
  podman ps --filter name=voyageai_backend --filter name=travelorai_website;
  ss -ltnp "( sport = :4000 or sport = :3100 )"'
```

Exactly one listener per port. Also check `https://travelorai.com/api/v1/health`.

### Recovery: container stuck in "stopping" (podman 4.9.3 bug)

After a crash podman may leave a container in `stopping`, so `podman restart`
/ `stop` hang and nothing listens. Recovery used on 2026-11-22:

```bash
C=voyageai_backend; R=localhost/voyageai_backend      # or travelorai_website / localhost/voyageai_website
TS=$(date -u +%Y%m%d-%H%M%S)
podman commit --pause=false $C $R:recovery-$TS        # keep current state incl. /app/.env
podman rm -f $C
ss -ltnp "sport = :4000"                              # must be empty (3100 for website)
podman run -d --name $C --network host --restart unless-stopped \
  -v /root/travelorai-uploads:/app/uploads $R:recovery-$TS
# website: podman run -d --name travelorai_website --network host --restart unless-stopped \
#   --env-file /root/travelorai-admin.env localhost/voyageai_website:recovery-$TS
curl -s 127.0.0.1:4000/api/v1/health
```

Prefer `scripts/rollback.sh` when a known-good image exists. Never "fix" it by
starting a second container. If a `podman restart`/`stop` hangs (e.g. in
`ops/vps/set-resend-smtp.ps1`), do not retry it in a loop — use the procedure
above. Note: edits made inside a running container (e.g. `/app/.env`) live
only in that container until the next deploy/snapshot commits them — the
deploy scripts snapshot first, so they are preserved.

### Backups

Daily `pg_dump` at 03:30 Asia/Tashkent via systemd timer
(`ops/backup/`, install steps in `ops/backup/README.md`) to
`/root/backups/travelorai/` (14 daily, 8 weekly, 10 manual). Deploying the
backend requires it to be installed (or `--skip-backup`).

### nginx

Edit `ops/nginx/travelorai.com.conf` in the repo, then apply by hand on the
server (`nginx -t` before `systemctl reload nginx`; keep certbot's ssl lines).
It contains HTTPS redirect, HSTS, security headers, gzip and rate limits on
credential endpoints.

## 4. Desktop releases

Installers go to GitHub Releases (public releases repo) via
`desktop/publish-update.sh`; only `website/public/desktop/latest.json` lives in
git and is served by the website (the updater endpoint
`https://travelorai.com/desktop/latest.json` must not change). Never commit
`.exe` files. The updater signing key is password-protected and kept out of
the repo (password manager + offline backup).

## 5. Mobile (Expo bare, Android)

- **OTA (`eas update`) is for JS-only changes.** Runtime version is
  `runtimeVersion` in `mobile/app.json` (currently `1.0.7`).
  **Any native change — new/updated native module, Expo SDK bump,
  `app.json` plugin/permission change, anything under `android/` — requires
  bumping `runtimeVersion` and shipping a new binary.** Publishing JS that needs
  native code to an old runtime crashes installed apps.
- Publish OTA only from a clean checkout with the production `mobile/.env`
  (`EXPO_PUBLIC_API_URL=https://travelorai.com/api/v1`): `eas update` bundles
  the local env into every user's app.
  `npx eas update --channel production --platform android -m "msg"`
- Release AAB: `eas build -p android --profile production` (EAS keystore ==
  Play upload key). `versionCode` is local-source in `android/app/build.gradle`
  — bump it for every Play upload.
- Never run local Gradle release builds — the upload keystore is EAS-managed.

## 6. Language & product

- UI text in Uzbek only (no i18n yet — explicit product decision).
- Booking must work for guests (name + phone, no forced auth).

## 7. Secrets

Never commit or print secrets: `.env*` (except `*.env.example`),
`credentials.json`, keystores, SSH keys, the Tauri updater key, service-account
JSON. Production secrets exist only on the server.
