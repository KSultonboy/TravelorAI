import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { getItem, KEYS } from '../src/utils/storage';
import { useAppTheme } from '../src/theme/app-theme';

export default function Index() {
  const { colors } = useAppTheme();

  useEffect(() => {
    async function check() {
      const onboarded = await getItem(KEYS.HAS_ONBOARDED);
      if (onboarded === 'true') {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    }
    check();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary }}>
      <ActivityIndicator color={colors.textInverse} size="large" />
    </View>
  );
}
