import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Defs, LinearGradient as SvgGradient, RadialGradient as SvgRadial, Stop } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useAppTheme } from '../theme/app-theme';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const MERIDIAN_COUNT = 6;
const LATITUDES = [-0.62, -0.32, 0, 0.32, 0.62];

interface Props {
  size?: number;
  style?: ViewStyle;
  /** Glow halo behind the globe. */
  glow?: boolean;
}

function Meridian({ phase, spin, r, c, stroke }: { phase: number; spin: SharedValue<number>; r: number; c: number; stroke: string }) {
  const props = useAnimatedProps(() => {
    'worklet';
    const rx = Math.abs(r * Math.cos(phase + spin.value));
    return { rx: Math.max(0.4, rx) };
  });
  return <AnimatedEllipse cx={c} cy={c} ry={r} animatedProps={props} stroke={stroke} strokeWidth={1.1} fill="none" opacity={0.55} />;
}

/**
 * Lightweight pseudo-3D rotating globe (SVG + Reanimated, UI-thread).
 * Meridians sweep to imply a sphere spinning on its axis. Reduce-motion aware.
 */
export default function Globe3D({ size = 200, glow = true, style }: Props) {
  const { colors } = useAppTheme();
  const spin = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduceMotion(v)).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!reduceMotion) {
      spin.value = withRepeat(withTiming(Math.PI * 2, { duration: 9000, easing: Easing.linear }), -1, false);
    } else {
      spin.value = 0.6;
    }
    return () => cancelAnimation(spin);
  }, [reduceMotion, spin]);

  const c = size / 2;
  const r = size / 2 - 6;

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]} pointerEvents="none">
      {glow ? (
        <View
          style={[
            styles.glow,
            { width: size * 0.95, height: size * 0.95, borderRadius: size, backgroundColor: colors.aiGlow },
          ]}
        />
      ) : null}
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgGradient id="globeEdge" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.aiAccent} />
            <Stop offset="1" stopColor={colors.primary} />
          </SvgGradient>
          <SvgRadial id="globeFill" cx="38%" cy="34%" r="75%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.35" />
            <Stop offset="1" stopColor={colors.primaryDark} stopOpacity="0.08" />
          </SvgRadial>
        </Defs>

        {/* Sphere body */}
        <Circle cx={c} cy={c} r={r} fill="url(#globeFill)" stroke="url(#globeEdge)" strokeWidth={1.6} />

        {/* Latitudes (static rings flattened by perspective) */}
        {LATITUDES.map((f, i) => {
          const dy = f * r;
          const rx = Math.sqrt(Math.max(0, r * r - dy * dy));
          return (
            <Ellipse
              key={`lat-${i}`}
              cx={c}
              cy={c + dy}
              rx={rx}
              ry={rx * 0.16}
              stroke={colors.aiAccent}
              strokeWidth={0.9}
              fill="none"
              opacity={0.4}
            />
          );
        })}

        {/* Meridians (animated sweep) */}
        {Array.from({ length: MERIDIAN_COUNT }).map((_, i) => (
          <Meridian key={`mer-${i}`} phase={(Math.PI / MERIDIAN_COUNT) * i} spin={spin} r={r} c={c} stroke="url(#globeEdge)" />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
});
