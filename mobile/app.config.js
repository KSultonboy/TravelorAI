try {
  require('dotenv').config();
} catch {
  // Expo can load env files itself; this keeps config usable if dotenv is not hoisted.
}

const appJson = require('./app.json');

const plugins = [...(appJson.expo.plugins || [])];
const yandexMapkitApiKey =
  process.env.EXPO_PUBLIC_YANDEX_MAPKIT_API_KEY || process.env.YANDEX_MAPKIT_API_KEY || '';
const yandexStaticMapsApiKey =
  process.env.EXPO_PUBLIC_YANDEX_STATIC_MAPS_API_KEY || process.env.YANDEX_STATIC_MAPS_API_KEY || yandexMapkitApiKey;
const yandexRedirectEnabled =
  process.env.EXPO_PUBLIC_YANDEX_REDIRECT_ENABLED !== 'false';

module.exports = {
  expo: {
    ...appJson.expo,
    plugins,
    extra: {
      ...(appJson.expo.extra || {}),
      yandexMapkitApiKey,
      yandexStaticMapsApiKey,
      yandexRedirectEnabled,
    },
  },
};
