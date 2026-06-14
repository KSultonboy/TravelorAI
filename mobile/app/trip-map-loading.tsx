import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import AuroraBackground from '../src/components/AuroraBackground';
import LottieAnim from '../src/components/LottieAnim';
import { FONTS } from '../src/constants/fonts';
import { SPACING } from '../src/constants/spacing';

const LIGHT = '#F7FAFC';

export default function TripMapLoadingScreen() {
  const insets = useSafeAreaInsets();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { t } = useTranslation();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace({
        pathname: '/(tabs)/explore',
        params: tripId ? { tripId } : {},
      } as any);
    }, 1200);

    return () => clearTimeout(timeout);
  }, [tripId]);

  return (
    <View style={styles.fill}>
      <AuroraBackground />
      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LottieAnim name="ai-loading" size={140} />
        <Text style={styles.title}>{t('trips.mapLoadingTitle')}</Text>
        <Text style={styles.sub}>{t('trips.mapLoadingSub')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#051F20' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg },
  title: { marginTop: SPACING.md, fontFamily: FONTS.semibold, fontSize: 17, color: LIGHT, textAlign: 'center' },
  sub: { marginTop: SPACING.xs, fontFamily: FONTS.regular, fontSize: 13, color: 'rgba(247,250,252,0.72)', textAlign: 'center', lineHeight: 20 },
});
