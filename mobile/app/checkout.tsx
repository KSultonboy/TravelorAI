import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  StitchBottomSpace,
  StitchButton,
  StitchCard,
  StitchHeader,
  StitchScrollScreen,
  useStitchMobileStyles,
} from '../src/components/stitch/StitchMobile';
import { FONTS } from '../src/constants/fonts';
import { SPACING } from '../src/constants/spacing';

export default function CheckoutScreen() {
  const { colors } = useStitchMobileStyles();

  return (
    <StitchScrollScreen>
      <StitchHeader title="Booking request" subtitle="To'lov moduli vaqtincha o'chiq" back />

      <StitchCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 20,
              backgroundColor: colors.successPale,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={27} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: colors.text }}>
              {"To'lov keyingi bosqichda ulanadi"}
            </Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>
              {"Hozircha booking so'rovlari agency bilan aloqa orqali tasdiqlanadi."}
            </Text>
          </View>
        </View>
      </StitchCard>

      <StitchCard>
        <Text style={{ fontFamily: FONTS.display, fontSize: 19, color: colors.text }}>Keyingi oqim</Text>
        <Text style={{ fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted, marginTop: 8 }}>
          {"User booking yuboradi, agency kabinetida request ko'rinadi, admin esa statusni nazorat qiladi."}
          Payment provider tanlangandan keyin bu sahifa real checkoutga ulanadi.
        </Text>
      </StitchCard>

      <StitchButton title="Orqaga qaytish" icon="arrow-back-outline" onPress={() => router.back()} />
      <StitchButton title="Keyinroq" variant="ghost" onPress={() => router.back()} />
      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
