import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, TouchableOpacity, View } from 'react-native';
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
  useStitchMobileStyles,
} from '../src/components/stitch/StitchMobile';
import { FONTS } from '../src/constants/fonts';
import { SPACING } from '../src/constants/spacing';
import { ApiError, authAPI } from '../src/utils/api';
import { extractApiData, getRouteParam, persistAuthPayload, type AuthFlowData } from '../src/utils/auth';

export default function VerifyEmailScreen() {
  const { colors } = useStitchMobileStyles();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string; devCode?: string }>();
  const [email, setEmail] = useState(getRouteParam(params.email));
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(getRouteParam(params.devCode));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (!email.trim() || code.trim().length !== 6) {
      return Alert.alert(t('auth.errorTitle'), t('auth.errorEmptyVerify'));
    }

    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);

    try {
      const data = extractApiData<AuthFlowData>(await authAPI.verifyEmail({ email: normalizedEmail, code: code.trim() }));
      const didPersist = await persistAuthPayload(data);
      if (didPersist) {
        router.replace('/(tabs)');
        return;
      }
      Alert.alert(t('auth.errorTitle'), data.message || t('auth.errorVerify'));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('auth.errorVerify');
      Alert.alert(t('auth.errorTitle'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) return Alert.alert(t('auth.errorTitle'), t('auth.errorEnterEmail'));
    const normalizedEmail = email.trim().toLowerCase();
    setResending(true);
    try {
      const data = extractApiData<AuthFlowData>(await authAPI.resendVerification({ email: normalizedEmail }));
      setDevCode(data.devCode || '');
      Alert.alert(t('common.ok'), data.message || t('auth.successResend'));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('auth.errorResend');
      Alert.alert(t('auth.errorTitle'), message);
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StitchScrollScreen>
        <StitchHeader title="Tasdiqlash kodi" subtitle="Emailni tekshirish" back />
        <StitchHero title="Kod kiriting" subtitle="6 xonali kod emailingizga yuborildi. Kod 10 daqiqa ichida amal qiladi." />
        <StitchCard>
          <StitchInput label={t('auth.emailLabel')} icon="mail-outline" placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <StitchInput
            label={t('auth.codeLabel')}
            icon="keypad-outline"
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(value) => setCode(value.replace(/[^0-9]/g, ''))}
            style={{ fontFamily: FONTS.display, fontSize: 22, letterSpacing: 8, textAlign: 'center' }}
          />
          {devCode ? (
            <View style={{ borderRadius: 18, backgroundColor: colors.successPale, padding: SPACING.md }}>
              <Text style={{ fontFamily: FONTS.semibold, color: colors.success, fontSize: 12 }}>{t('auth.devCodeLabel')}</Text>
              <Text style={{ fontFamily: FONTS.display, color: colors.text, fontSize: 24, letterSpacing: 6, marginTop: 5 }}>{devCode}</Text>
            </View>
          ) : null}
          <StitchButton title={loading ? t('common.loading') : t('auth.verifyBtn')} icon="checkmark-circle-outline" onPress={handleVerify} disabled={loading} />
          <TouchableOpacity onPress={handleResend} disabled={resending} activeOpacity={0.82}>
            <Text style={{ textAlign: 'center', fontFamily: FONTS.semibold, color: colors.success }}>
              {resending ? t('auth.sending') : t('auth.resendCode')}
            </Text>
          </TouchableOpacity>
        </StitchCard>
        <StitchBottomSpace />
      </StitchScrollScreen>
    </KeyboardAvoidingView>
  );
}
