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

// ── Google Sign-In native config plugin ───────────────────────────────────────
// @react-native-google-signin/google-signin needs its Expo config plugin to be
// present in a native (dev/prod) build, otherwise GoogleSignin.signIn() fails at
// runtime with DEVELOPER_ERROR. We only add it when a Google client id is
// configured, and derive the required iOS URL scheme from the iOS client id.
const googleWebClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const googleAndroidClientId =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_RELEASE ||
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_DEBUG ||
  '';

function reversedIosScheme(clientId) {
  const trimmed = (clientId || '').trim();
  if (!trimmed) return undefined;
  const bare = trimmed.replace(/\.apps\.googleusercontent\.com$/i, '');
  return `com.googleusercontent.apps.${bare}`;
}

const hasGoogleSigninPlugin = plugins.some(
  (p) => p === '@react-native-google-signin/google-signin' || (Array.isArray(p) && p[0] === '@react-native-google-signin/google-signin')
);
const googleSignInConfigured = Boolean(googleWebClientId || googleIosClientId || googleAndroidClientId);
if (googleSignInConfigured && !hasGoogleSigninPlugin) {
  const iosUrlScheme = reversedIosScheme(googleIosClientId);
  plugins.push([
    '@react-native-google-signin/google-signin',
    // iosUrlScheme is required by the plugin for iOS; Android does not need it.
    iosUrlScheme ? { iosUrlScheme } : {},
  ]);
}

module.exports = {
  expo: {
    ...appJson.expo,
    plugins,
    extra: {
      ...(appJson.expo.extra || {}),
      yandexMapkitApiKey,
      yandexStaticMapsApiKey,
      yandexRedirectEnabled,
      googleSignInConfigured,
    },
  },
};
