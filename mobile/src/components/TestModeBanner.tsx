import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';

import { FONTS } from '../constants/fonts';
import { RADIUS, SPACING } from '../constants/spacing';
import { type AppColors, useAppTheme } from '../theme/app-theme';

const APP_STAGE = String(process.env.EXPO_PUBLIC_APP_STAGE || process.env.EXPO_PUBLIC_ENV || process.env.NODE_ENV || '')
  .trim()
  .toLowerCase();
const IS_PRODUCTION = APP_STAGE === 'production' || APP_STAGE === 'prod';

export default function TestModeBanner() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(true);

  if (IS_PRODUCTION || !visible) {
    return null;
  }

  return (
    <View style={[styles.wrap, { top: Math.max(Constants.statusBarHeight, 8) }]}>
      <View style={styles.banner}>
        <Ionicons name="flask-outline" size={15} color={colors.warning} />
        <Text style={styles.text}>
          {t('app.testModeBanner', {
            defaultValue: 'Test rejimi faol: ilova sinov serverida ishlayapti.',
          })}
        </Text>
        <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={14} color={colors.warning} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: SPACING.md,
      right: SPACING.md,
      zIndex: 1200,
      elevation: 20,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      paddingVertical: 10,
      backgroundColor: colors.warningPale,
      borderWidth: 1,
      borderColor: `${colors.warning}80`,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
    },
    text: {
      flex: 1,
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.text,
      lineHeight: 17,
    },
    closeBtn: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
  });
}
