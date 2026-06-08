import React, { useEffect, useRef, memo } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

const COLORS = [
  'rgba(255, 182, 193, 0.90)',
  'rgba(255, 145, 168, 0.85)',
  'rgba(255, 210, 220, 0.88)',
  'rgba(248, 118, 152, 0.78)',
  'rgba(255, 226, 234, 0.92)',
  'rgba(255, 162, 183, 0.84)',
  'rgba(252, 135, 160, 0.80)',
];

const PETAL_COUNT = 14;

// ── Diagonal vector ─────────────────────────────────────────────────────────
// Top-left → bottom-right: angle from vertical 32°–47°, driftX is POSITIVE
function diagonalDrift(idx: number) {
  const angleDeg = 32 + (idx % 6) * 3;           // 32° · 35° · 38° · 41° · 44° · 47°
  const fallY = H + 180;                          // past tab bar
  const driftX = fallY * Math.tan((angleDeg * Math.PI) / 180);
  return { fallY, driftX };
}

// ── Petal shapes ─────────────────────────────────────────────────────────────
// Each shape is a pair of [outerStyle, innerHighlightStyle]

function LensPetal({ size, color }: { size: number; color: string }) {
  // Asymmetric "lens" — the classic petal form when tumbling
  return (
    <View
      style={{
        width: size,
        height: size * 1.15,
        borderTopLeftRadius: size * 0.94,
        borderTopRightRadius: size * 0.06,
        borderBottomLeftRadius: size * 0.06,
        borderBottomRightRadius: size * 0.94,
        backgroundColor: color,
        overflow: 'hidden',
      }}
    >
      <View style={[styles.shine, { width: size * 0.36, height: size * 0.26 }]} />
      <View style={styles.vein} />
    </View>
  );
}

function TeardropPetal({ size, color }: { size: number; color: string }) {
  // Rounded top, gently tapered bottom — like a sakura / cherry blossom petal
  return (
    <View
      style={{
        width: size * 1.08,
        height: size,
        borderTopLeftRadius: size * 0.9,
        borderTopRightRadius: size * 0.9,
        borderBottomLeftRadius: size * 0.2,
        borderBottomRightRadius: size * 0.2,
        backgroundColor: color,
        overflow: 'hidden',
      }}
    >
      <View style={[styles.shine, { width: size * 0.40, height: size * 0.26 }]} />
      <View style={styles.vein} />
    </View>
  );
}

function OvalPetal({ size, color }: { size: number; color: string }) {
  // Slender oval — small background petal for depth
  return (
    <View
      style={{
        width: size * 0.72,
        height: size * 1.25,
        borderRadius: size * 0.5,
        backgroundColor: color,
        overflow: 'hidden',
      }}
    >
      <View style={[styles.shine, { width: size * 0.28, height: size * 0.20 }]} />
      <View style={styles.vein} />
    </View>
  );
}

// ── Single Petal ─────────────────────────────────────────────────────────────

const Petal = memo(({ index }: { index: number }) => {
  const ty  = useRef(new Animated.Value(-50)).current;
  const tx  = useRef(new Animated.Value(0)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const op  = useRef(new Animated.Value(0)).current;

  const cfg = useRef(() => {
    const { fallY, driftX } = diagonalDrift(index);
    return {
      // Start from LEFT side: some off-screen left, rest across left ~40% of screen
      startX: -20 + (W * 0.45 * index) / PETAL_COUNT,
      size: 10 + (index % 4) * 2.5,          // 10 · 12.5 · 15 · 17.5 px
      color: COLORS[index % COLORS.length],
      shape: index % 3,                        // 0 = lens · 1 = teardrop · 2 = oval
      duration: 5500 + (index % 6) * 650,     // 5.5 s – 9.25 s
      delay: (index * 680) % 7500,            // initial stagger 0–7.5 s
      fallY,
      driftX,
      spins: 0.45 + (index % 5) * 0.22,      // 0.45 – 1.33 full turns
    };
  }).current();

  useEffect(() => {
    const { duration, delay, fallY, driftX, spins } = cfg;

    ty.setValue(-50);
    tx.setValue(0);
    rot.setValue(0);
    op.setValue(0);

    const fall = Animated.parallel([
      Animated.timing(ty,  { toValue: fallY,  duration, useNativeDriver: true }),
      Animated.timing(tx,  { toValue: driftX, duration, useNativeDriver: true }),
      Animated.timing(rot, { toValue: spins,  duration, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(op, { toValue: 0.85, duration: 550,              useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.85, duration: duration - 1050,  useNativeDriver: true }),
        Animated.timing(op, { toValue: 0,    duration: 500,              useNativeDriver: true }),
      ]),
    ]);

    const timer = setTimeout(() => Animated.loop(fall).start(), delay);
    return () => {
      clearTimeout(timer);
      [ty, tx, rot, op].forEach((v) => v.stopAnimation());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const { startX, size, color, shape } = cfg;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: -50,
        left: startX,
        opacity: op,
        transform: [{ translateY: ty }, { translateX: tx }, { rotate: spin }],
      }}
    >
      {shape === 0 && <LensPetal size={size} color={color} />}
      {shape === 1 && <TeardropPetal size={size} color={color} />}
      {shape === 2 && <OvalPetal size={size} color={color} />}
    </Animated.View>
  );
});

Petal.displayName = 'Petal';

// ── Export ───────────────────────────────────────────────────────────────────

export default function FallingPetals() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: PETAL_COUNT }, (_, i) => <Petal key={i} index={i} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  // Glossy highlight near the upper-left of each petal
  shine: {
    position: 'absolute',
    top: '10%',
    left: '12%',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.44)',
    transform: [{ rotate: '-14deg' }],
  },
  // Thin central vein
  vein: {
    position: 'absolute',
    top: '8%',
    left: '50%',
    width: 1,
    height: '72%',
    backgroundColor: 'rgba(255, 255, 255, 0.30)',
    borderRadius: 1,
  },
});
