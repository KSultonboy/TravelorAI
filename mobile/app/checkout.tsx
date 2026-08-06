import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Text, TouchableOpacity, View } from 'react-native';
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
import {
  ApiError,
  paymentsAPI,
  type PremiumCheckoutResponse,
  type PremiumInfoPayload,
  type PremiumPlanPayload,
  type PremiumPlansResponse,
  type PremiumStatusResponse,
} from '../src/utils/api';
import { extractApiData } from '../src/utils/auth';
import { getItem, KEYS } from '../src/utils/storage';

const MONTH_OPTIONS = [1, 3, 6, 12];
const POLL_INTERVAL_MS = 4000;

function formatUzs(amount: number): string {
  return `${Math.round(amount).toLocaleString('uz-UZ')} so'm`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function CheckoutScreen() {
  const { colors } = useStitchMobileStyles();

  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [clickEnabled, setClickEnabled] = useState(false);
  const [plan, setPlan] = useState<PremiumPlanPayload | null>(null);
  const [premium, setPremium] = useState<PremiumInfoPayload | null>(null);
  const [months, setMonths] = useState(1);
  const [isPaying, setIsPaying] = useState(false);
  const [pendingTx, setPendingTx] = useState<string | null>(null);
  const [paidUntil, setPaidUntil] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingTxRef = useRef<string | null>(null);
  pendingTxRef.current = pendingTx;

  const loadPlans = useCallback(async () => {
    try {
      const token = await getItem(KEYS.TOKEN);
      setIsLoggedIn(Boolean(token));
      const data = extractApiData<PremiumPlansResponse>(await paymentsAPI.getPlans());
      setClickEnabled(Boolean(data?.clickEnabled));
      setPlan(data?.plans?.[0] || null);
      setPremium(data?.premium || null);
    } catch {
      setErrorMsg("Planlarni yuklab bo'lmadi. Internetni tekshiring.");
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const checkStatus = useCallback(async () => {
    const tx = pendingTxRef.current;
    if (!tx) return;
    try {
      const data = extractApiData<PremiumStatusResponse>(await paymentsAPI.getStatus(tx));
      if (data.state === 'paid') {
        stopPolling();
        setPendingTx(null);
        setPremium(data.premium || null);
        setPaidUntil(data.premium?.until || null);
      } else if (data.state === 'cancelled') {
        stopPolling();
        setPendingTx(null);
        setErrorMsg("To'lov bekor qilindi. Qayta urinib ko'ring.");
      }
    } catch {
      // tarmoq xatosi — keyingi poll'da yana urinamiz
    }
  }, [stopPolling]);

  // To'lov holatini kuzatish: interval + ilova fokusga qaytganda darhol tekshirish.
  // Redirect hech qachon to'lov isboti emas — yagona manba backend statusi.
  useEffect(() => {
    if (!pendingTx) return undefined;
    pollTimer.current = setInterval(checkStatus, POLL_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkStatus();
    });
    return () => {
      stopPolling();
      sub.remove();
    };
  }, [pendingTx, checkStatus, stopPolling]);

  const startPayment = useCallback(async () => {
    if (!plan) return;
    setErrorMsg(null);
    setIsPaying(true);
    try {
      const data = extractApiData<PremiumCheckoutResponse>(
        await paymentsAPI.checkout({ planSlug: plan.slug, months, platform: 'app' })
      );
      setPendingTx(data.merchantTransId);
      const opened = await Linking.canOpenURL(data.payUrl);
      if (opened) {
        await Linking.openURL(data.payUrl);
      } else {
        Alert.alert('Xatolik', "To'lov sahifasini ochib bo'lmadi.");
        setPendingTx(null);
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) {
        setErrorMsg("Avval akkauntga kiring.");
      } else {
        setErrorMsg(err.message || "To'lovni boshlab bo'lmadi.");
      }
      setPendingTx(null);
    } finally {
      setIsPaying(false);
    }
  }, [plan, months]);

  if (!isReady) {
    return (
      <StitchScrollScreen>
        <StitchHeader title="Premium" subtitle="Yuklanmoqda..." back />
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <ActivityIndicator color={colors.success} />
        </View>
      </StitchScrollScreen>
    );
  }

  if (!isLoggedIn) {
    return (
      <StitchScrollScreen>
        <StitchHeader title="Premium" subtitle="Obuna uchun akkaunt kerak" back />
        <StitchCard>
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 18 }}>
            <Ionicons name="lock-closed-outline" size={30} color={colors.success} />
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: colors.text, textAlign: 'center' }}>
              Avval akkauntga kiring
            </Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
              Premium obuna akkauntingizga bog'lanadi — ilovada ham, travelorai.com saytida ham bir xil ishlaydi.
            </Text>
          </View>
        </StitchCard>
        <StitchButton title="Kirish" icon="log-in-outline" onPress={() => router.push('/login')} />
        <StitchButton title="Orqaga" variant="ghost" onPress={() => router.back()} />
        <StitchBottomSpace />
      </StitchScrollScreen>
    );
  }

  // To'lov muvaffaqiyatli yakunlangan holat
  if (paidUntil) {
    return (
      <StitchScrollScreen>
        <StitchHeader title="Premium" subtitle="To'lov qabul qilindi" back />
        <StitchCard>
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 22 }}>
            <View
              style={{
                width: 64, height: 64, borderRadius: 24,
                backgroundColor: colors.successPale,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="checkmark-circle" size={36} color={colors.success} />
            </View>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: colors.text, textAlign: 'center' }}>
              Premium faollashdi!
            </Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
              Obunangiz {formatDate(paidUntil)} gacha amal qiladi.{'\n'}
              Saytga shu akkaunt bilan kirsangiz ham Premium ko'rinadi.
            </Text>
          </View>
        </StitchCard>
        <StitchButton title="Tayyor" icon="checkmark-outline" onPress={() => router.back()} />
        <StitchBottomSpace />
      </StitchScrollScreen>
    );
  }

  // To'lov kutilmoqda (CLICK sahifasi ochilgan)
  if (pendingTx) {
    return (
      <StitchScrollScreen>
        <StitchHeader title="Premium" subtitle="To'lov kutilmoqda" back />
        <StitchCard>
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 22 }}>
            <ActivityIndicator color={colors.success} />
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: colors.text, textAlign: 'center' }}>
              CLICK sahifasida to'lovni yakunlang
            </Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
              To'lov tasdiqlangach bu yerda avtomatik ko'rinadi.{'\n'}Buyurtma: {pendingTx}
            </Text>
          </View>
        </StitchCard>
        <StitchButton title="Holatni tekshirish" icon="refresh-outline" onPress={checkStatus} />
        <StitchButton
          title="Bekor qilish"
          variant="ghost"
          onPress={() => {
            stopPolling();
            setPendingTx(null);
          }}
        />
        <StitchBottomSpace />
      </StitchScrollScreen>
    );
  }

  const totalAmount = plan ? plan.priceMonthlyUzs * months : 0;
  const alreadyActive = Boolean(premium?.active);

  return (
    <StitchScrollScreen>
      <StitchHeader title="Premium" subtitle="CLICK orqali xavfsiz to'lov" back />

      {alreadyActive ? (
        <StitchCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
            <Ionicons name="star" size={22} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: colors.text }}>
                Premium faol
              </Text>
              <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>
                {formatDate(premium?.until)} gacha · to'lov qilsangiz muddat ustiga qo'shiladi
              </Text>
            </View>
          </View>
        </StitchCard>
      ) : null}

      {plan ? (
        <StitchCard>
          <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: colors.text }}>{plan.name}</Text>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
            {formatUzs(plan.priceMonthlyUzs)} / oy
          </Text>
          <View style={{ marginTop: SPACING.md, gap: 8 }}>
            {plan.features.map((f) => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkmark-circle-outline" size={17} color={colors.success} />
                <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.text, flex: 1 }}>{f}</Text>
              </View>
            ))}
          </View>
        </StitchCard>
      ) : (
        <StitchCard>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted }}>
            Hozircha sotuvda plan yo'q.
          </Text>
        </StitchCard>
      )}

      {plan ? (
        <StitchCard>
          <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: colors.text, marginBottom: SPACING.sm }}>
            Muddat
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {MONTH_OPTIONS.map((m) => {
              const selected = months === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMonths(m)}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 14,
                    alignItems: 'center',
                    backgroundColor: selected ? colors.successPale : 'transparent',
                    borderWidth: 1,
                    borderColor: selected ? colors.success : colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 15,
                      color: selected ? colors.success : colors.text,
                    }}
                  >
                    {m} oy
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View
            style={{
              marginTop: SPACING.md,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted }}>Jami</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: colors.text }}>{formatUzs(totalAmount)}</Text>
          </View>
        </StitchCard>
      ) : null}

      {errorMsg ? (
        <StitchCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.text, flex: 1 }}>{errorMsg}</Text>
          </View>
        </StitchCard>
      ) : null}

      {!clickEnabled && plan ? (
        <StitchCard>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, lineHeight: 20 }}>
            Onlayn to'lov hozircha sozlanmagan. Tez orada CLICK orqali to'lov ochiladi.
          </Text>
        </StitchCard>
      ) : null}

      <StitchButton
        title={isPaying ? 'Tayyorlanmoqda...' : "CLICK orqali to'lash"}
        icon="card-outline"
        onPress={startPayment}
        disabled={!plan || !clickEnabled || isPaying}
      />
      <StitchButton title="Orqaga" variant="ghost" onPress={() => router.back()} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
        <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted }}>
          To'lov CLICK'ning rasmiy sahifasida amalga oshadi. Karta ma'lumotlari bizga yetib bormaydi.
        </Text>
      </View>
      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
