import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

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
import { paymentsAPI, type MyPaymentsResponse } from '../src/utils/api';
import { extractApiData } from '../src/utils/auth';
import { getItem, KEYS } from '../src/utils/storage';

function formatUzs(amount: number): string {
  return `${Math.round(amount).toLocaleString('uz-UZ')} so'm`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PaymentMethodsScreen() {
  const { colors } = useStitchMobileStyles();

  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [data, setData] = useState<MyPaymentsResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const token = await getItem(KEYS.TOKEN);
        if (!active) return;
        setIsLoggedIn(Boolean(token));
        if (token) {
          try {
            const payload = extractApiData<MyPaymentsResponse>(await paymentsAPI.getMine());
            if (active) setData(payload);
          } catch {
            // tarmoq xatosi — quyida bo'sh holat ko'rinadi
          }
        }
        if (active) setIsReady(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (!isReady) {
    return (
      <StitchScrollScreen>
        <StitchHeader title="To‘lovlar" subtitle="Yuklanmoqda..." back />
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <ActivityIndicator color={colors.success} />
        </View>
      </StitchScrollScreen>
    );
  }

  if (!isLoggedIn) {
    return (
      <StitchScrollScreen>
        <StitchHeader title="To‘lovlar" subtitle="Premium va hisob-kitob" back />
        <StitchCard>
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 18 }}>
            <Ionicons name="lock-closed-outline" size={30} color={colors.success} />
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: colors.text, textAlign: 'center' }}>
              Avval akkauntga kiring
            </Text>
          </View>
        </StitchCard>
        <StitchButton title="Kirish" icon="log-in-outline" onPress={() => router.push('/login')} />
        <StitchBottomSpace />
      </StitchScrollScreen>
    );
  }

  const premium = data?.premium;
  const payments = data?.payments || [];

  return (
    <StitchScrollScreen>
      <StitchHeader title="To‘lovlar" subtitle="Premium va hisob-kitob" back />

      <StitchCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
          <View
            style={{
              width: 52, height: 52, borderRadius: 18,
              backgroundColor: colors.successPale,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name={premium?.active ? 'star' : 'star-outline'} size={25} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 19, color: colors.text }}>
              {premium?.active ? 'Premium faol' : 'Premium faol emas'}
            </Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>
              {premium?.active
                ? `${formatDate(premium.until)} gacha · ilova va saytda birga ishlaydi`
                : "Obuna bo'lsangiz ilova va saytda birga ishlaydi"}
            </Text>
          </View>
        </View>
      </StitchCard>

      <StitchButton
        title={premium?.active ? 'Muddatni uzaytirish' : 'Premium olish'}
        icon="card-outline"
        onPress={() => router.push('/checkout')}
      />

      <StitchCard>
        <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: colors.text, marginBottom: SPACING.sm }}>
          To'lovlar tarixi
        </Text>
        {payments.length === 0 ? (
          <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted }}>
            Hozircha to'lovlar yo'q.
          </Text>
        ) : (
          payments.map((p) => (
            <View
              key={p.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.display, fontSize: 14, color: colors.text }}>
                  {p.planSlug === 'premium' || !p.planSlug ? 'Premium' : p.planSlug} · {p.periodMonths} oy
                </Text>
                <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted }}>
                  {formatDate(p.paidAt)} · {String(p.method || 'click').toUpperCase()}
                </Text>
              </View>
              <Text style={{ fontFamily: FONTS.display, fontSize: 14, color: colors.text }}>
                {formatUzs(p.amount)}
              </Text>
            </View>
          ))
        )}
      </StitchCard>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
        <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted }}>
          To'lovlar CLICK orqali amalga oshadi. Karta ma'lumotlari bizda saqlanmaydi.
        </Text>
      </View>
      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
