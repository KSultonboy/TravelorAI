import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '../../src/constants/fonts';
import { aiGlowShadow } from '../../src/constants/effects';
import { type AppColors, useAppTheme } from '../../src/theme/app-theme';

export default function TabLayout() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets.bottom);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.aiAccent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.tabItem,
        tabBarBackground: () => (
          <View style={styles.tabBarBg}>
            <BlurView intensity={50} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
            <View style={styles.tabBarTint} />
          </View>
        ),
        tabBarIcon: ({ focused, color }) => {
          const icons: Record<string, [string, string]> = {
            index: ['home', 'home-outline'],
            planner: ['map', 'map-outline'],
            explore: ['compass', 'compass-outline'],
            profile: ['person', 'person-outline'],
          };

          const [active, inactive] = icons[route.name] || ['ellipse', 'ellipse-outline'];

          return (
            <View style={styles.iconWrap}>
              <View style={[styles.iconSurface, focused && styles.iconSurfaceActive]}>
                <Ionicons name={(focused ? active : inactive) as any} size={focused ? 22 : 21} color={color} />
              </View>
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="planner" options={{ title: t('tabs.planner') }} />
      <Tabs.Screen name="explore" options={{ title: t('tabs.explore') }} />
      <Tabs.Screen name="trips" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}

function createStyles(colors: AppColors, bottomInset: number) {
  const safeBottom = Math.max(bottomInset, 22);

  return StyleSheet.create({
    tabBar: {
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      height: 66 + safeBottom,
      marginHorizontal: 18,
      marginBottom: 10,
      paddingTop: 6,
      paddingBottom: 8 + safeBottom,
      borderRadius: 26,
      position: 'absolute',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 14,
    },
    tabBarBg: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 26,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.glassStrong,
    },
    tabBarTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.tabBar,
    },
    tabItem: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 2,
      paddingBottom: 0,
    },
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 34,
    },
    iconSurface: {
      width: 38,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconSurfaceActive: {
      backgroundColor: colors.aiAccentPale,
      ...aiGlowShadow(colors),
    },
    label: {
      fontFamily: FONTS.medium,
      fontSize: 10,
      marginTop: 0,
    },
  });
}
