import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import AiSpark from './AiSpark';
import { FONTS } from '../constants/fonts';
import { SPACING } from '../constants/spacing';
import { type AppColors, useAppTheme } from '../theme/app-theme';

const DEFAULT_MESSAGES = [
  'Analyzing your preferences…',
  'Finding best destinations…',
  'Building your itinerary…',
  'Optimizing your route…',
  'Preparing your smart travel plan…',
];

interface Props {
  /** Rotating status lines. Pass translated strings to localize. */
  messages?: string[];
  /** Fixed single message (overrides rotation). */
  message?: string;
  size?: number;
  style?: ViewStyle;
}

export default function AiThinking({ messages = DEFAULT_MESSAGES, message, size = 40, style }: Props) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (message) return;
    let reduce = false;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduce = v)).catch(() => {});
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, reduce ? 4200 : 2200);
    return () => clearInterval(id);
  }, [message, messages.length]);

  const label = message ?? messages[index];

  return (
    <View style={[styles.wrap, style]}>
      <AiSpark size={size} glow animated />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    label: {
      marginTop: SPACING.md,
      fontFamily: FONTS.medium,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
}
