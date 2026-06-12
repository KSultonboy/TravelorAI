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
import type { HomeTourItem } from '../../utils/homeContent';

function digitsOnly(value?: string | null) {
  return (value || '').replace(/[^0-9]/g, '');
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
  try {
    return JSON.parse(decodeURIComponent(raw)) as HomeTourItem;
  } catch {
    return null;
  }
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
  const priceIncludes = Array.isArray(tour.priceIncludes) ? tour.priceIncludes.filter(Boolean) : [];
  const priceExcludes = Array.isArray(tour.priceExcludes) ? tour.priceExcludes.filter(Boolean) : [];
  const mealCopy = tour.mealPlan ? `${tour.mealPlan} - ${tour.mealPlanLabel || MEAL_LABELS[tour.mealPlan] || 'Ovqatlanish turi'}` : '';
  const packageDetails = [
    tour.hotelName || tour.hotelCategory || tour.hotelLocation
      ? { label: 'Mehmonxona', value: [tour.hotelName, tour.hotelCategory, tour.hotelLocation].filter(Boolean).join(' · ') }
      : null,
    tour.roomType ? { label: 'Xona', value: tour.roomType } : null,
    mealCopy ? { label: 'Ovqatlanish', value: mealCopy } : null,
    tour.nights ? { label: 'Tun', value: `${tour.nights} tun` } : null,
    tour.departureCity ? { label: "Jo'nash", value: tour.departureCity } : null,
    tour.destinationCountry ? { label: 'Mamlakat', value: tour.destinationCountry } : null,
    tour.availabilityStatus ? { label: 'Mavjudlik', value: AVAILABILITY_LABELS[tour.availabilityStatus] || tour.availabilityStatus } : null,
    tour.flightSeatStatus ? { label: 'Avia', value: FLIGHT_LABELS[tour.flightSeatStatus] || tour.flightSeatStatus } : null,
    tour.priceBasis ? { label: 'Narx', value: tour.priceBasis } : null,
  ].filter(Boolean) as { label: string; value: string }[];
  const agencyTelegram = tour.agency?.telegram ? tour.agency.telegram.replace(/^@/, '').trim() : null;
  const agencyPhone = tour.agency?.phone ? tour.agency.phone.trim() : null;
  const agencyWebsite = tour.agency?.website ? tour.agency.website.trim() : null;

  return (
    <ScrollView style={[styles.screen, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.82}>
          <Ionicons name="close" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tour Details</Text>
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
          <Stat label="Duration" value={tour.duration || '-'} styles={styles} />
          <Stat label="Rating" value={tour.rating ? tour.rating.toFixed(1) : '-'} styles={styles} />
          <Stat label="From" value={tour.price || (tour.priceMin ? `$${tour.priceMin}` : 'So‘rovda')} styles={styles} />
        </View>
        <View style={styles.responseTimeBox}>
          <Ionicons name="timer-outline" size={18} color={colors.success} />
          <Text style={styles.responseTimeText}>Agentlik odatda {tour.responseTimeMinutes || 45} daqiqada javob beradi.</Text>
        </View>
        {packageDetails.length > 0 || tour.instantConfirmation || tour.stopSale || tour.promo ? (
          <>
            <Text style={styles.sectionTitle}>Paket tafsilotlari</Text>
            <View style={styles.packageGrid}>
              {packageDetails.map((item) => (
                <View key={`${item.label}-${item.value}`} style={styles.packageItem}>
                  <Text style={styles.tinyMuted}>{item.label}</Text>
                  <Text style={styles.packageValue}>{item.value}</Text>
                </View>
              ))}
            </View>
            <View style={styles.flagRow}>
              {tour.instantConfirmation ? <Text style={styles.flagChip}>Instant confirmation</Text> : null}
              {tour.promo ? <Text style={styles.flagChip}>Promo</Text> : null}
              {tour.stopSale ? <Text style={[styles.flagChip, styles.flagChipDanger]}>Stop-sale</Text> : null}
            </View>
          </>
        ) : null}
        {highlights.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Included</Text>
            {highlights.map((item) => (
              <View key={item} style={styles.checkRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.optionTitle}>{item}</Text>
              </View>
            ))}
          </>
        ) : null}
        {priceIncludes.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Narxga kiradi</Text>
            {priceIncludes.map((item) => (
              <View key={item} style={styles.checkRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.optionTitle}>{item}</Text>
              </View>
            ))}
          </>
        ) : null}
        {priceExcludes.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Narxga kirmaydi</Text>
            {priceExcludes.map((item) => (
              <View key={item} style={styles.checkRow}>
                <Ionicons name="remove-circle-outline" size={16} color={colors.error} />
                <Text style={styles.optionTitle}>{item}</Text>
              </View>
            ))}
          </>
        ) : null}
        {tour.childPolicy ? (
          <View style={styles.responseTimeBox}>
            <Ionicons name="people-outline" size={18} color={colors.success} />
            <Text style={styles.responseTimeText}>{tour.childPolicy}</Text>
          </View>
        ) : null}
      </View>

      {tour.agency ? (
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Agentlik bilan bog‘lanish</Text>
          <Text style={styles.muted}>
            {tour.agency.name}
            {tour.agency.city ? ` · ${tour.agency.city}` : ''}
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
            <Text style={styles.muted}>Bevosita aloqa hozircha yo‘q — quyida so‘rov qoldiring, agentlik siz bilan bog‘lanadi.</Text>
          )}
        </View>
      ) : null}

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>So‘rov qoldiring</Text>
        <Text style={styles.muted}>Bepul — agentlik so‘rovingizni ko‘rib chiqadi va siz bilan bog‘lanadi.</Text>
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
