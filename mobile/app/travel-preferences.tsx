import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Button from '../src/components/Button';
import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';
import {
  DEFAULT_TRAVEL_PREFERENCES,
  INTEREST_OPTIONS,
  TRAVEL_STYLE_OPTIONS,
  loadTravelPreferences,
  saveTravelPreferences,
  type TravelInterest,
  type TravelStyle,
} from '../src/utils/preferences';
import { type AuthUser } from '../src/utils/auth';
import { KEYS, getJSON } from '../src/utils/storage';

export default function TravelPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const [style, setStyle] = useState<TravelStyle>(DEFAULT_TRAVEL_PREFERENCES.style);
  const [interests, setInterests] = useState<TravelInterest[]>(DEFAULT_TRAVEL_PREFERENCES.interests);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getJSON<AuthUser>(KEYS.USER).then((u) => setUserId(u?.id ?? null));
  }, []);

  const STYLE_MAP: Record<string, { label: string; desc: string }> = {
    budget: { label: t('travelPrefs.styleBudgetLabel'), desc: t('travelPrefs.styleBudgetDesc') },
    mid: { label: t('travelPrefs.styleMidLabel'), desc: t('travelPrefs.styleMidDesc') },
    luxury: { label: t('travelPrefs.stylePremiumLabel'), desc: t('travelPrefs.stylePremiumDesc') },
  };

  const INTEREST_MAP: Record<string, string> = {
    tarixiy: t('travelPrefs.intHistorical'),
    madaniy: t('travelPrefs.intCultural'),
    tabiat: t('travelPrefs.intNature'),
    gastronomy: t('travelPrefs.intGastronomy'),
    arxitektura: t('travelPrefs.intArchitecture'),
    din: t('travelPrefs.intReligious'),
    zamonaviy: t('travelPrefs.intModern'),
    hunarmandchilik: t('travelPrefs.intCrafts'),
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;

      loadTravelPreferences(userId).then((saved) => {
        if (!active) {
          return;
        }

        setStyle(saved.style);
        setInterests(saved.interests);
      });

      return () => {
        active = false;
      };
    }, [userId])
  );

  const toggleInterest = (interest: TravelInterest) => {
    setInterests((current) =>
      current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]
    );
  };

  const handleReset = () => {
    setStyle(DEFAULT_TRAVEL_PREFERENCES.style);
    setInterests(DEFAULT_TRAVEL_PREFERENCES.interests);
  };

  const handleSave = async () => {
    if (interests.length === 0) {
      return Alert.alert(t('auth.errorTitle'), t('travelPrefs.errorInterests'));
    }

    setLoading(true);

    try {
      await saveTravelPreferences({ style, interests }, userId);
      Alert.alert(t('common.ok'), t('travelPrefs.successSave'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('auth.errorTitle'), t('travelPrefs.errorSave'));
    } finally {
      setLoading(false);
    }
  };

  const summaryInterests = interests.slice(0, 3).map((k) => INTEREST_MAP[k] || k);
  const summaryInterestsText = interests.length > 3 ? `${summaryInterests.join(', ')} +${interests.length - 3}` : summaryInterests.join(', ');
  const summary = `${STYLE_MAP[style]?.label || style} | ${summaryInterestsText}`;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.inner}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
        <Ionicons name="chevron-back" size={18} color={colors.primary} />
        <Text style={styles.backTxt}>{t('travelPrefs.backBtn')}</Text>
      </TouchableOpacity>

      <View style={styles.heroCard}>
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowGold} />
        <View style={styles.heroIconWrap}>
          <Ionicons name="sparkles-outline" size={26} color={colors.textInverse} />
        </View>
        <Text style={styles.title}>{t('travelPrefs.title')}</Text>
        <Text style={styles.subtitle}>{t('travelPrefs.subtitle')}</Text>

        <View style={styles.summaryPill}>
          <Text style={styles.summaryLabel}>{t('travelPrefs.currentDefault')}</Text>
          <Text style={styles.summaryValue}>{summary}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('travelPrefs.styleLabel')}</Text>
          <Text style={styles.sectionHint}>{t('travelPrefs.styleSub')}</Text>
        </View>

        {TRAVEL_STYLE_OPTIONS.map((option) => {
          const active = style === option.key;

          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.styleCard, active && styles.styleCardActive]}
              onPress={() => setStyle(option.key)}
              activeOpacity={0.86}
            >
              <View style={[styles.styleIconWrap, active && styles.styleIconWrapActive]}>
                <Ionicons name={option.icon as keyof typeof Ionicons.glyphMap} size={18} color={active ? colors.textInverse : colors.primary} />
              </View>
              <View style={styles.styleCopy}>
                <Text style={[styles.styleTitle, active && styles.styleTitleActive]}>{STYLE_MAP[option.key]?.label || option.label}</Text>
                <Text style={[styles.styleDesc, active && styles.styleDescActive]}>{STYLE_MAP[option.key]?.desc || option.desc}</Text>
              </View>
              {active ? <Ionicons name="checkmark-circle" size={20} color={colors.textInverse} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('travelPrefs.interestsLabel')}</Text>
          <Text style={styles.sectionHint}>{t('travelPrefs.interestsSub')}</Text>
        </View>

        <View style={styles.chipsWrap}>
          {INTEREST_OPTIONS.map((option) => {
            const active = interests.includes(option.key);

            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleInterest(option.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{INTEREST_MAP[option.key] || option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.85}>
          <Ionicons name="refresh-outline" size={16} color={colors.primary} />
          <Text style={styles.resetTxt}>{t('travelPrefs.resetBtn')}</Text>
        </TouchableOpacity>
        <Button title={t('travelPrefs.saveBtn')} onPress={handleSave} loading={loading} style={styles.saveBtn} />
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
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
      marginBottom: SPACING.lg,
    },
    summaryPill: {
      alignSelf: 'flex-start',
      backgroundColor: colors.cardMuted,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
    },
    summaryLabel: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    summaryValue: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.text },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    sectionHead: { marginBottom: SPACING.md },
    sectionTitle: { fontFamily: FONTS.semibold, fontSize: 17, color: colors.text, marginBottom: 4 },
    sectionHint: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted },
    styleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      borderColor: colors.borderLight,
      backgroundColor: colors.cardMuted,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      gap: SPACING.md,
    },
    styleCardActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 5,
    },
    styleIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    styleIconWrapActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
    styleCopy: { flex: 1 },
    styleTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.text, marginBottom: 2 },
    styleTitleActive: { color: colors.textInverse },
    styleDesc: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted },
    styleDescActive: { color: 'rgba(255,255,255,0.8)' },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    chip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      backgroundColor: colors.cardMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    chipActive: {
      backgroundColor: colors.primaryPale,
      borderColor: colors.primary,
    },
    chipText: { fontFamily: FONTS.medium, fontSize: 13, color: colors.textSecondary },
    chipTextActive: { color: colors.primary },
    actionsRow: { gap: SPACING.sm },
    resetBtn: {
      height: 50,
      borderRadius: RADIUS.full,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    resetTxt: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.primary },
    saveBtn: { height: 52, justifyContent: 'center' },
  });
}
