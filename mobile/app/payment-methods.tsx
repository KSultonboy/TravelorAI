import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  StitchBottomSpace,
  StitchCard,
  StitchHeader,
  StitchScrollScreen,
  useStitchMobileStyles,
} from '../src/components/stitch/StitchMobile';
import { FONTS } from '../src/constants/fonts';

export default function PaymentMethodsScreen() {
  const { colors } = useStitchMobileStyles();

  return (
    <StitchScrollScreen>
      <StitchHeader title="To‘lov usullari" subtitle="Kartalar va hisob-kitob" back />
      <StitchCard>
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 18 }}>
          <Ionicons name="card-outline" size={30} color={colors.success} />
          <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: colors.text, textAlign: 'center' }}>To‘lov vaqtincha o‘chirilgan</Text>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, lineHeight: 20, textAlign: 'center' }}>
            Real payment keyingi relizda ulanadi. Hozir booking so‘rovi agentlikka yuboriladi.
          </Text>
        </View>
      </StitchCard>
      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
