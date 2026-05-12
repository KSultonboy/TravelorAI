import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

export default function ResetPasswordScreen() {
  const { colors } = useStitchMobileStyles();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string; devCode?: string }>();
  const [email, setEmail] = useState(getRouteParam(params.email));
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devCode] = useState(getRouteParam(params.devCode));
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim() || code.trim().length !== 6 || !newPassword || !confirmPassword) {
      return Alert.alert(t('auth.errorTitle'), t('auth.errorFillCorrectly'));
    }
    if (newPassword.length < 8) return Alert.alert(t('auth.errorTitle'), t('auth.errorPasswordShort'));
    if (newPassword !== confirmPassword) return Alert.alert(t('auth.errorTitle'), t('auth.errorPasswordMismatch'));

    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);

    try {
      const data = extractApiData<AuthFlowData>(
        await authAPI.resetPassword({ email: normalizedEmail, code: code.trim(), newPassword })
      );
      const didPersist = await persistAuthPayload(data);
      if (didPersist) {
        router.replace('/(tabs)');
        return;
      }
      Alert.alert(t('auth.errorTitle'), data.message || t('auth.errorReset'));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('auth.errorReset');
      Alert.alert(t('auth.errorTitle'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StitchScrollScreen>
        <StitchHeader title="Parolni yangilash" subtitle="Yangi parol kiriting" back />
        <StitchHero title="Hisobingizni himoyalaymiz" subtitle="Kod va yangi parolni kiriting. Parol kamida 8 belgidan iborat bo‘lsin." />
        <StitchCard>
          <StitchInput label={t('auth.emailLabel')} icon="mail-outline" placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <StitchInput label={t('auth.resetCodeLabel')} icon="keypad-outline" placeholder="000000" keyboardType="number-pad" maxLength={6} value={code} onChangeText={(value) => setCode(value.replace(/[^0-9]/g, ''))} style={{ fontFamily: FONTS.display, fontSize: 21, letterSpacing: 8, textAlign: 'center' }} />
          {devCode ? (
            <View style={{ borderRadius: 18, backgroundColor: colors.successPale, padding: SPACING.md }}>
              <Text style={{ fontFamily: FONTS.semibold, color: colors.success, fontSize: 12 }}>{t('auth.devCodeLabel')}</Text>
              <Text style={{ fontFamily: FONTS.display, color: colors.text, fontSize: 24, letterSpacing: 6, marginTop: 5 }}>{devCode}</Text>
            </View>
          ) : null}
          <StitchInput
            label={t('auth.newPasswordLabel')}
            icon="lock-closed-outline"
            placeholder={t('auth.passwordHint')}
            secureTextEntry={!showPassword}
            value={newPassword}
            onChangeText={setNewPassword}
            right={
              <TouchableOpacity onPress={() => setShowPassword((value) => !value)} activeOpacity={0.8}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            }
          />
          <StitchInput label={t('auth.confirmPasswordLabel')} icon="shield-checkmark-outline" placeholder={t('auth.confirmPasswordPlaceholder')} secureTextEntry={!showPassword} value={confirmPassword} onChangeText={setConfirmPassword} />
          <StitchButton title={loading ? t('common.loading') : t('auth.updatePasswordBtn')} icon="checkmark-circle-outline" onPress={handleReset} disabled={loading} />
          <StitchButton
            title={t('auth.getCodeAgain')}
            variant="ghost"
            onPress={() => router.replace({ pathname: '/forgot-password', params: { email } })}
          />
        </StitchCard>
        <StitchBottomSpace />
      </StitchScrollScreen>
    </KeyboardAvoidingView>
  );
}
