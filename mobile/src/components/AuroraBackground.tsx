import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { Canvas, Fill, Circle, RadialGradient, Blur, Group, vec, useClock } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

// Fixed brand palette so the aurora always reads as the premium dark moment,
// regardless of the active light/dark theme (splash, onboarding, AI loading).
const BASE = '#071827';
const FADE = '#07182700'; // BASE with alpha 00 (transparent)
const SKY = '#2D9CDB';
const AQUA = '#56E0D8';
const TEAL = '#1FB8AE';

interface Props {
  children?: React.ReactNode;
  style?: ViewStyle;
  /** 0..1 — how strong the aurora glow reads. */
  intensity?: number;
}

/**
 * Animated aurora / mesh-gradient background rendered with Skia.
 * Soft brand-colored blobs drift over the deep-navy base for a premium AI feel.
 * Respects reduce-motion (blobs hold still).
 */
export default function AuroraBackground({ children, style, intensity = 0.6 }: Props) {
  const { width, height } = useWindowDimensions();
  const clock = useClock();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduceMotion(v)).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const r = Math.max(width, height) * 0.7;

  const p1 = useDerivedValue(() => {
    const t = reduceMotion ? 0 : clock.value / 1000;
    return vec(width * 0.28 + Math.sin(t * 0.5) * width * 0.18, height * 0.22 + Math.cos(t * 0.4) * height * 0.1);
  });
  const p2 = useDerivedValue(() => {
    const t = reduceMotion ? 0 : clock.value / 1000;
    return vec(width * 0.78 + Math.cos(t * 0.45) * width * 0.16, height * 0.4 + Math.sin(t * 0.35) * height * 0.12);
  });
  const p3 = useDerivedValue(() => {
    const t = reduceMotion ? 0 : clock.value / 1000;
    return vec(width * 0.5 + Math.sin(t * 0.3) * width * 0.2, height * 0.8 + Math.cos(t * 0.5) * height * 0.08);
  });

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill color={BASE} />
        <Group blendMode="screen" opacity={intensity}>
          <Circle c={p1} r={r}>
            <RadialGradient c={p1} r={r} colors={[SKY, FADE]} />
            <Blur blur={50} />
          </Circle>
          <Circle c={p2} r={r * 0.9}>
            <RadialGradient c={p2} r={r * 0.9} colors={[AQUA, FADE]} />
            <Blur blur={55} />
          </Circle>
          <Circle c={p3} r={r * 0.8}>
            <RadialGradient c={p3} r={r * 0.8} colors={[TEAL, FADE]} />
            <Blur blur={60} />
          </Circle>
        </Group>
      </Canvas>
      {children}
    </View>
  );
}
