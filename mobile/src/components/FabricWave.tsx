import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

// ── Sizes ────────────────────────────────────────────────────────────────────
const FW = 88;   // fabric width
const FH = 210;  // fabric height

// ── Atlas palette ─────────────────────────────────────────────────────────────
const C = {
  bg:       '#F5F0E8',
  burgundy: '#6B1220',
  burLight: '#9B2335',
  teal:     '#1B5E5A',
  tealLt:   '#267A74',
  blue:     '#1A2A8F',
  blueLt:   '#2A3FAF',
  gold:     '#C8900A',
  goldLt:   '#E4AE28',
  white:    '#FFFFFF',
};

// ── Atlas motif (one repeating unit) ─────────────────────────────────────────
function Motif({ y, scale = 1 }: { y: number; scale?: number }) {
  const s = scale;
  const cx = FW / 2;
  return (
    <View style={{ position: 'absolute', top: y, left: 0, right: 0, alignItems: 'center' }}>
      {/* Teal background teardrop (wider) */}
      <View style={{
        position: 'absolute',
        width: 36 * s, height: 54 * s,
        borderTopLeftRadius: 18 * s, borderTopRightRadius: 18 * s,
        borderBottomLeftRadius: 6 * s, borderBottomRightRadius: 6 * s,
        backgroundColor: C.teal,
        top: -4 * s,
      }} />
      {/* Burgundy main teardrop */}
      <View style={{
        position: 'absolute',
        width: 28 * s, height: 46 * s,
        borderTopLeftRadius: 14 * s, borderTopRightRadius: 14 * s,
        borderBottomLeftRadius: 5 * s, borderBottomRightRadius: 5 * s,
        backgroundColor: C.burgundy,
        top: 0,
      }} />
      {/* Inner lighter burgundy */}
      <View style={{
        position: 'absolute',
        width: 18 * s, height: 30 * s,
        borderTopLeftRadius: 9 * s, borderTopRightRadius: 9 * s,
        borderBottomLeftRadius: 3 * s, borderBottomRightRadius: 3 * s,
        backgroundColor: C.burLight,
        top: 6 * s,
      }} />
      {/* Gold center dot */}
      <View style={{
        position: 'absolute',
        width: 8 * s, height: 10 * s,
        borderRadius: 4 * s,
        backgroundColor: C.gold,
        top: 14 * s,
      }} />
      {/* Gold inner dot */}
      <View style={{
        position: 'absolute',
        width: 4 * s, height: 5 * s,
        borderRadius: 2 * s,
        backgroundColor: C.goldLt,
        top: 16 * s,
      }} />
      {/* Left teal wing */}
      <View style={{
        position: 'absolute',
        width: 12 * s, height: 22 * s,
        borderTopLeftRadius: 6 * s, borderTopRightRadius: 2 * s,
        borderBottomLeftRadius: 2 * s, borderBottomRightRadius: 6 * s,
        backgroundColor: C.tealLt,
        top: 18 * s,
        left: cx - 26 * s,
        transform: [{ rotate: '-22deg' }],
      }} />
      {/* Right teal wing */}
      <View style={{
        position: 'absolute',
        width: 12 * s, height: 22 * s,
        borderTopLeftRadius: 2 * s, borderTopRightRadius: 6 * s,
        borderBottomLeftRadius: 6 * s, borderBottomRightRadius: 2 * s,
        backgroundColor: C.tealLt,
        top: 18 * s,
        left: cx + 14 * s,
        transform: [{ rotate: '22deg' }],
      }} />
      {/* Left blue curl */}
      <View style={{
        position: 'absolute',
        width: 8 * s, height: 16 * s,
        borderTopLeftRadius: 4 * s, borderTopRightRadius: 1 * s,
        borderBottomLeftRadius: 1 * s, borderBottomRightRadius: 4 * s,
        backgroundColor: C.blue,
        top: 30 * s,
        left: cx - 34 * s,
        transform: [{ rotate: '-15deg' }],
      }} />
      {/* Right blue curl */}
      <View style={{
        position: 'absolute',
        width: 8 * s, height: 16 * s,
        borderTopLeftRadius: 1 * s, borderTopRightRadius: 4 * s,
        borderBottomLeftRadius: 4 * s, borderBottomRightRadius: 1 * s,
        backgroundColor: C.blue,
        top: 30 * s,
        left: cx + 26 * s,
        transform: [{ rotate: '15deg' }],
      }} />
    </View>
  );
}

// ── Separator band (ikat-style jagged stripe) ────────────────────────────────
function Band({ y, color }: { y: number; color: string }) {
  const count = 7;
  return (
    <View style={{ position: 'absolute', top: y, left: 0, right: 0, flexDirection: 'row', height: 7 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 7, backgroundColor: i % 2 === 0 ? color : C.white }} />
      ))}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FabricWave() {
  const rotY = useRef(new Animated.Value(0)).current;
  const rotX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Primary wave: rotateY — simulates wind gusts (left-edge pivot)
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotY, { toValue: 28, duration: 850,  easing: Easing.out(Easing.sin),    useNativeDriver: true }),
        Animated.timing(rotY, { toValue: 10, duration: 600,  easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
        Animated.timing(rotY, { toValue: 24, duration: 750,  easing: Easing.out(Easing.sin),    useNativeDriver: true }),
        Animated.timing(rotY, { toValue: 6,  duration: 550,  easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
        Animated.timing(rotY, { toValue: 20, duration: 900,  easing: Easing.out(Easing.sin),    useNativeDriver: true }),
        Animated.timing(rotY, { toValue: 0,  duration: 700,  easing: Easing.in(Easing.sin),     useNativeDriver: true }),
        Animated.delay(400),
      ])
    ).start();

    // Secondary wave: rotateX — gentle flutter
    Animated.loop(
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(rotX, { toValue: 8,  duration: 1100, easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
        Animated.timing(rotX, { toValue: -5, duration: 900,  easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
        Animated.timing(rotX, { toValue: 6,  duration: 1000, easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
        Animated.timing(rotX, { toValue: 0,  duration: 800,  easing: Easing.in(Easing.sin),     useNativeDriver: true }),
        Animated.delay(300),
      ])
    ).start();
  }, [rotY, rotX]);

  const rotateY = rotY.interpolate({ inputRange: [0, 30], outputRange: ['0deg', '30deg'] });
  const rotateX = rotX.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] });

  return (
    <View style={styles.anchor} pointerEvents="none">
      <Animated.View
        style={[
          styles.fabric,
          {
            transform: [
              { perspective: 480 },
              // Pivot at LEFT edge: shift right by half-width → rotate → shift back
              { translateX: FW / 2 },
              { rotateY },
              { translateX: -(FW / 2) },
              { rotateX },
            ],
          },
        ]}
      >
        {/* Background */}
        <View style={styles.bg} />

        {/* Yellow border strip (left + right, like atlas selvage) */}
        <View style={[styles.edgeStrip, { left: 0 }]} />
        <View style={[styles.edgeStrip, { right: 0 }]} />

        {/* Band rows */}
        <Band y={0}   color={C.teal}    />
        <Band y={68}  color={C.blue}    />
        <Band y={136} color={C.burgundy}/>
        <Band y={200} color={C.teal}    />

        {/* Motifs */}
        <Motif y={8}   />
        <Motif y={76}  />
        <Motif y={144} />

        {/* Top fold shadow */}
        <View style={styles.topFold} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    top: 0,
    left: -6,
    zIndex: 0,  // behind all content
    opacity: 0.18,
  },
  fabric: {
    width: FW,
    height: FH,
    overflow: 'hidden',
    borderBottomRightRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
  },
  edgeStrip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: C.gold,
    opacity: 0.9,
  },
  topFold: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
});
