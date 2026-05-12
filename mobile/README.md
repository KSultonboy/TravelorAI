# TravelorAI Mobile

Expo SDK 54 mobile app for the TravelorAI Uzbekistan travel planner.

## Setup

```bash
npm install
cp .env.example .env
```

Set local development API values in `.env`:

```bash
EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1
EXPO_PUBLIC_API_PORT=4000
EXPO_PUBLIC_USD_TO_UZS=13000
```

On Android emulator the app automatically falls back to `http://10.0.2.2:4000/api/v1` when `EXPO_PUBLIC_API_URL` is not set.

## Production Env Contract

```bash
EXPO_PUBLIC_API_URL=https://travelorai.com/api/v1
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_RELEASE=
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=
EXPO_PUBLIC_USD_TO_UZS=13000
```

Do not commit `.env`, `credentials.json`, keystores, SSH keys, or Google Play service account files.

## Commands

```bash
npm run start
npm run start:dev
npm run lint
npm run typecheck
eas build --platform android --profile production
```

## Release Smoke Checklist

- Login/register and Google sign-in.
- Planner generate: draft state, final backend update, and save trip.
- Explore map: visible-area loading, "Near me" permission request, and map fallback.
- Trips: pending/synced status and delete.
- Profile: offline mode only when cached data exists.
