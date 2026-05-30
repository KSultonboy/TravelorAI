import { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { getItem, KEYS } from '../src/utils/storage';
import { useAppTheme } from '../src/theme/app-theme';
import AnimatedBrand from '../src/components/AnimatedBrand';
import { FONTS } from '../src/constants/fonts';
import { SPACING } from '../src/constants/spacing';

export default function Index() {
  const { colors } = useAppTheme();

  useEffect(() => {
    async function check() {
      const onboarded = await getItem(KEYS.HAS_ONBOARDED);
      if (onboarded === 'true') {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    }
    const t = setTimeout(check, 650);
    return () => clearTimeout(t);
  }, []);

  return (
    <LinearGradient colors={colors.gradientHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
      <View style={styles.center}>
        <AnimatedBrand size={40} subtitle="Your AI Travel Companion" />
      </View>
      <Text style={[styles.footer, { color: colors.textSecondary }]}>TravelorAI</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: SPACING.xxl, fontFamily: FONTS.regular, fontSize: 12, letterSpacing: 1 },
});
