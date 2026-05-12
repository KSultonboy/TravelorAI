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
import { SPACING } from '../src/constants/spacing';

export default function ItineraryDayScreen() {
  const { colors } = useStitchMobileStyles();

  return (
    <StitchScrollScreen>
      <StitchHeader title="Kun rejasi" subtitle="Saqlangan itinerary" back />
      <StitchCard>
        <View style={{ alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg }}>
          <Ionicons name="calendar-outline" size={30} color={colors.success} />
          <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: colors.text, textAlign: 'center' }}>Kun rejasi topilmadi</Text>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: 'center' }}>
            Bu sahifa endi faqat saqlangan trip ma’lumotlari bilan to‘ldiriladi.
          </Text>
        </View>
      </StitchCard>
      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
