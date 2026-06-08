import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { useAchievements } from '../src/hooks/useAchievements';
import { useTrips } from '../src/hooks/useTrips';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';
import { type AuthUser } from '../src/utils/auth';
import { KEYS, getJSON } from '../src/utils/storage';

export default function AchievementsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getJSON<AuthUser>(KEYS.USER).then((u) => setUserId(u?.id ?? null));
  }, []);

  const { trips, loadTrips } = useTrips(userId);
  const { achievements, loadAchievements } = useAchievements(trips, userId);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
      loadAchievements();
    }, [loadAchievements, loadTrips])
  );

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
          <Text style={styles.backTxt}>{t('achievements.backBtn')}</Text>
        </TouchableOpacity>
        <View style={styles.headerChip}>
          <Text style={styles.headerChipTxt}>{Math.round(achievements.completionRate * 100)}%</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowGold} />
        <Text style={styles.eyebrow}>{t('achievements.heading')}</Text>
        <Text style={styles.title}>{t('achievements.title')}</Text>
        <Text style={styles.subtitle}>{t('achievements.subtitle')}</Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{achievements.unlockedCount}</Text>
            <Text style={styles.heroStatLabel}>{t('achievements.unlocked')}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{achievements.totalCount}</Text>
            <Text style={styles.heroStatLabel}>{t('achievements.total')}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{achievements.stats.uniqueCities}</Text>
            <Text style={styles.heroStatLabel}>{t('achievements.cities')}</Text>
          </View>
        </View>

        {achievements.nextAchievement ? (
          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>{t('achievements.nextBadge')}</Text>
            <Text style={styles.nextTitle}>{t(achievements.nextAchievement.title)}</Text>
            <Text style={styles.nextMeta}>{achievements.nextAchievement.progressText}</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(achievements.nextAchievement.progress * 100, 8)}%`,
                    backgroundColor: achievements.nextAchievement.accent,
                  },
                ]}
              />
            </View>
          </View>
        ) : (
          <View style={styles.nextCard}>
            <Text style={styles.nextTitle}>{t('achievements.allUnlocked')}</Text>
            <Text style={styles.nextMeta}>{t('achievements.allUnlockedSub')}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('achievements.unlockedSection')}</Text>
        {achievements.unlocked.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="lock-closed-outline" size={26} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('achievements.noneYet')}</Text>
            <Text style={styles.emptySubtitle}>{t('achievements.noneYetSub')}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {achievements.unlocked.map((item) => (
              <View key={item.id} style={styles.badgeCard}>
                <View style={[styles.badgeIconWrap, { backgroundColor: `${item.accent}18` }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.accent} />
                </View>
                <Text style={styles.badgeTitle}>{t(item.title)}</Text>
                <Text style={styles.badgeDescription}>{t(item.description)}</Text>
                <View style={[styles.statusChip, { backgroundColor: `${item.accent}14` }]}>
                  <Ionicons name="checkmark-circle" size={14} color={item.accent} />
                  <Text style={[styles.statusChipTxt, { color: item.accent }]}>{t('achievements.unlocked')}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('achievements.lockedSection')}</Text>
        <View style={styles.lockedList}>
          {achievements.locked.map((item) => (
            <View key={item.id} style={styles.lockedCard}>
              <View style={styles.lockedHeader}>
                <View style={styles.lockedTitleWrap}>
                  <View style={styles.lockedIconWrap}>
                    <Ionicons name={item.icon as any} size={18} color={colors.textMuted} />
                  </View>
                  <View style={styles.lockedCopy}>
                    <Text style={styles.lockedTitle}>{t(item.title)}</Text>
                    <Text style={styles.lockedHint}>{t(item.hint)}</Text>
                  </View>
                </View>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
              </View>
              <View style={styles.lockedProgressTrack}>
                <View
                  style={[
                    styles.lockedProgressFill,
                    {
                      width: `${Math.max(item.progress * 100, 6)}%`,
                      backgroundColor: item.accent,
                    },
                  ]}
                />
              </View>
              <Text style={styles.lockedProgressTxt}>{item.progressText}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.md,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    backTxt: { fontFamily: FONTS.medium, fontSize: 13, color: colors.primary },
    headerChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: 7,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    headerChipTxt: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.primary },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xxl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.xl,
      overflow: 'hidden',
      marginBottom: SPACING.xl,
    },
    heroGlowPrimary: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      top: -80,
      left: -35,
      backgroundColor: colors.primaryPale,
    },
    heroGlowGold: {
      position: 'absolute',
      width: 150,
      height: 150,
      borderRadius: 75,
      bottom: -60,
      right: -20,
      backgroundColor: colors.goldPale,
    },
    eyebrow: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      letterSpacing: 1.2,
      color: colors.primary,
      marginBottom: SPACING.sm,
    },
    title: { fontFamily: FONTS.display, fontSize: 30, color: colors.text, marginBottom: SPACING.sm },
    subtitle: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardMuted,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      marginTop: SPACING.xl,
    },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatDivider: { width: 1, height: 34, backgroundColor: colors.borderLight },
    heroStatValue: { fontFamily: FONTS.semibold, fontSize: 20, color: colors.text },
    heroStatLabel: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 3 },
    nextCard: {
      marginTop: SPACING.lg,
      borderRadius: RADIUS.lg,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.md,
    },
    nextLabel: { fontFamily: FONTS.medium, fontSize: 11, color: colors.textMuted, marginBottom: 4 },
    nextTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.text, marginBottom: 2 },
    nextMeta: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary, marginBottom: SPACING.sm },
    progressTrack: {
      height: 8,
      borderRadius: RADIUS.full,
      backgroundColor: colors.borderLight,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: RADIUS.full },
    section: { marginBottom: SPACING.xl },
    sectionTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.text, marginBottom: SPACING.md },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.xl,
      alignItems: 'center',
    },
    emptyTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.text, marginTop: SPACING.md, marginBottom: 6 },
    emptySubtitle: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
    badgeCard: {
      width: '47.5%',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.md,
    },
    badgeIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    badgeTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.text, marginBottom: 4 },
    badgeDescription: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, minHeight: 54 },
    statusChip: {
      marginTop: SPACING.md,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
      borderRadius: RADIUS.full,
    },
    statusChipTxt: { fontFamily: FONTS.medium, fontSize: 11 },
    lockedList: { gap: SPACING.sm },
    lockedCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.md,
    },
    lockedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
    lockedTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
    lockedIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.cardMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockedCopy: { flex: 1 },
    lockedTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.text },
    lockedHint: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
    lockedProgressTrack: {
      height: 8,
      borderRadius: RADIUS.full,
      backgroundColor: colors.borderLight,
      overflow: 'hidden',
      marginBottom: SPACING.sm,
    },
    lockedProgressFill: { height: '100%', borderRadius: RADIUS.full },
    lockedProgressTxt: { fontFamily: FONTS.medium, fontSize: 12, color: colors.textSecondary },
  });
}
