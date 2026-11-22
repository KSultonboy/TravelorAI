import React, { useEffect, useState } from 'react';
import { Alert, Linking, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  StitchBottomSpace,
  StitchCard,
  StitchHeader,
  StitchHero,
  StitchListRow,
  StitchScrollScreen,
  useStitchMobileStyles,
} from '../src/components/stitch/StitchMobile';
import { FONTS } from '../src/constants/fonts';
import { SPACING } from '../src/constants/spacing';
import { KEYS, getItem, saveItem } from '../src/utils/storage';
import {
  cancelProfessionalNotifications,
  getNotificationSupportInfo,
  requestNotificationPermission,
  scheduleProfessionalNotifications,
  sendLocalNotification,
} from '../src/utils/notifications';

const PRIVACY_URL = 'https://travelorai.com/privacy';
const TERMS_URL = 'https://travelorai.com/terms';

export default function SettingsScreen() {
  const { colors } = useStitchMobileStyles();
  const { t } = useTranslation();
  const [notif, setNotif] = useState(false);

  useEffect(() => {
    getItem(KEYS.NOTIFICATIONS_ENABLED).then((value) => setNotif(value === 'true'));
  }, []);

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('settings.linkErrorTitle'), url);
    }
  };

  const handleNotifToggle = async (value: boolean) => {
    if (value) {
      const support = getNotificationSupportInfo();
      if (!support.supported) {
        Alert.alert(t('profile.notifUnsupportedTitle'), support.reason || t('profile.notifUnsupportedMsg'));
        return;
      }

      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(t('profile.notifPermTitle'), t('profile.notifPermMsg'));
        return;
      }

      await sendLocalNotification(t('profile.notifEnabledTitle'), t('profile.notifEnabledBody'));
      await scheduleProfessionalNotifications();
    } else {
      await cancelProfessionalNotifications();
    }

    setNotif(value);
    await saveItem(KEYS.NOTIFICATIONS_ENABLED, String(value));
  };

  return (
    <StitchScrollScreen>
      <StitchHeader title={t('profile.settings')} subtitle={t('settings.subtitle')} back />
      <StitchHero title={t('settings.heroTitle')} subtitle={t('settings.heroSub')} />

      <StitchCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              backgroundColor: colors.successPale,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: colors.text }}>{t('profile.notifications')}</Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginTop: 3 }}>
              {notif ? t('profile.notifOn') : t('profile.notifOff')}
            </Text>
          </View>
          <Switch
            value={notif}
            onValueChange={handleNotifToggle}
            accessibilityLabel={t('profile.notifications')}
            trackColor={{ false: colors.borderLight, true: colors.success }}
            thumbColor={colors.surface}
          />
        </View>
      </StitchCard>

      <StitchCard>
        <StitchListRow icon="language-outline" title={t('settings.language')} subtitle="O‘zbek, Русский, English" onPress={() => router.push('/language' as any)} />
      </StitchCard>

      <StitchCard>
        <StitchListRow
          icon="shield-checkmark-outline"
          title={t('profile.privacy')}
          subtitle={t('settings.privacySub')}
          onPress={() => void openUrl(PRIVACY_URL)}
        />
        <StitchListRow
          icon="document-text-outline"
          title={t('settings.terms')}
          subtitle={t('settings.termsSub')}
          onPress={() => void openUrl(TERMS_URL)}
        />
        <StitchListRow icon="information-circle-outline" title={t('profile.about')} subtitle={t('profile.aboutMsg')} onPress={() => Alert.alert('TravelorAI', t('profile.aboutMsg'))} />
      </StitchCard>

      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
