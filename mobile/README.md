# TravelorAI Mobile

Android app (Expo SDK 54, bare workflow, React Native 0.81, expo-router 6) for
**TravelorAI** — a catalogue of verified travel-agency tours.

What the app does today:

- Browse tours published by verified agencies (home feed + full catalogue with search, filters, pagination).
- Open a tour, see the package details, contact the agency (Telegram / WhatsApp / phone / site).
- Send a **free booking request** (name + phone is enough, no account needed). The agency contacts the traveller.
- With an account: track requests in **"Bron so'rovlarim"**, keep a wishlist (tours ♥), edit the profile.
- Email/password and Google sign-in, uz / ru / en UI.

There is **no** AI route planner, map or payment in the app (those were removed).

## Project layout

| Path | Purpose |
| --- | --- |
| `app/` | expo-router screens (`(tabs)/` = Home, Tours, Bookings, Profile) |
| `src/auth/AuthContext.tsx` | session (token + user) loaded once; central 401 → logout → `/login` |
| `src/hooks/useWishlist.tsx` | shared wishlist provider (server when logged in, local for guests) |
| `src/utils/api.ts` | axios client, API URL resolution, API wrappers |
| `src/utils/tourCache.ts` | in-memory tour cache + fetch-by-id for deep links |
| `src/utils/bookingValidation.ts` | +998 phone, DD.MM.YYYY date, 1–50 travellers |
| `src/i18n/` | `uz` (default), `ru`, `en` strings |
| `android/` | tracked native project (package `com.komiljonov.voyageai`) |

## Environment variables

Copy `.env.example` to `.env` for local development. Only `EXPO_PUBLIC_*` values reach the JS bundle.

| Variable | Notes |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Backend base URL incl. `/api/v1`. **Release builds only accept `https://`**; anything else (or unset) falls back to `https://travelorai.com/api/v1`. |
| `EXPO_PUBLIC_API_PORT` | Dev only. Port used for automatic local backend discovery (default `4000`). |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google web client id (used by native Google Sign-In to mint the ID token). |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Legacy alias of the web client id. |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID[_DEBUG/_RELEASE]` | Android OAuth clients (package + SHA-1); presence enables the Google Sign-In config plugin. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Only needed if an iOS build is ever made. |
| `EXPO_PUBLIC_APP_STAGE` | Optional. `production` hides the "test mode" banner (release bundles hide it anyway). |

In `__DEV__` builds only, when `EXPO_PUBLIC_API_URL` is not set the app tries the Metro host
(`http://<lan-ip>:4000/api/v1`) and then `http://10.0.2.2:4000/api/v1` (Android emulator) /
`http://localhost:4000/api/v1`. None of this code exists in release/OTA bundles.

`devCode` values returned by a development backend (email verification, password reset,
email change, account deletion) are shown **only** in `__DEV__` builds.

## Commands

```bash
npm install
npm run start:dev        # Metro for the dev client
npm run android          # build + run debug on a device/emulator
npm run typecheck        # tsc --noEmit
npm run lint             # expo lint
```

## OTA updates (EAS Update) — rules

Production users run the **1.0.7** binary (`runtimeVersion` `"1.0.7"` in `app.json` and
`android/app/src/main/res/values/strings.xml`) and receive JavaScript through EAS Update.

1. **Publish OTA only with the production environment:**
   ```bash
   eas update --channel production --environment production --platform android -m "<message>"
   ```
   or with `EXPO_PUBLIC_API_URL=https://travelorai.com/api/v1` explicitly set in the shell.
   **Never publish from a machine whose `.env` points at a dev/LAN backend** — EXPO_PUBLIC values
   are baked into the bundle. (Release bundles refuse non-https URLs and fall back to production,
   but do not rely on that.)
2. JS-only changes can ship OTA. **Do not** add, remove or upgrade native dependencies, change
   `package.json` dependency versions, or touch `runtimeVersion` in an OTA — that requires a new binary.
3. Changes under `android/` (manifest, gradle) only take effect in the **next binary**.
4. New binary: bump `versionCode` (in `app.json` and the default in `android/app/build.gradle`),
   bump `runtimeVersion` in both places if native code changed, then
   `eas build -p android --profile production` (the upload keystore is EAS-managed; do not build
   release locally).

## Release smoke checklist

- Home and Tours list load; tapping a card opens details instantly; ♥ toggles and appears in Wishlist.
- Deep link `travelorai://tour-details?id=<tourId>` opens and loads the tour.
- Booking request as a guest (name + `+998…` phone) succeeds; invalid phone/date/traveller count is rejected.
- Login / register / verify email / reset password; Google sign-in; logout returns to login.
- Bookings: list, pull-to-refresh, error + retry when offline.
- Expired token → app shows "session expired" and opens Login.
- Settings: Privacy policy and Terms open travelorai.com pages.

Do not commit `.env`, `credentials.json`, keystores or service-account files.
