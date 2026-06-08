import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  StitchBottomSpace,
  StitchButton,
  StitchCard,
  StitchHeader,
  StitchHero,
  StitchListRow,
  StitchScrollScreen,
  useStitchMobileStyles,
} from '../src/components/stitch/StitchMobile';
import { FONTS } from '../src/constants/fonts';
import { SPACING } from '../src/constants/spacing';

const helpTopics = [
  ['planner', 'AI reja qanday tuziladi?', 'Budjet, shahar va qiziqishlaringizga qarab tavsiya qilinadi.', 'sparkles-outline'],
  ['maps', 'Xaritadagi joylar qayerdan olinadi?', 'Yandex source va TravelorAI tekshiruvlari asosida ko‘rsatiladi.', 'map-outline'],
  ['offline', 'Internet bo‘lmasa nima bo‘ladi?', 'Saqlangan trip va asosiy ma’lumotlar ilovada qoladi.', 'cloud-offline-outline'],
  ['account', 'Akkaunt va xavfsizlik', 'Login, parol tiklash va profil sozlamalari.', 'shield-checkmark-outline'],
] as const;

export default function HelpCenterScreen() {
  const { colors } = useStitchMobileStyles();

  return (
    <StitchScrollScreen>
      <StitchHeader title="Yordam markazi" subtitle="Savollar va javoblar" back />
      <StitchHero
        title="Qanday yordam kerak?"
        subtitle="Sayohat rejalari, xarita, to‘lov va akkaunt bo‘yicha tezkor yo‘riqnoma."
      />

      <StitchCard>
        {helpTopics.map(([key, title, subtitle, icon]) => (
          <StitchListRow key={key} icon={icon} title={title} subtitle={subtitle} />
        ))}
      </StitchCard>

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
            <Ionicons name="chatbubbles-outline" size={24} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 19, color: colors.text }}>Bizga yozing</Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted }}>
              Noto‘g‘ri joy, transport yoki narxni ko‘rsangiz feedback yuboring.
            </Text>
          </View>
        </View>
        <StitchButton title="Feedback yuborish" icon="send-outline" onPress={() => router.push('/feedback' as any)} />
      </StitchCard>

      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
