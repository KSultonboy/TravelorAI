import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ImageBackground, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '../../constants/fonts';
import { SPACING } from '../../constants/spacing';
import { type AppColors, useAppTheme } from '../../theme/app-theme';
import { bookingsAPI } from '../../utils/api';
import { getJSON, KEYS } from '../../utils/storage';
import { getUserDisplayName, type AuthUser } from '../../utils/auth';
import { normalizeTours, type HomeTourItem } from '../../utils/homeContent';

function digitsOnly(value?: string | null) {
  return (value || '').replace(/[^0-9]/g, '');
}

function formatTourPrice(tour: HomeTourItem) {
  if (tour.price?.trim()) return tour.price.trim();
  if (tour.priceMin == null) return "So'rov bo'yicha";

  const amount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(tour.priceMin);
  return tour.priceCurrency === 'USD' || !tour.priceCurrency
    ? `$${amount}`
    : `${amount} ${tour.priceCurrency}`;
}

async function openLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Ochib bo‘lmadi', 'Ushbu havolani ochishda xatolik.');
  }
}

function parseTourParam(value: string | string[] | undefined): HomeTourItem | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const tryParse = (s: string): HomeTourItem | null => {
    try {
      return normalizeTours([JSON.parse(s)])[0] || null;
    } catch {
      return null;
    }
  };
  const tryDecode = (s: string): string | null => {
    try { return decodeURIComponent(s); } catch { return null; }
  };
  // expo-router may pass the param raw, decoded once, or decoded twice
  // depending on version — accept all of them.
  let result = tryParse(raw);
  if (result) return result;
  const once = tryDecode(raw);
  if (once) {
    result = tryParse(once);
    if (result) return result;
    const twice = tryDecode(once);
    if (twice) {
      result = tryParse(twice);
      if (result) return result;
    }
  }
  return null;
}

const MEAL_LABELS: Record<string, string> = {
  RO: "Room Only - ovqat yo'q",
  BB: 'Bed & Breakfast - nonushta',
  HB: 'Half Board - nonushta va kechki ovqat',
  FB: 'Full Board - 3 mahal ovqat',
  AI: 'All Inclusive',
  UAI: 'Ultra All Inclusive',
  UALL: 'Ultra All Inclusive',
  FBT: 'Full Board Treatment',
};

const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Joy bor',
  few_seats: 'Kam joy qoldi',
  on_request: "So'rov bo'yicha",
  sold_out: "Joy yo'q",
};

const FLIGHT_LABELS: Record<string, string> = {
  not_included: 'Avia kiritilmagan',
  available: 'Avia joy bor',
  few_seats: 'Avia joy kam',
  on_request: "Avia so'rov bo'yicha",
  no_seats: "Avia joy yo'q",
};

export function TourDetailsScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const params = useLocalSearchParams<{ tour?: string }>();
  const tour = useMemo(() => parseTourParam(params.tour), [params.tour]);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [travelers, setTravelers] = useState('1');
  const [travelDate, setTravelDate] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Prefill contact details from the logged-in user (low-friction lead)
  useEffect(() => {
    let mounted = true;
    getJSON<AuthUser>(KEYS.USER)
      .then((user) => {
        if (!mounted || !user) return;
        const name = getUserDisplayName(user);
        if (name) setCustomerName((prev) => prev || name);
        if (user.email) setCustomerEmail((prev) => prev || user.email);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  async function submitBooking() {
    if (!tour?.id) {
      Alert.alert('Tur tanlanmagan', 'So‘rov yuborish uchun katalogdan tur tanlang.');
      return;
    }
    if (!customerName.trim()) {
      Alert.alert('Ism kerak', 'Iltimos, ismingizni kiriting.');
      return;
    }
    if (!customerEmail.trim() && !customerPhone.trim()) {
      Alert.alert('Aloqa kerak', 'Telefon yoki email — kamida bittasini qoldiring.');
      return;
    }

    setBookingLoading(true);
    try {
      await bookingsAPI.create({
        tourId: tour.id,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        travelers: Math.max(1, Number.parseInt(travelers, 10) || 1),
        travelDate: travelDate.trim(),
        message: bookingMessage.trim(),
        source: 'mobile',
      });
      Alert.alert(
        'So‘rov yuborildi',
        'Agency booking so‘rovingizni ko‘rib chiqadi. Holat web va mobil akkauntingizda bir xil ko‘rinadi.',
        [
          { text: 'Yopish' },
          { text: 'Bookinglarim', onPress: () => router.push('/bookings' as never) },
        ]
      );
      setBookingMessage('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Booking yuborilmadi';
      Alert.alert('Xatolik', message);
    } finally {
      setBookingLoading(false);
    }
  }

  if (!tour) {
    return (
      <View style={[styles.emptyScreen, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.82}>
          <Ionicons name="close" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
        <Ionicons name="briefcase-outline" size={34} color={colors.success} />
        <Text style={styles.emptyTitle}>Tour tanlanmagan</Text>
        <Text style={styles.mutedCenter}>Batafsil sahifa faqat backenddan kelgan tour card orqali ochiladi.</Text>
        <TouchableOpacity style={styles.primaryWide} onPress={() => router.replace('/home-tours' as any)} activeOpacity={0.84}>
          <Text style={styles.primaryWideText}>Tour katalogga qaytish</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const highlights = Array.isArray(tour.highlights) ? tour.highlights.filter(Boolean) : [];
  const itinerary = Array.isArray(tour.itinerary) ? tour.itinerary.filter((item) => item?.title) : [];
  const priceIncludes = Array.isArray(tour.priceIncludes) ? tour.priceIncludes.filter(Boolean) : [];
  const priceExcludes = Array.isArray(tour.priceExcludes) ? tour.priceExcludes.filter(Boolean) : [];
  const detailFallback = 'Agentlik bilan aniqlashtiriladi';
  const descriptionCopy = tour.description?.trim() || tour.subtitle?.trim() || detailFallback;
  const mealCopy = tour.mealPlan ? `${tour.mealPlan} - ${tour.mealPlanLabel || MEAL_LABELS[tour.mealPlan] || 'Ovqatlanish turi'}` : '';
  const packageDetails = [
    {
      label: 'Mehmonxona',
      value: [tour.hotelName, tour.hotelCategory, tour.hotelLocation].filter(Boolean).join(' · ') || detailFallback,
    },
    { label: 'Xona', value: tour.roomType || detailFallback },
    { label: 'Ovqatlanish', value: mealCopy || detailFallback },
    { label: 'Tun', value: tour.nights ? `${tour.nights} tun` : detailFallback },
    { label: "Jo'nash", value: tour.departureCity || detailFallback },
    {
      label: "Yo'nalish",
      value: [tour.city, tour.destinationCountry].filter(Boolean).join(' · ') || detailFallback,
    },
    {
      label: 'Mavjudlik',
      value: tour.availabilityStatus
        ? AVAILABILITY_LABELS[tour.availabilityStatus] || tour.availabilityStatus
        : "So'rov bo'yicha",
    },
    {
      label: 'Avia',
      value: tour.flightSeatStatus
        ? FLIGHT_LABELS[tour.flightSeatStatus] || tour.flightSeatStatus
        : detailFallback,
    },
    { label: 'Narx turi', value: tour.priceBasis || detailFallback },
  ];
  const agencyTelegram = tour.agency?.telegram ? tour.agency.telegram.replace(/^@/, '').trim() : null;
  const agencyPhone = tour.agency?.phone ? tour.agency.phone.trim() : null;
  const agencyWebsite = tour.agency?.website ? tour.agency.website.trim() : null;

  return (
    <ScrollView style={[styles.screen, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.82}>
          <Ionicons name="close" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tur tafsilotlari</Text>
        <View style={styles.iconBtnGhost} />
      </View>

      {tour.imageUrl ? (
        <ImageBackground source={{ uri: tour.imageUrl }} style={styles.detailHero} imageStyle={styles.detailHeroImage}>
          <View style={styles.heroScrim} />
          <View style={styles.heroCopy}>
            <Text style={[styles.detailTitle, styles.detailTitleOnImage]}>{tour.title}</Text>
            <Text style={[styles.tourSub, styles.tourSubOnImage]}>{tour.subtitle || tour.description || ''}</Text>
          </View>
        </ImageBackground>
      ) : (
        <View style={styles.detailHero}>
          <Ionicons name="image-outline" size={28} color={colors.textMuted} />
          <View style={styles.heroCopy}>
            <Text style={styles.detailTitle}>{tour.title}</Text>
            <Text style={styles.tourSub}>{tour.subtitle || tour.description || ''}</Text>
          </View>
        </View>
      )}

      <View style={styles.formCard}>
        <View style={styles.detailStats}>
          <Stat label="Davomiylik" value={tour.duration || detailFallback} styles={styles} />
          <Stat label="Reyting" value={tour.rating ? tour.rating.toFixed(1) : 'Yangi'} styles={styles} />
          <Stat label="Narx" value={formatTourPrice(tour)} styles={styles} />
        </View>
        <View style={styles.responseTimeBox}>
          <Ionicons name="timer-outline" size={18} color={colors.success} />
          <Text style={styles.responseTimeText}>Agentlik odatda {tour.responseTimeMinutes || 45} daqiqada javob beradi.</Text>
        </View>
        <Text style={styles.sectionTitle}>Tur haqida</Text>
        <Text style={styles.muted}>{descriptionCopy}</Text>

        <Text style={styles.sectionTitle}>Paket tafsilotlari</Text>
        <View style={styles.packageGrid}>
          {packageDetails.map((item) => (
            <View key={item.label} style={styles.packageItem}>
              <Text style={styles.tinyMuted}>{item.label}</Text>
              <Text style={styles.packageValue}>{item.value}</Text>
            </View>
          ))}
        </View>
        <View style={styles.flagRow}>
          <Text style={styles.flagChip}>
            {tour.instantConfirmation ? 'Tezkor tasdiqlash' : "Tasdiqlash so'rov bo'yicha"}
          </Text>
          {tour.promo ? <Text style={styles.flagChip}>Promo</Text> : null}
          {tour.stopSale ? <Text style={[styles.flagChip, styles.flagChipDanger]}>{"Sotuv to'xtatilgan"}</Text> : null}
        </View>
        <Text style={styles.sectionTitle}>Asosiy afzalliklar</Text>
        {highlights.length > 0 ? highlights.map((item) => (
          <View key={item} style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.optionTitle}>{item}</Text>
          </View>
        )) : <InfoFallback text={detailFallback} styles={styles} colors={colors} />}

        <Text style={styles.sectionTitle}>Sayohat dasturi</Text>
        {itinerary.length > 0 ? itinerary.map((item, index) => (
          <View key={`${item.day}-${item.title}-${index}`} style={styles.itineraryRow}>
            <View style={styles.dayBadge}>
              <Text style={styles.dayBadgeText}>{item.day}</Text>
            </View>
            <View style={styles.itineraryBody}>
              <Text style={styles.optionTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
            </View>
          </View>
        )) : <InfoFallback text={detailFallback} styles={styles} colors={colors} />}

        <Text style={styles.sectionTitle}>Narxga kiradi</Text>
        {priceIncludes.length > 0 ? priceIncludes.map((item) => (
          <View key={item} style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.optionTitle}>{item}</Text>
          </View>
        )) : <InfoFallback text={detailFallback} styles={styles} colors={colors} />}

        <Text style={styles.sectionTitle}>Narxga kirmaydi</Text>
        {priceExcludes.length > 0 ? priceExcludes.map((item) => (
          <View key={item} style={styles.checkRow}>
            <Ionicons name="remove-circle-outline" size={16} color={colors.error} />
            <Text style={styles.optionTitle}>{item}</Text>
          </View>
        )) : <InfoFallback text={detailFallback} styles={styles} colors={colors} />}

        <Text style={styles.sectionTitle}>Bolalar shartlari</Text>
        <View style={styles.responseTimeBox}>
          <Ionicons name="people-outline" size={18} color={colors.success} />
          <Text style={styles.responseTimeText}>{tour.childPolicy || detailFallback}</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Agentlik bilan bog‘lanish</Text>
        <Text style={styles.muted}>
          {tour.agency?.name || 'Tasdiqlangan agentlik'}
          {tour.agency?.city ? ` · ${tour.agency.city}` : ''}
        </Text>
        {agencyTelegram || agencyPhone || agencyWebsite ? (
          <View style={styles.contactRow}>
            {agencyTelegram ? (
              <ContactBtn icon="paper-plane" label="Telegram" color="#229ED9" onPress={() => openLink(`https://t.me/${agencyTelegram}`)} styles={styles} />
            ) : null}
            {agencyPhone ? (
              <ContactBtn icon="logo-whatsapp" label="WhatsApp" color="#25D366" onPress={() => openLink(`https://wa.me/${digitsOnly(agencyPhone)}`)} styles={styles} />
            ) : null}
            {agencyPhone ? (
              <ContactBtn icon="call" label="Qo‘ng‘iroq" color={colors.primary} onPress={() => openLink(`tel:${agencyPhone}`)} styles={styles} />
            ) : null}
            {agencyWebsite ? (
              <ContactBtn icon="globe-outline" label="Sayt" color={colors.textSecondary} onPress={() => openLink(agencyWebsite.startsWith('http') ? agencyWebsite : `https://${agencyWebsite}`)} styles={styles} />
            ) : null}
          </View>
        ) : (
          <InfoFallback
            text="Quyida so‘rov qoldiring, agentlik siz bilan bog‘lanadi."
            styles={styles}
            colors={colors}
          />
        )}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>So‘rov qoldiring</Text>
        <Text style={styles.muted}>
          Bepul va ro‘yxatdan o‘tish shart emas — ism va telefon kifoya, agentlik o‘zi bog‘lanadi. Akkaunt bilan
          kirsangiz, so‘rov holatini «Bookinglarim»da kuzatib borasiz.
        </Text>
        <Input label="Ism" icon="person-outline" value={customerName} onChangeText={setCustomerName} placeholder="Ismingiz" styles={styles} colors={colors} />
        <Input label="Email (ixtiyoriy)" icon="mail-outline" value={customerEmail} onChangeText={setCustomerEmail} placeholder="email@example.com" styles={styles} colors={colors} keyboardType="email-address" />
        <View style={styles.dateRow}>
          <Input label="Telefon" icon="call-outline" value={customerPhone} onChangeText={setCustomerPhone} placeholder="+998..." styles={styles} colors={colors} keyboardType="phone-pad" />
          <Input label="Kishi soni" icon="people-outline" value={travelers} onChangeText={setTravelers} placeholder="1" styles={styles} colors={colors} keyboardType="number-pad" />
        </View>
        <Input label="Sayohat sanasi" icon="calendar-outline" value={travelDate} onChangeText={setTravelDate} placeholder="YYYY-MM-DD" styles={styles} colors={colors} />
        <TextInput
          value={bookingMessage}
          onChangeText={setBookingMessage}
          style={styles.notesInput}
          placeholder="Qo‘shimcha talablar yoki savollar..."
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <TouchableOpacity disabled={bookingLoading} style={[styles.primaryWide, bookingLoading && { opacity: 0.65 }]} onPress={submitBooking}>
          <Ionicons name="send-outline" size={15} color={colors.textInverse} />
          <Text style={styles.primaryWideText}>{bookingLoading ? 'Yuborilmoqda...' : 'So‘rov yuborish'}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 140 + Math.max(insets.bottom, 22) }} />
    </ScrollView>
  );
}

function Input({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  styles,
  colors,
  keyboardType,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={15} color={colors.textMuted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : undefined}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.textInput}
        />
      </View>
    </View>
  );
}

function Stat({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.tinyMuted}>{label}</Text>
    </View>
  );
}

function InfoFallback({
  text,
  styles,
  colors,
}: {
  text: string;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  return (
    <View style={styles.infoFallback}>
      <Ionicons name="information-circle-outline" size={17} color={colors.textMuted} />
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

function ContactBtn({
  icon,
  label,
  color,
  onPress,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity style={styles.contactBtn} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.contactIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={19} color="#FFFFFF" />
      </View>
      <Text style={styles.contactLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    emptyScreen: {
      flex: 1,
      backgroundColor: colors.background,
      padding: SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.md,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
    iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    iconBtnGhost: { width: 34, height: 34 },
    headerTitle: { fontFamily: FONTS.display, fontSize: 13, color: colors.text },
    detailHero: {
      minHeight: 260,
      marginHorizontal: SPACING.lg,
      borderRadius: 26,
      backgroundColor: colors.cardMuted,
      padding: SPACING.lg,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    detailHeroImage: { borderRadius: 26 },
    heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,18,0.4)' },
    heroCopy: { gap: SPACING.xs },
    detailTitle: { fontFamily: FONTS.display, fontSize: 32, lineHeight: 36, color: colors.text },
    detailTitleOnImage: { color: colors.textInverse },
    tourSub: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },
    tourSubOnImage: { color: 'rgba(255,255,255,0.86)' },
    formCard: { marginHorizontal: SPACING.lg, marginTop: SPACING.lg, borderRadius: 24, backgroundColor: colors.surface, padding: SPACING.lg, gap: SPACING.md },
    responseTimeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: 16,
      backgroundColor: colors.successPale,
    },
    responseTimeText: { flex: 1, fontFamily: FONTS.semibold, fontSize: 12, color: colors.success },
    detailStats: { flexDirection: 'row', gap: SPACING.sm },
    statBox: { flex: 1, borderRadius: 18, backgroundColor: colors.cardMuted, padding: SPACING.md },
    statValue: { fontFamily: FONTS.display, fontSize: 17, color: colors.text },
    tinyMuted: { fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted },
    packageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    packageItem: { width: '48%', borderRadius: 16, backgroundColor: colors.cardMuted, padding: SPACING.md, gap: 4 },
    packageValue: { fontFamily: FONTS.semibold, fontSize: 12, lineHeight: 17, color: colors.text },
    flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    flagChip: { borderRadius: 999, backgroundColor: colors.successPale, paddingHorizontal: SPACING.sm, paddingVertical: 6, fontFamily: FONTS.semibold, fontSize: 11, color: colors.success },
    flagChipDanger: { backgroundColor: colors.errorPale, color: colors.error },
    contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.xs },
    contactBtn: { alignItems: 'center', width: 66, gap: 6 },
    contactIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
    contactLabel: { fontFamily: FONTS.medium, fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
    sectionTitle: { fontFamily: FONTS.display, fontSize: 18, color: colors.text },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    infoFallback: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      borderRadius: 16,
      backgroundColor: colors.cardMuted,
      padding: SPACING.md,
    },
    itineraryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      borderRadius: 16,
      backgroundColor: colors.cardMuted,
      padding: SPACING.md,
    },
    dayBadge: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    dayBadgeText: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.textInverse },
    itineraryBody: { flex: 1, gap: 3 },
    optionTitle: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13, color: colors.text },
    muted: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    mutedCenter: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
    emptyTitle: { fontFamily: FONTS.display, fontSize: 24, color: colors.text, textAlign: 'center' },
    dateRow: { flexDirection: 'row', gap: SPACING.sm },
    inputGroup: { flex: 1, gap: 6 },
    formLabel: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.textSecondary },
    inputShell: {
      minHeight: 52,
      borderRadius: 18,
      backgroundColor: colors.cardMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
    },
    textInput: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, color: colors.text },
    notesInput: { minHeight: 92, borderRadius: 18, backgroundColor: colors.cardMuted, borderWidth: 1, borderColor: colors.borderLight, padding: SPACING.md, fontFamily: FONTS.regular, fontSize: 13, color: colors.text, textAlignVertical: 'top' },
    primaryWide: { minHeight: 54, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg },
    primaryWideText: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.textInverse },
  });
}
