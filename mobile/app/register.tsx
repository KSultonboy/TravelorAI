import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, TouchableOpacity } from 'react-native';
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
import { ApiError, authAPI } from '../src/utils/api';
import { extractApiData, persistAuthPayload, type AuthFlowData } from '../src/utils/auth';

export default function RegisterScreen() {
  const { colors } = useStitchMobileStyles();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      return Alert.alert(t('auth.errorTitle'), t('auth.errorFillAll'));
    }

    if (password.length < 8) {
      return Alert.alert(t('auth.errorTitle'), t('auth.errorPasswordLength'));
    }

    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);

    try {
      const data = extractApiData<AuthFlowData>(
        await authAPI.register({ name: name.trim(), email: normalizedEmail, password })
      );
      const didPersist = await persistAuthPayload(data);

      if (didPersist) {
        router.replace('/(tabs)');
        return;
      }

      if (data.requiresVerification) {
        router.replace({
          pathname: '/verify-email',
          params: {
            email: (data.email || normalizedEmail).toLowerCase(),
            devCode: data.devCode,
          },
        });
        return;
      }

      Alert.alert(t('auth.errorTitle'), data.message || t('auth.errorRegister'));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('auth.errorRegister');
      Alert.alert(t('auth.errorTitle'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StitchScrollScreen>
        <StitchHeader title="Ro‘yxatdan o‘tish" subtitle="Yangi TravelorAI hisob" back />
        <StitchHero
          title="Sayohat profilingizni yarating"
          subtitle="Wishlist, trip plan va shaxsiy tavsiyalar bitta hisobda saqlanadi."
        />

        <StitchCard>
          <StitchInput label={t('auth.nameLabel')} icon="person-outline" placeholder={t('auth.namePlaceholder')} autoCapitalize="words" value={name} onChangeText={setName} />
          <StitchInput label={t('auth.emailLabel')} icon="mail-outline" placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <StitchInput
            label={t('auth.passwordLabel')}
            icon="lock-closed-outline"
            placeholder={t('auth.passwordHint')}
            secureTextEntry={!showPass}
            value={password}
            onChangeText={setPassword}
            right={
              <TouchableOpacity onPress={() => setShowPass((value) => !value)} activeOpacity={0.8}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            }
          />
          <StitchButton title={loading ? t('auth.registering', { defaultValue: 'Yaratilmoqda...' }) : t('auth.registerBtn')} icon="person-add-outline" onPress={handleRegister} disabled={loading} />
          <GoogleSignInButton label={t('auth.googleBtn')} onSuccess={() => router.replace('/(tabs)')} />
        </StitchCard>

        <StitchCard>
          <TouchableOpacity onPress={() => router.replace('/login')} activeOpacity={0.82}>
            <Text style={{ textAlign: 'center', fontFamily: FONTS.regular, fontSize: 14, color: colors.textSecondary }}>
              {t('auth.hasAccount')} <Text style={{ fontFamily: FONTS.semibold, color: colors.success }}>{t('auth.signInLink')}</Text>
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
