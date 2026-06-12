# TravelorAI — Agent Rules (Codex, Claude, etc.)

**READ THIS FIRST. These rules are mandatory for all AI agents working in this repo.**

## 1. Git: which code is current

- The source of truth is the **`integration/full-merge`** branch (mirrored to local `main`).
- **Before ANY work:** `git fetch origin && git log --oneline -3 origin/integration/full-merge` — make sure your working tree contains those commits. If your checkout is behind, **STOP and update first**. Working on a stale base has already destroyed a day of work once.
- Never commit directly to `main` (it is protected on GitHub; changes go through PR).
- Do not leave work uncommitted. Commit to a feature branch and push.

## 2. Architecture facts (do not regress these)

- **Website agency portal is multi-page (portal v2):** `app/agency/{page,leads,tours,tours/new,tours/[id],profile}` + `components/agency/{AgencyShell,AuthScreen,OnboardingScreen,TourEditor,LeadsBoard,...}` + `lib/agency/{api,session,types}`.
  - `components/agency/AgencyPortal.tsx` (old 1500-line monolith) is **DELETED**. Never recreate or edit it.
- **Admin panel is multi-page:** `app/admin/{page,moderation,leads,agencies,places,stories,hero}` with `components/admin/AdminShell`. `LandingContentAdmin.tsx` is orphaned — do not extend it.
- Backend `server.js` uses `dotenv {override:true}`; runtime secrets live in the container's `/app/.env` (Google client allowlist, company SMTP). Do not remove.
- Agency Google login: backend route `POST /agency/auth/google` + `googleAuthSchema` + `AgencyAccount.googleId` — required for the website Google button.

## 3. Production deploy (178.18.245.174) — STRICT

- **Containers run under PODMAN**: `travelorai_website` (port 3100), `voyageai_backend` (4000). Postgres+redis run under snap-docker (moby) — do not touch.
- **NEVER create new containers, never `docker run`/`compose up` new instances.** The `docker` CLI on the server is symlinked to podman. Creating a second container on the same port causes a restart-policy port war that silently swallows deploys (this happened on 2026-06-12 and wiped live fixes).
- Correct website deploy:
  1. `podman cp <src.tar.gz> travelorai_website:/tmp/` then `podman exec travelorai_website sh -c "cd /app && tar xzf /tmp/src.tar.gz"`
  2. Build inside: `podman exec -e NODE_ENV=production -e NEXT_PUBLIC_SITE_URL=https://travelorai.com -e NEXT_PUBLIC_API_URL=https://travelorai.com/api/v1 -e NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=401741517790-11c61fghvchvld521kdi0fu4ee1mo2af.apps.googleusercontent.com travelorai_website sh -c "cd /app && node node_modules/next/dist/bin/next build"`
  3. `podman restart travelorai_website`
  4. Also sync the same files to `/opt/voyageai/website/` (host copy for future image builds).
- Correct backend deploy: same pattern with `voyageai_backend`; run `npx prisma generate && npx prisma migrate deploy` inside the container before restart. Keep `/app/.env` intact.
- After deploy ALWAYS verify: `curl -s localhost:4000/api/v1/health`, key pages return 200, and `podman ps` + `ctr -a /run/snap.docker/containerd/containerd.sock -n moby tasks list` show no duplicate port holders.
- `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` must be `401741517790-11c61f...` (NOT `65326209075-...` — that project is inaccessible).

## 4. Mobile

- Expo bare workflow. JS-only changes ship via OTA: `npx eas update --channel production --platform android -m "msg"` (runtimeVersion must stay `1.0.7` unless a new binary is released).
- Release AAB: `eas build -p android --profile production` (EAS keystore == Play upload key). versionCode is local-source in `android/app/build.gradle` — bump it for every Play upload.
- Never run local Gradle release builds — the upload keystore is EAS-managed.

## 5. Language & product

- UI text in Uzbek only (no i18n yet — explicit product decision). Free lead model: no payments, no commissions; booking must work for guests (name+phone, no forced auth).
