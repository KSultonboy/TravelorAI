try {
  require('dotenv').config();
} catch {
  // Expo can load env files itself; this keeps config usable if dotenv is not hoisted.
}

module.exports = ({ config }) => {
  const yandexMapkitApiKey =
    process.env.EXPO_PUBLIC_YANDEX_MAPKIT_API_KEY || process.env.YANDEX_MAPKIT_API_KEY || '';
  const yandexStaticMapsApiKey =
    process.env.EXPO_PUBLIC_YANDEX_STATIC_MAPS_API_KEY || process.env.YANDEX_STATIC_MAPS_API_KEY || yandexMapkitApiKey;
  const yandexRedirectEnabled =
    process.env.EXPO_PUBLIC_YANDEX_REDIRECT_ENABLED !== 'false';

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      yandexMapkitApiKey,
      yandexStaticMapsApiKey,
      yandexRedirectEnabled,
    },
  };
};
