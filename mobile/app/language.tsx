import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  StitchBottomSpace,
  StitchButton,
  StitchCard,
  StitchHeader,
  StitchHero,
  StitchScrollScreen,
  useStitchMobileStyles,
} from '../src/components/stitch/StitchMobile';
import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { LANGUAGE_OPTIONS, type Language } from '../src/i18n';
import { getItem, KEYS, saveItem } from '../src/utils/storage';

export default function LanguageScreen() {
  const { colors } = useStitchMobileStyles();
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState<Language>('uz');

  useEffect(() => {
    getItem(KEYS.LANGUAGE).then((saved) => {
      if (saved === 'uz' || saved === 'ru' || saved === 'en') setLanguage(saved);
    });
  }, []);

  const selectLanguage = async (next: Language) => {
    setLanguage(next);
    await i18n.changeLanguage(next);
    await saveItem(KEYS.LANGUAGE, next);
  };

  return (
    <StitchScrollScreen>
      <StitchHeader title="Tilni tanlash" subtitle="Ilova tilini sozlang" back />
      <StitchHero
        title="Qaysi tilda davom etamiz?"
        subtitle="TravelorAI siz tanlagan tilda marshrut, maslahat va bildirishnomalarni ko‘rsatadi."
      />

      <StitchCard>
        {LANGUAGE_OPTIONS.map((item) => {
          const active = item.key === language;
          return (
            <TouchableOpacity
              key={item.key}
              style={{
                minHeight: 64,
                borderRadius: 20,
                backgroundColor: active ? colors.successPale : colors.cardMuted,
                borderWidth: 1,
                borderColor: active ? colors.success : colors.borderLight,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: SPACING.md,
                gap: SPACING.md,
              }}
              onPress={() => void selectLanguage(item.key)}
              activeOpacity={0.84}
            >
              <Text style={{ fontSize: 24 }}>{item.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: colors.text }}>{item.label}</Text>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>{item.key.toUpperCase()}</Text>
              </View>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: RADIUS.full,
                  backgroundColor: active ? colors.success : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {active ? <Ionicons name="checkmark" size={16} color={colors.textInverse} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </StitchCard>

      <StitchButton title="Davom etish" icon="arrow-forward" onPress={() => router.back()} />
      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
