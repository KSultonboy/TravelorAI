import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FONTS } from '../constants/fonts';
import { RADIUS, SPACING } from '../constants/spacing';
import { type AppColors, useAppTheme } from '../theme/app-theme';
import { ApiError, authAPI } from '../utils/api';
import { extractApiData, persistAuthPayload, type AuthFlowData } from '../utils/auth';

WebBrowser.maybeCompleteAuthSession();

interface GoogleSignInButtonProps {
  label?: string;
  onSuccess?: (data: AuthFlowData) => void;
  style?: StyleProp<ViewStyle>;
}

interface GoogleClientConfig {
  clientId?: string;
  webClientId?: string;
  androidClientId?: string;
  androidClientIdDebug?: string;
  androidClientIdRelease?: string;
  iosClientId?: string;
}

interface NativeGoogleSigninModule {
  GoogleSignin: {
    configure: (options?: {
      scopes?: string[];
      webClientId?: string;
      offlineAccess?: boolean;
      iosClientId?: string;
    }) => void;
    hasPlayServices: (options?: { showPlayServicesUpdateDialog: boolean }) => Promise<boolean>;
    signIn: () => Promise<
      | {
          type: 'success';
          data: {
            idToken: string | null;
          };
        }
      | {
          type: 'cancelled';
          data: null;
        }
    >;
    getTokens: () => Promise<{
      idToken: string;
      accessToken: string;
    }>;
    signOut: () => Promise<null>;
    revokeAccess: () => Promise<null>;
    hasPreviousSignIn: () => boolean;
    getCurrentUser: () => unknown | null;
  };
  statusCodes?: {
    IN_PROGRESS?: string;
    PLAY_SERVICES_NOT_AVAILABLE?: string;
    SIGN_IN_CANCELLED?: string;
  };
}
type TranslateFn = (key: string, fallback: string) => string;

function readEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isExpoGoNative(): boolean {
  return Constants.appOwnership === 'expo' && (Platform.OS === 'android' || Platform.OS === 'ios');
}

function isAndroidReleaseBuild(): boolean {
  return Platform.OS === 'android' && !__DEV__;
}

function getNativeGoogleSigninModule(): NativeGoogleSigninModule | null {
  if (Platform.OS === 'web') return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-google-signin/google-signin') as NativeGoogleSigninModule;
  } catch {
    return null;
  }
}

function shouldShowDeferredGooglePopup(message?: string): boolean {
  if (!isExpoGoNative() || !message) return false;

  const normalized = message.toLowerCase();
  const markers = [
    'invalid_request',
    'authorization error',
    'access blocked',
    'oauth',
    'redirect_uri_mismatch',
    'developer_error',
    'policy',
  ];

  return markers.some((marker) => normalized.includes(marker));
}

function showDeferredGooglePopup(tt: TranslateFn) {
  Alert.alert(
    tt('auth.googleNotReadyTitle', 'Google auth is not ready'),
    tt(
      'auth.googleExpoGoOnly',
      "Google orqali kirish Expo Go'da ishlamaydi. Development yoki production buildda qayta urinib ko'ring."
    )
  );
}

function getGoogleClientConfig(): GoogleClientConfig {
  const androidDefault = readEnv(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
  const androidDebug = readEnv(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_DEBUG);
  const androidRelease = readEnv(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_RELEASE);
  const resolvedAndroidClientId = __DEV__
    ? androidDebug || androidDefault || androidRelease
    : androidRelease || androidDefault || androidDebug;
  const genericClientId = readEnv(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);
  const webClientId = readEnv(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) || genericClientId;

  return {
    clientId: genericClientId || webClientId,
    webClientId,
    androidClientId: resolvedAndroidClientId,
    androidClientIdDebug: androidDebug,
    androidClientIdRelease: androidRelease,
    iosClientId: readEnv(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
  };
}

function getMissingConfigMessage(tt: TranslateFn): string {
  if (Platform.OS === 'android') {
    if (!readEnv(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) && !readEnv(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID)) {
      return tt(
        'auth.googleMissingConfigAndroidWebClient',
        'Google sign-in is being set up. Please use email sign-in for now.'
      );
    }

    if (isAndroidReleaseBuild()) {
      return tt(
        'auth.googleMissingConfigAndroidRelease',
        'Google sign-in is being set up. Please use email sign-in for now.'
      );
    }

    return tt(
      'auth.googleMissingConfigAndroid',
      'Google sign-in is being set up. Please use email sign-in for now.'
    );
  }

  if (Platform.OS === 'ios') {
    return tt('auth.googleMissingConfigIos', 'Google sign-in is being set up. Please use email sign-in for now.');
  }

  return tt('auth.googleMissingConfigGeneric', 'Google sign-in is being set up. Please use email sign-in for now.');
}

function isConfiguredForCurrentPlatform(config: GoogleClientConfig): boolean {
  if (Platform.OS === 'android') {
    return Boolean(config.webClientId || config.clientId || config.androidClientId);
  }

  if (Platform.OS === 'ios') {
    return Boolean(config.iosClientId);
  }

  return Boolean(config.webClientId || config.clientId);
}

function getGoogleNativeRedirectUri(clientId?: string): string | undefined {
  const normalizedClientId = readEnv(clientId);
  if (!normalizedClientId) return undefined;

  const suffix = '.apps.googleusercontent.com';
  const shortClientId = normalizedClientId.endsWith(suffix)
    ? normalizedClientId.slice(0, -suffix.length)
    : normalizedClientId;

  return `com.googleusercontent.apps.${shortClientId}:/oauthredirect`;
}

async function completeGoogleSignInFlow(
  idToken: string,
  onSuccess: ((data: AuthFlowData) => void) | undefined,
  tt: TranslateFn
) {
  const responseData = extractApiData<AuthFlowData>(await authAPI.google({ idToken }));
  const didPersist = await persistAuthPayload(responseData);

  if (didPersist) {
    onSuccess?.(responseData);
    return;
  }

  if (responseData.requiresVerification && responseData.email) {
    Alert.alert(
      tt('auth.verifyNeededTitle', 'Email verification required'),
      responseData.message || tt('auth.verifySub', 'Please verify your email.')
    );
    router.push({
      pathname: '/verify-email',
      params: {
        email: String(responseData.email).toLowerCase(),
        ...(responseData.devCode ? { devCode: responseData.devCode } : {}),
      },
    });
    return;
  }

  Alert.alert(
    tt('auth.errorTitle', 'Error'),
    responseData.message || tt('auth.googleSignInError', 'Google sign-in failed.')
  );
}

function GoogleButtonBase({
  colors,
  label,
  caption,
  loadingLabel,
  loading,
  onPress,
  style,
  muted = false,
}: {
  colors: AppColors;
  label: string;
  caption: string;
  loadingLabel: string;
  loading: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  muted?: boolean;
}) {
  const styles = createStyles(colors);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.button, muted && styles.buttonMuted, style]}
      onPress={onPress}
      disabled={loading}
    >
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>G</Text>
      </View>
      <View style={styles.copyBlock}>
        <Text style={styles.label}>{loading ? loadingLabel : label}</Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ConfiguredNativeGoogleSignInButton({
  label,
  onSuccess,
  style,
  colors,
  config,
  tt,
}: GoogleSignInButtonProps & { colors: AppColors; config: GoogleClientConfig; tt: TranslateFn }) {
  const [loading, setLoading] = useState(false);
  const nativeModule = useMemo(() => getNativeGoogleSigninModule(), []);

  useEffect(() => {
    nativeModule?.GoogleSignin.configure({
      scopes: ['openid', 'profile', 'email'],
      webClientId: config.webClientId || config.clientId,
      iosClientId: config.iosClientId,
      offlineAccess: false,
    });
  }, [config.clientId, config.iosClientId, config.webClientId, nativeModule]);

  const handlePress = async () => {
    if (!nativeModule?.GoogleSignin) {
      Alert.alert(
        tt('auth.errorTitle', 'Error'),
        tt('auth.googleNativeModuleMissing', 'Google sign-in is not available in this build yet. Please install the latest build and try again.')
      );
      return;
    }

    setLoading(true);

    try {
      if (Platform.OS === 'android') {
        await nativeModule.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      if (
        nativeModule.GoogleSignin.hasPreviousSignIn?.() ||
        nativeModule.GoogleSignin.getCurrentUser?.()
      ) {
        await nativeModule.GoogleSignin.revokeAccess?.().catch(() => null);
        await nativeModule.GoogleSignin.signOut?.().catch(() => null);
      }

      const signInResult = await nativeModule.GoogleSignin.signIn();
      if (signInResult.type === 'cancelled') {
        return;
      }

      let idToken = signInResult.data?.idToken || null;

      if (!idToken) {
        const tokens = await nativeModule.GoogleSignin.getTokens().catch(() => null);
        idToken = tokens?.idToken || null;
      }

      if (!idToken) {
        Alert.alert(
          tt('auth.errorTitle', 'Error'),
          tt('auth.googleIdTokenMissing', 'Google ID token was not received. Check client configuration.')
        );
        return;
      }

      await completeGoogleSignInFlow(idToken, onSuccess, tt);
    } catch (error) {
      const statusCodes = nativeModule.statusCodes;
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';

      if (
        code === statusCodes?.SIGN_IN_CANCELLED ||
        code === statusCodes?.IN_PROGRESS
      ) {
        return;
      }

      if (code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(
          tt('auth.errorTitle', 'Error'),
          tt('auth.googlePlayServicesMissing', 'Google Play Services is unavailable or outdated on this device.')
        );
        return;
      }

      const message =
        error instanceof ApiError
          ? error.message
          : typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: string }).message)
            : tt('auth.googleSignInError', 'Google sign-in failed.');

      Alert.alert(tt('auth.errorTitle', 'Error'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GoogleButtonBase
      colors={colors}
      label={label || tt('auth.googleContinue', 'Continue with Google')}
      caption={tt('auth.googleSecureCaption', 'Secure Google sign-in')}
      loadingLabel={tt('auth.googleChecking', 'Checking...')}
      loading={loading}
      onPress={handlePress}
      style={style}
    />
  );
}

function ConfiguredOauthGoogleSignInButton({
  label,
  onSuccess,
  style,
  colors,
  config,
  tt,
}: GoogleSignInButtonProps & { colors: AppColors; config: GoogleClientConfig; tt: TranslateFn }) {
  const [loading, setLoading] = useState(false);
  const isAndroidOauth = Platform.OS === 'android';
  const sharedWebClientId = config.webClientId || config.clientId;
  const androidClientId = config.androidClientId || config.androidClientIdDebug || config.androidClientIdRelease;
  const androidNativeRedirectUri = useMemo(
    () => (isAndroidOauth ? getGoogleNativeRedirectUri(androidClientId) : undefined),
    [androidClientId, isAndroidOauth]
  );
  const requestConfig = useMemo(
    () => ({
      clientId: isAndroidOauth ? androidClientId || sharedWebClientId : sharedWebClientId,
      webClientId: sharedWebClientId,
      androidClientId,
      iosClientId: config.iosClientId,
      redirectUri: androidNativeRedirectUri,
      scopes: ['openid', 'profile', 'email'],
      selectAccount: true,
    }),
    [androidClientId, androidNativeRedirectUri, config.iosClientId, isAndroidOauth, sharedWebClientId]
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(requestConfig);

  useEffect(() => {
    let isMounted = true;

    async function completeGoogleSignIn(idToken: string) {
      try {
        const responseData = extractApiData<AuthFlowData>(await authAPI.google({ idToken }));
        const didPersist = await persistAuthPayload(responseData);
        if (!isMounted) return;

        if (didPersist) {
          onSuccess?.(responseData);
          return;
        }

        if (responseData.requiresVerification && responseData.email) {
          Alert.alert(tt('auth.verifyNeededTitle', 'Email verification required'), responseData.message || tt('auth.verifySub', 'Please verify your email.'));
          router.push({
            pathname: '/verify-email',
            params: {
              email: String(responseData.email).toLowerCase(),
              ...(responseData.devCode ? { devCode: responseData.devCode } : {}),
            },
          });
          return;
        }

        Alert.alert(tt('auth.errorTitle', 'Error'), responseData.message || tt('auth.googleSignInError', 'Google sign-in failed.'));
      } catch (error) {
        const message = error instanceof ApiError ? error.message : tt('auth.googleSignInError', 'Google sign-in failed.');
        if (isMounted) {
          if (shouldShowDeferredGooglePopup(message)) {
            showDeferredGooglePopup(tt);
          } else {
            Alert.alert(tt('auth.errorTitle', 'Error'), message);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (response?.type === 'success') {
      const idToken = response.params.id_token;

      if (!idToken) {
        Alert.alert(
          tt('auth.errorTitle', 'Error'),
          tt('auth.googleIdTokenMissing', 'Google ID token was not received. Check client configuration.')
        );
        setLoading(false);
      } else {
        completeGoogleSignIn(idToken);
      }
    } else if (response?.type === 'error') {
      const message = response.error?.message || tt('auth.googleFlowError', 'Google auth flow failed.');
      if (shouldShowDeferredGooglePopup(message)) {
        showDeferredGooglePopup(tt);
      } else {
        Alert.alert(
          tt('auth.errorTitle', 'Error'),
          message || tt('auth.googleFlowError', 'Google auth flow failed.')
        );
      }
      setLoading(false);
    } else if (response && response.type !== 'opened') {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [onSuccess, response, tt]);

  const handlePress = async () => {
    if (!request) {
      Alert.alert(
        tt('auth.googleWaitTitle', 'Please wait'),
        tt('auth.googleWaitMsg', 'Google auth session is not ready yet. Please try again.')
      );
      return;
    }

    setLoading(true);
    const result = await promptAsync();

    if ((result as any)?.type === 'error') {
      const errorMessage =
        (result as any)?.error?.message ||
        (result as any)?.params?.error_description ||
        (result as any)?.params?.error;

      if (shouldShowDeferredGooglePopup(errorMessage)) {
        showDeferredGooglePopup(tt);
      }
    }

    if (result.type !== 'success' && result.type !== 'opened') {
      setLoading(false);
    }
  };

  return (
    <GoogleButtonBase
      colors={colors}
      label={label || tt('auth.googleContinue', 'Continue with Google')}
      caption={tt('auth.googleSecureCaption', 'Secure Google sign-in')}
      loadingLabel={tt('auth.googleChecking', 'Checking...')}
      loading={loading}
      onPress={handlePress}
      style={style}
    />
  );
}

export default function GoogleSignInButton({
  label,
  onSuccess,
  style,
}: GoogleSignInButtonProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const tt = React.useCallback((key: string, fallback: string) => t(key as any, { defaultValue: fallback }), [t]);
  const resolvedLabel = label || tt('auth.googleContinue', 'Continue with Google');
  const config = getGoogleClientConfig();
  const inExpoGoNative = isExpoGoNative();
  const hasNativeGoogleModule = useMemo(() => Boolean(getNativeGoogleSigninModule()?.GoogleSignin), []);
  const isConfigured = isConfiguredForCurrentPlatform(config);

  if (inExpoGoNative) {
    return (
      <GoogleButtonBase
        colors={colors}
        label={resolvedLabel}
        caption={tt('auth.googleExpoGoCaption', 'Google sign-in works in development/production build')}
        loadingLabel={tt('auth.googleChecking', 'Checking...')}
        loading={false}
        muted
        onPress={() => {
          showDeferredGooglePopup(tt);
        }}
        style={style}
      />
    );
  }

  if (!isConfigured) {
    return (
      <GoogleButtonBase
        colors={colors}
        label={resolvedLabel}
        caption={tt('auth.googleNotConfiguredCaption', 'Google sign-in is not configured')}
        loadingLabel={tt('auth.googleChecking', 'Checking...')}
        loading={false}
        muted
        onPress={() => {
          Alert.alert(tt('auth.googleNotReadyTitle', 'Google auth is not ready'), getMissingConfigMessage(tt));
        }}
        style={style}
      />
    );
  }

  if (Platform.OS !== 'web' && hasNativeGoogleModule) {
    return (
      <ConfiguredNativeGoogleSignInButton
        label={resolvedLabel}
        onSuccess={onSuccess}
        style={style}
        colors={colors}
        config={config}
        tt={tt}
      />
    );
  }

  if (Platform.OS !== 'web') {
    return (
      <GoogleButtonBase
        colors={colors}
        label={resolvedLabel}
        caption={tt('auth.googleNativeModuleRequiredCaption', 'Google sign-in requires a native development or production build')}
        loadingLabel={tt('auth.googleChecking', 'Checking...')}
        loading={false}
        muted
        onPress={() => {
          Alert.alert(
            tt('auth.errorTitle', 'Error'),
            tt('auth.googleNativeModuleMissing', 'Google sign-in is not available in this build yet. Please install the latest build and try again.')
          );
        }}
        style={style}
      />
    );
  }

  return (
    <ConfiguredOauthGoogleSignInButton
      label={resolvedLabel}
      onSuccess={onSuccess}
      style={style}
      colors={colors}
      config={config}
      tt={tt}
    />
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    button: {
      minHeight: 62,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    buttonMuted: {
      opacity: 0.72,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundAccent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    iconText: {
      fontFamily: FONTS.semibold,
      fontSize: 20,
      color: colors.primary,
    },
    copyBlock: {
      flex: 1,
      gap: 2,
    },
    label: {
      fontFamily: FONTS.semibold,
      fontSize: 14,
      color: colors.text,
    },
    caption: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textMuted,
    },
  });
}
