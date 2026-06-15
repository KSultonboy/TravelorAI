import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Button from '../src/components/Button';
import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { aiGlowShadow } from '../src/constants/effects';
import { LANGUAGE_OPTIONS, type Language } from '../src/i18n';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';
import { KEYS, getItem, saveItem } from '../src/utils/storage';

const { width } = Dimensions.get('window');

function normalizeLanguage(value: string | undefined): Language {
  if (value?.startsWith('ru')) return 'ru';
  if (value?.startsWith('en')) return 'en';
  return 'uz';
}

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const [language, setLanguage] = useState<Language>('uz');
  const flatRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const styles = createStyles(colors);

  useEffect(() => {
    setLanguage(normalizeLanguage(i18n.resolvedLanguage || i18n.language));
  }, [i18n.language, i18n.resolvedLanguage]);

  const slides = useMemo(
    () =>
      language === 'en'
        ? [
            {
              id: '1',
              icon: 'earth-outline',
              title: 'Discover the world',
              desc: 'Plan any destination, dates and budget in one app.',
            },
            {
              id: '2',
              icon: 'wallet-outline',
              title: 'A plan that fits your budget',
              desc: 'Enter your budget. AI automatically builds the best route for you.',
            },
            {
              id: '3',
              icon: 'airplane-outline',
              title: 'Ready to travel!',
              desc: 'Daily itinerary, cost breakdown and local tips make travel easy.',
            },
          ]
        : language === 'uz'
          ? [
              {
                id: '1',
                icon: 'earth-outline',
                title: 'Dunyoni kashf eting',
                desc: "Istalgan manzil, sana va budjetni bitta ilova orqali rejalang.",
              },
              {
                id: '2',
                icon: 'wallet-outline',
                title: 'Budjetingizga mos reja',
                desc: "Byudjetingizni kiriting. Sun'iy intellekt eng yaxshi marshrutni avtomatik tuzadi.",
              },
              {
                id: '3',
                icon: 'airplane-outline',
                title: 'Sayohatga tayyor!',
                desc: 'Kunlik reja, xarajat taqsimoti va mahalliy maslahatlar bilan sayohat osonlashadi.',
              },
            ]
        : [
            {
              id: '1',
              icon: 'earth-outline',
              title: t('onboarding.slide1Title'),
              desc: t('onboarding.slide1Sub'),
            },
            {
              id: '2',
              icon: 'wallet-outline',
              title: t('onboarding.slide2Title'),
              desc: t('onboarding.slide2Sub'),
            },
            {
              id: '3',
              icon: 'airplane-outline',
              title: t('onboarding.slide3Title'),
              desc: t('onboarding.slide3Sub'),
            },
          ],
    [language, t]
  );

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleLanguageChange = async (nextLanguage: Language) => {
    if (nextLanguage === language) return;
    setLanguage(nextLanguage);
    await i18n.changeLanguage(nextLanguage);
    await saveItem(KEYS.LANGUAGE, nextLanguage);
  };

  const next = () => {
    if (current < slides.length - 1) {
      const nextIndex = current + 1;
      flatRef.current?.scrollToIndex({ index: nextIndex });
      setCurrent(nextIndex);
      return;
    }

    void finish();
  };

  const finish = async () => {
    await saveItem(KEYS.HAS_ONBOARDED, 'true');
    // Onboarding'dan keyin auth (majburiy emas — login'da "Skip" bor).
    const token = await getItem(KEYS.TOKEN);
    router.replace(token ? '/(tabs)' : '/login');
  };

  const showSkip = current < slides.length - 1;

  return (
    <LinearGradient colors={[colors.background, colors.backgroundAccent, colors.background]} style={styles.fill}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <FlatList
          ref={flatRef}
          data={slides}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <View style={styles.iconWrap}>
                <View style={styles.iconGlow} />
                <Ionicons name={item.icon as any} size={56} color={colors.aiAccent} />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.desc}>{item.desc}</Text>
            </View>
          )}
        />

        <View style={styles.dots}>
          {slides.map((_, index) => (
            <View key={index} style={[styles.dot, index === current && styles.dotActive]} />
          ))}
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
          <Button
            title={current === slides.length - 1 ? t('onboarding.start') : t('onboarding.next')}
            onPress={next}
            variant="primary"
            size="lg"
          />

          <View style={styles.bottomRow}>
            {showSkip ? (
              <TouchableOpacity onPress={() => void finish()} style={styles.skipBtn} activeOpacity={0.82}>
                <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={[styles.languageGroup, !showSkip && styles.languageGroupFull]}>
              {LANGUAGE_OPTIONS.map((option) => {
                const active = option.key === language;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.languageChip, active && styles.languageChipActive]}
                    onPress={() => void handleLanguageChange(option.key)}
                    activeOpacity={0.82}
                  >
                    <Text style={[styles.languageText, active && styles.languageTextActive]}>
                      {option.key.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    fill: { flex: 1 },
    container: { flex: 1 },
    slide: {
      width,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xxl,
      paddingBottom: 120,
    },
    iconWrap: {
      width: 132,
      height: 132,
      borderRadius: RADIUS.full,
      backgroundColor: colors.aiAccentPale,
      borderWidth: 1,
      borderColor: colors.aiAccent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.xxl,
      ...aiGlowShadow(colors),
    },
    iconGlow: {
      position: 'absolute',
      width: 100,
      height: 100,
      borderRadius: RADIUS.full,
      backgroundColor: colors.aiGlow,
    },
    title: {
      fontFamily: FONTS.display,
      fontSize: 27,
      color: colors.text,
      textAlign: 'center',
      marginBottom: SPACING.lg,
    },
    desc: {
      fontFamily: FONTS.regular,
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.xl,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: RADIUS.full,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 24,
      backgroundColor: colors.aiAccent,
    },
    footer: {
      paddingHorizontal: SPACING.xl,
      gap: SPACING.md,
    },
    bottomRow: {
      width: '100%',
      flexDirection: 'row',
      gap: SPACING.sm,
      alignItems: 'center',
    },
    skipBtn: {
      flex: 1,
      minHeight: 46,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
    },
    skipText: {
      fontFamily: FONTS.medium,
      fontSize: 14,
      color: colors.textMuted,
    },
    languageGroup: {
      flex: 1,
      flexDirection: 'row',
      gap: 4,
      minHeight: 46,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 4,
    },
    languageGroupFull: {
      width: '100%',
      flex: undefined,
    },
    languageChip: {
      flex: 1,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    languageChipActive: {
      backgroundColor: colors.aiAccentPale,
    },
    languageText: {
      fontFamily: FONTS.semibold,
      fontSize: 13,
      color: colors.textMuted,
    },
    languageTextActive: {
      color: colors.aiAccent,
    },
  });
}
