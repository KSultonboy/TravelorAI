import { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { getItem, KEYS } from '../src/utils/storage';
import AuroraBackground from '../src/components/AuroraBackground';
import Globe3D from '../src/components/Globe3D';
import AnimatedBrand from '../src/components/AnimatedBrand';
import { FONTS } from '../src/constants/fonts';
import { SPACING } from '../src/constants/spacing';

// Splash is always the dark brand moment, so text is forced light regardless of theme.
const LIGHT = '#F7FAFC';

export default function Index() {
  useEffect(() => {
    async function check() {
      const onboarded = await getItem(KEYS.HAS_ONBOARDED);
      if (onboarded === 'true') {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    }
    const t = setTimeout(check, 1100);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.fill}>
      <AuroraBackground />
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Globe3D size={196} />
        <AnimatedBrand size={36} textStyle={{ color: LIGHT }} style={styles.brand} />
        <Text style={styles.subtitle}>Your AI Travel Companion</Text>
      </View>
      <Text style={styles.footer}>TravelorAI</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#071827' },
  center: { justifyContent: 'center', alignItems: 'center' },
  brand: { marginTop: SPACING.xl },
  subtitle: { marginTop: SPACING.sm, fontFamily: FONTS.regular, fontSize: 14, color: 'rgba(247,250,252,0.78)' },
  footer: {
    position: 'absolute',
    bottom: SPACING.xxl,
    alignSelf: 'center',
    fontFamily: FONTS.regular,
    fontSize: 12,
    letterSpacing: 1,
    color: 'rgba(247,250,252,0.55)',
  },
});
