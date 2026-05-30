import React from 'react';
import { type ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

const SOURCES = {
  'ai-loading': require('../../assets/lottie/ai-loading.json'),
  success: require('../../assets/lottie/success.json'),
} as const;

export type LottieName = keyof typeof SOURCES;

interface Props {
  name: LottieName;
  size?: number;
  loop?: boolean;
  autoPlay?: boolean;
  style?: ViewStyle;
}

export default function LottieAnim({ name, size = 120, loop = true, autoPlay = true, style }: Props) {
  return (
    <LottieView
      source={SOURCES[name]}
      autoPlay={autoPlay}
      loop={loop}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
