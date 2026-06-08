import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';

import Button from '../src/components/Button';
import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';
import { ApiError, feedbackAPI } from '../src/utils/api';

type FeedbackCategory = 'suggestion' | 'complaint' | 'bug' | 'feature' | 'other';

const CATEGORY_OPTIONS: {
  key: FeedbackCategory;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'suggestion', icon: 'bulb-outline' },
  { key: 'feature', icon: 'sparkles-outline' },
  { key: 'bug', icon: 'bug-outline' },
  { key: 'complaint', icon: 'alert-circle-outline' },
  { key: 'other', icon: 'chatbubble-ellipses-outline' },
];

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  const [category, setCategory] = useState<FeedbackCategory>('suggestion');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categoryLabels = useMemo(
    () => ({
      suggestion: t('feedback.categorySuggestion', { defaultValue: 'Taklif' }),
      feature: t('feedback.categoryFeature', { defaultValue: 'Yangi funksiya' }),
      bug: t('feedback.categoryBug', { defaultValue: 'Xatolik' }),
      complaint: t('feedback.categoryComplaint', { defaultValue: 'Shikoyat' }),
      other: t('feedback.categoryOther', { defaultValue: 'Boshqa' }),
    }),
    [t]
  );

  const submitFeedback = async () => {
    if (message.trim().length < 8) {
      Alert.alert(
        t('auth.errorTitle'),
        t('feedback.messageTooShort', { defaultValue: "Xabaringiz kamida 8 ta belgi bo'lishi kerak." })
      );
      return;
    }

    setSubmitting(true);
    try {
      await feedbackAPI.submit({
        category,
        subject: subject.trim() || undefined,
        message: message.trim(),
        contactEmail: contactEmail.trim() || undefined,
        platform: Platform.OS,
        appVersion:
          (Constants.expoConfig as { version?: string } | undefined)?.version ||
          Constants.nativeAppVersion ||
          undefined,
      });

      Alert.alert(
        t('feedback.successTitle', { defaultValue: 'Yuborildi' }),
        t('feedback.successBody', { defaultValue: 'Rahmat! Sizning fikringiz jamoamizga yuborildi.' }),
        [{ text: t('common.ok'), onPress: () => router.back() }]
      );
      setSubject('');
      setMessage('');
      setContactEmail('');
      setCategory('suggestion');
    } catch (err) {
      const fallbackText = t('feedback.errorBody', { defaultValue: "Fikrni yuborishda xatolik bo'ldi." });
      const errorText = err instanceof ApiError ? err.message : fallbackText;
      Alert.alert(t('auth.errorTitle'), errorText || fallbackText);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.inner}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
        <Ionicons name="chevron-back" size={18} color={colors.primary} />
        <Text style={styles.backTxt}>{t('common.back')}</Text>
      </TouchableOpacity>

      <View style={styles.heroCard}>
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowGold} />
        <View style={styles.heroIconWrap}>
          <Ionicons name="chatbox-ellipses-outline" size={26} color={colors.textInverse} />
        </View>
        <Text style={styles.title}>{t('feedback.title', { defaultValue: 'Fikr va shikoyatlar' })}</Text>
        <Text style={styles.subtitle}>
          {t('feedback.subtitle', {
            defaultValue: "Taklif, muammo yoki yangi funksiya g'oyangizni yuboring. Biz albatta ko'rib chiqamiz.",
          })}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('feedback.categoryLabel', { defaultValue: 'Kategoriya' })}</Text>
        <View style={styles.chipsWrap}>
          {CATEGORY_OPTIONS.map((item) => {
            const active = item.key === category;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCategory(item.key)}
                activeOpacity={0.82}
              >
                <Ionicons
                  name={item.icon}
                  size={14}
                  color={active ? colors.textInverse : colors.textSecondary}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{categoryLabels[item.key]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('feedback.subjectLabel', { defaultValue: 'Sarlavha (ixtiyoriy)' })}</Text>
        <TextInput
          style={styles.input}
          value={subject}
          onChangeText={setSubject}
          placeholder={t('feedback.subjectPlaceholder', { defaultValue: 'Qisqa sarlavha yozing...' })}
          placeholderTextColor={colors.textMuted}
          maxLength={120}
        />

        <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>
          {t('feedback.messageLabel', { defaultValue: 'Xabar' })}
        </Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          value={message}
          onChangeText={setMessage}
          placeholder={t('feedback.messagePlaceholder', { defaultValue: 'Muammoni yoki taklifni batafsil yozing...' })}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          maxLength={2000}
        />

        <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>
          {t('feedback.contactLabel', { defaultValue: 'Aloqa emaili (ixtiyoriy)' })}
        </Text>
        <TextInput
          style={styles.input}
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder={t('feedback.contactPlaceholder', { defaultValue: 'you@example.com' })}
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Button
        title={t('feedback.submitBtn', { defaultValue: 'Yuborish' })}
        onPress={submitFeedback}
        loading={submitting}
        style={styles.submitBtn}
      />
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxl },
    backBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: SPACING.md,
    },
    backTxt: { fontFamily: FONTS.medium, fontSize: 13, color: colors.primary },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xxl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.xl,
      marginBottom: SPACING.lg,
      overflow: 'hidden',
    },
    heroGlowPrimary: {
      position: 'absolute',
      width: 170,
      height: 170,
      borderRadius: 85,
      top: -80,
      left: -40,
      backgroundColor: colors.primaryPale,
    },
    heroGlowGold: {
      position: 'absolute',
      width: 130,
      height: 130,
      borderRadius: 65,
      bottom: -48,
      right: -12,
      backgroundColor: colors.goldPale,
    },
    heroIconWrap: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 18,
      elevation: 7,
    },
    title: { fontFamily: FONTS.display, fontSize: 28, color: colors.text, marginBottom: SPACING.sm },
    subtitle: {
      fontFamily: FONTS.regular,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    sectionTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 14,
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.cardMuted,
      paddingHorizontal: SPACING.md,
      paddingVertical: 8,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    chipText: {
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.textInverse,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: RADIUS.lg,
      backgroundColor: colors.cardMuted,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontFamily: FONTS.regular,
      fontSize: 14,
      color: colors.text,
    },
    messageInput: {
      minHeight: 130,
      paddingTop: SPACING.md,
    },
    submitBtn: {
      height: 52,
      justifyContent: 'center',
    },
  });
}
