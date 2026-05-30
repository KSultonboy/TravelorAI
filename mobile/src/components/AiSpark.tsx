import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import { useAppTheme } from '../theme/app-theme';

interface Props {
  size?: number;
  /** Show the soft aqua aura behind the spark. */
  glow?: boolean;
  /** Animate a gentle pulse (disabled automatically when reduce-motion is on). */
  animated?: boolean;
  color?: string;
  style?: ViewStyle;
}

// Four-point sparkle in a 24x24 viewBox.
const SPARK_PATH = 'M12 0 C13.2 7.2 16.8 10.8 24 12 C16.8 13.2 13.2 16.8 12 24 C10.8 16.8 7.2 13.2 0 12 C7.2 10.8 10.8 7.2 12 0 Z';

export default function AiSpark({ size = 28, glow = true, animated = true, color, style }: Props) {
  const { colors } = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useSharedValue(0);

  const sparkColor = color ?? colors.aiAccent;
  const sparkColorLight = colors.primaryLight;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduceMotion(v)).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (animated && !reduceMotion) {
      pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      pulse.value = 0;
    }
  }, [animated, reduceMotion, pulse]);

  const sparkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + pulse.value * 0.12 }, { rotate: `${pulse.value * 8}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + pulse.value * 0.4,
    transform: [{ scale: 0.9 + pulse.value * 0.25 }],
  }));

  return (
    <View style={[styles.wrap, { width: size * 2, height: size * 2 }, style]} pointerEvents="none">
      {glow ? (
        <Animated.View
          style={[
            styles.glow,
            { width: size * 1.9, height: size * 1.9, borderRadius: size, backgroundColor: colors.aiGlow },
            glowStyle,
          ]}
        />
      ) : null}
      <Animated.View style={sparkStyle}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Defs>
            <SvgGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={sparkColorLight} />
              <Stop offset="1" stopColor={sparkColor} />
            </SvgGradient>
          </Defs>
          <Path d={SPARK_PATH} fill="url(#sparkGrad)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
});
