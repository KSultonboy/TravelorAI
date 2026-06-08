import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  StitchBottomSpace,
  StitchButton,
  StitchCard,
  StitchHeader,
  StitchHero,
  StitchInput,
  StitchScrollScreen,
} from '../src/components/stitch/StitchMobile';
import { ApiError, authAPI } from '../src/utils/api';
import { extractApiData, getRouteParam, type AuthFlowData } from '../src/utils/auth';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(getRouteParam(params.email));
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!email.trim()) {
      return Alert.alert(t('auth.errorTitle'), t('auth.errorEmptyEmail'));
    }

    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);

    try {
      const data = extractApiData<AuthFlowData>(await authAPI.forgotPassword({ email: normalizedEmail }));
      router.replace({
        pathname: '/reset-password',
        params: { email: normalizedEmail, devCode: data.devCode },
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('auth.errorForgot');
      Alert.alert(t('auth.errorTitle'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StitchScrollScreen>
        <StitchHeader title="Parolni tiklash" subtitle="Email orqali kod oling" back />
        <StitchHero title="Kirishni tiklaymiz" subtitle="Email manzilingizni kiriting, biz tasdiqlash kodini yuboramiz." />
        <StitchCard>
          <StitchInput label={t('auth.emailLabel')} icon="mail-outline" placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <StitchButton title={loading ? t('auth.sending') : t('auth.getCodeBtn')} icon="send-outline" onPress={handleContinue} disabled={loading} />
          <StitchButton title={t('auth.backToLogin')} variant="ghost" onPress={() => router.replace('/login')} />
        </StitchCard>
        <StitchBottomSpace />
      </StitchScrollScreen>
    </KeyboardAvoidingView>
  );
}
