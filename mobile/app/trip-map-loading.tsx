import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import AiSpark from '../src/components/AiSpark';
import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';

export default function TripMapLoadingScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace({
        pathname: '/(tabs)/explore',
        params: tripId ? { tripId } : {},
      } as any);
    }, 120);

    return () => clearTimeout(timeout);
  }, [tripId]);

  return (
    <LinearGradient
      colors={colors.gradientHero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={styles.card}>
        <AiSpark size={48} glow animated />
        <Text style={styles.title}>{t('trips.mapLoadingTitle')}</Text>
        <Text style={styles.sub}>{t('trips.mapLoadingSub')}</Text>
      </View>
    </LinearGradient>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
    },
    card: {
      width: '100%',
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.xl,
      gap: SPACING.sm,
    },
    title: {
      marginTop: SPACING.sm,
      fontFamily: FONTS.semibold,
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
    },
    sub: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
