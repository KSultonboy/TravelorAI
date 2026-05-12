import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ExploreMapProps } from './ExploreMap.types';

export default function ExploreMap({ disabledReason }: ExploreMapProps) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.title}>Map preview is mobile-only</Text>
      <Text style={styles.text}>
        {disabledReason || 'Use the Android development build to interact with native Yandex MapKit.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDE5DF',
    backgroundColor: '#F7FAF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#122117',
    marginBottom: 8,
    textAlign: 'center',
  },
  text: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4F6355',
    textAlign: 'center',
  },
});
