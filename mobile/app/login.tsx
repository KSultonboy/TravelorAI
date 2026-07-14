import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import GoogleSignInButton from '../src/components/GoogleSignInButton';
import {
  StitchBottomSpace,
  StitchButton,
  StitchCard,
  StitchHeader,
  StitchHero,
  StitchInput,
  StitchScrollScreen,
  useStitchMobileStyles,
} from '../src/components/stitch/StitchMobile';
import { FONTS } from '../src/constants/fonts';
import { SPACING } from '../src/constants/spacing';
import { ApiError, authAPI } from '../src/utils/api';
import { extractApiData, persistAuthPayload, type AuthFlowData } from '../src/utils/auth';

export default function LoginScreen() {
  const { colors } = useStitchMobileStyles();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      return Alert.alert(t('auth.errorTitle'), t('auth.errorEmpty'));
    }

    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);

    try {
      const data = extractApiData<AuthFlowData>(await authAPI.login({ email: normalizedEmail, password }));
      const didPersist = await persistAuthPayload(data);

      if (didPersist) {
        router.replace('/(tabs)');
        return;
      }

      Alert.alert(t('auth.errorTitle'), data.message || t('auth.errorLogin'));
    } catch (error) {
      if (error instanceof ApiError && error.data?.requiresVerification && typeof error.data.email === 'string') {
        Alert.alert(t('auth.verifyNeededTitle'), error.message || t('auth.verifySub'));
        router.push({
          pathname: '/verify-email',
          params: { email: String(error.data.email).toLowerCase() },
        });
        return;
      }

      const message = error instanceof ApiError ? error.message : t('auth.errorLogin');
      const supportEmail =
        error instanceof ApiError && typeof error.data?.supportEmail === 'string'
          ? error.data.supportEmail
          : undefined;

      // Locked-out / blocked accounts get a direct "contact support" shortcut.
      if (supportEmail) {
        Alert.alert(t('auth.errorTitle'), message, [
          {
            text: t('auth.contactSupport', { defaultValue: 'Qo‘llab-quvvatlash' }),
            onPress: () =>
              Linking.openURL(
                `mailto:${supportEmail}?subject=${encodeURIComponent('TravelorAI - kirish muammosi')}&body=${encodeURIComponent(
                  `Hisob: ${normalizedEmail}\nMuammo: hisobga kira olmayapman.`
                )}`
              ),
          },
          { text: t('common.ok', { defaultValue: 'OK' }), style: 'cancel' },
        ]);
        return;
      }

      Alert.alert(t('auth.errorTitle'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StitchScrollScreen>
        <StitchHeader title="Tizimga kirish" subtitle="TravelorAI hisobingiz" back />
        <StitchHero
          title="Xush kelibsiz!"
          subtitle="Sayohat rejalaringiz, wishlist va profil ma’lumotlaringizni davom ettiring."
        />

        <StitchCard>
          <StitchInput
            label={t('auth.emailLabel')}
            icon="mail-outline"
            placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <StitchInput
            label={t('auth.passwordLabel')}
            icon="lock-closed-outline"
            placeholder={t('auth.passwordPlaceholder')}
            secureTextEntry={!showPass}
            value={password}
            onChangeText={setPassword}
            right={
              <TouchableOpacity onPress={() => setShowPass((value) => !value)} activeOpacity={0.8}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            }
          />
          <TouchableOpacity onPress={() => router.push('/forgot-password')} activeOpacity={0.82}>
            <Text style={{ alignSelf: 'flex-end', fontFamily: FONTS.semibold, fontSize: 12, color: colors.success }}>
              {t('auth.forgotPassword')}
            </Text>
          </TouchableOpacity>
          <StitchButton title={loading ? t('auth.signingIn', { defaultValue: 'Kirilmoqda...' }) : t('auth.signInBtn')} icon="log-in-outline" onPress={handleLogin} disabled={loading} />
          <View style={{ gap: SPACING.sm }}>
            <GoogleSignInButton onSuccess={() => router.replace('/(tabs)')} />
          </View>
        </StitchCard>

        <StitchCard>
          <TouchableOpacity onPress={() => router.replace('/register')} activeOpacity={0.82}>
            <Text style={{ textAlign: 'center', fontFamily: FONTS.regular, fontSize: 14, color: colors.textSecondary }}>
              {t('auth.noAccount')} <Text style={{ fontFamily: FONTS.semibold, color: colors.success }}>{t('auth.registerLink')}</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} activeOpacity={0.82}>
            <Text style={{ textAlign: 'center', fontFamily: FONTS.semibold, fontSize: 13, color: colors.textMuted }}>
              {t('auth.skipNow')}
            </Text>
          </TouchableOpacity>
        </StitchCard>

        <StitchBottomSpace />
      </StitchScrollScreen>
    </KeyboardAvoidingView>
  );
}
