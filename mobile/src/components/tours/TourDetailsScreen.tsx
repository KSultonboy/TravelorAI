import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../auth/AuthContext';
import { FONTS } from '../../constants/fonts';
import { SPACING } from '../../constants/spacing';
import { type AppColors, useAppTheme } from '../../theme/app-theme';
import { bookingsAPI } from '../../utils/api';
import { getRouteParam, getUserDisplayName } from '../../utils/auth';
import {
  formatDateInput,
  formatUzPhoneInput,
  isValidEmail,
  MAX_TRAVELERS,
  MIN_TRAVELERS,
  normalizeUzPhone,
  parseTravelDate,
  parseTravelers,
} from '../../utils/bookingValidation';
import { type HomeTourItem } from '../../utils/homeContent';
import { fetchTour, getCachedTour } from '../../utils/tourCache';
import TourWishlistButton from '../TourWishlistButton';

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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; slug?: string }>();
  const tourId = getRouteParam(params.id).trim();
  const tourSlug = getRouteParam(params.slug).trim();

  // Fast path: card → details reuses the list item from the in-memory cache.
  const [tour, setTour] = useState<HomeTourItem | null>(() => getCachedTour(tourId) || getCachedTour(tourSlug));
  const [tourLoading, setTourLoading] = useState(!tour && Boolean(tourId || tourSlug));
  const [tourError, setTourError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [travelers, setTravelers] = useState('1');
  const [travelDate, setTravelDate] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  const loadTour = useCallback(async () => {
    if (!tourId && !tourSlug) return;
    setTourLoading(true);
    setTourError(null);
    try {
      const found = await fetchTour(tourId, tourSlug);
      setTour(found);
      if (!found) setTourError(t('tourDetails.notFound'));
    } catch (err) {
      setTourError(err instanceof Error ? err.message : t('tourDetails.loadError'));
    } finally {
      setTourLoading(false);
    }
  }, [t, tourId, tourSlug]);

  useEffect(() => {
    const cached = getCachedTour(tourId) || getCachedTour(tourSlug);
    if (cached) {
      setTour(cached);
      setTourLoading(false);
      return;
    }
    void loadTour();
  }, [loadTour, tourId, tourSlug]);

  // Prefill contact details from the logged-in user (low-friction lead)
  useEffect(() => {
    if (!user) return;
    const name = getUserDisplayName(user);
    if (name) setCustomerName((prev) => prev || name);
    if (user.email) setCustomerEmail((prev) => prev || user.email);
  }, [user]);

  async function submitBooking() {
    if (!tour?.id) {
      Alert.alert(t('booking.noTourTitle'), t('booking.noTourMsg'));
      return;
    }
    if (!customerName.trim()) {
      Alert.alert(t('booking.nameRequiredTitle'), t('booking.nameRequiredMsg'));
      return;
    }

    const email = customerEmail.trim();
    const phoneRaw = customerPhone.trim();
    if (!email && !phoneRaw) {
      Alert.alert(t('booking.contactRequiredTitle'), t('booking.contactRequiredMsg'));
      return;
    }
    const phone = phoneRaw ? normalizeUzPhone(phoneRaw) : null;
    if (phoneRaw && !phone) {
      Alert.alert(t('booking.invalidTitle'), t('booking.phoneInvalid'));
      return;
    }
    if (email && !isValidEmail(email)) {
      Alert.alert(t('booking.invalidTitle'), t('booking.emailInvalid'));
      return;
    }

    const travelerCount = parseTravelers(travelers);
    if (travelerCount == null) {
      Alert.alert(t('booking.invalidTitle'), t('booking.travelersInvalid', { min: MIN_TRAVELERS, max: MAX_TRAVELERS }));
      return;
    }

    let isoDate: string | undefined;
    if (travelDate.trim()) {
      const parsed = parseTravelDate(travelDate);
      if (!parsed.ok) {
        const key =
          parsed.reason === 'past'
            ? 'booking.datePast'
            : parsed.reason === 'tooFar'
              ? 'booking.dateTooFar'
              : 'booking.dateInvalid';
        Alert.alert(t('booking.invalidTitle'), t(key));
        return;
      }
      isoDate = parsed.iso;
    }

    setBookingLoading(true);
    try {
      await bookingsAPI.create({
        tourId: tour.id,
        customerName: customerName.trim(),
        customerEmail: email,
        customerPhone: phone || '',
        travelers: travelerCount,
        ...(isoDate ? { travelDate: isoDate } : {}),
        message: bookingMessage.trim(),
        source: 'mobile',
      });
      Alert.alert(t('booking.sentTitle'), t('booking.sentMsg'), [
        { text: t('booking.close') },
        { text: t('bookings.title'), onPress: () => router.push('/bookings' as never) },
      ]);
      setBookingMessage('');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('booking.sendError');
      Alert.alert(t('booking.errorTitle'), message);
    } finally {
      setBookingLoading(false);
    }
  }

  if (!tour) {
    return (
      <View style={[styles.emptyScreen, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.close')}
        >
          <Ionicons name="close" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
        {tourLoading ? (
          <>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.mutedCenter}>{t('tourDetails.loading')}</Text>
          </>
        ) : (
          <>
            <Ionicons name="briefcase-outline" size={34} color={colors.success} />
            <Text style={styles.emptyTitle}>{t('tourDetails.notFoundTitle')}</Text>
            <Text style={styles.mutedCenter}>{tourError || t('tourDetails.notFound')}</Text>
            {tourId || tourSlug ? (
              <TouchableOpacity style={styles.primaryWide} onPress={() => void loadTour()} activeOpacity={0.84}>
                <Text style={styles.primaryWideText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.primaryWide} onPress={() => router.replace('/home-tours' as any)} activeOpacity={0.84}>
              <Text style={styles.primaryWideText}>{t('tourDetails.backToCatalog')}</Text>
            </TouchableOpacity>
          </>
        )}
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
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.close')}
        >
          <Ionicons name="close" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('tourDetails.title')}</Text>
        <TourWishlistButton tour={tour} variant="plain" color={colors.textSecondary} style={styles.iconBtn} />
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
        <Text style={styles.sectionTitle}>{t('booking.formTitle')}</Text>
        <Text style={styles.muted}>{t('booking.formHint')}</Text>
        <Input label={t('booking.nameLabel')} icon="person-outline" value={customerName} onChangeText={setCustomerName} placeholder={t('booking.namePlaceholder')} styles={styles} colors={colors} />
        <Input label={t('booking.emailLabel')} icon="mail-outline" value={customerEmail} onChangeText={setCustomerEmail} placeholder="email@example.com" styles={styles} colors={colors} keyboardType="email-address" />
        <View style={styles.dateRow}>
          <Input
            label={t('booking.phoneLabel')}
            icon="call-outline"
            value={customerPhone}
            onChangeText={(value) => setCustomerPhone(formatUzPhoneInput(value))}
            placeholder="+998 90 123 45 67"
            styles={styles}
            colors={colors}
            keyboardType="phone-pad"
            maxLength={17}
          />
        </View>
        <View style={styles.dateRow}>
          <Input
            label={t('booking.travelersLabel', { max: MAX_TRAVELERS })}
            icon="people-outline"
            value={travelers}
            onChangeText={(value) => setTravelers(value.replace(/\D/g, '').slice(0, 2))}
            placeholder="1"
            styles={styles}
            colors={colors}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Input
            label={t('booking.dateLabel')}
            icon="calendar-outline"
            value={travelDate}
            onChangeText={(value) => setTravelDate(formatDateInput(value))}
            placeholder={t('booking.datePlaceholder')}
            styles={styles}
            colors={colors}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
        <TextInput
          value={bookingMessage}
          onChangeText={setBookingMessage}
          style={styles.notesInput}
          placeholder={t('booking.messagePlaceholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          disabled={bookingLoading}
          style={[styles.primaryWide, bookingLoading && { opacity: 0.65 }]}
          onPress={submitBooking}
          accessibilityRole="button"
        >
          <Ionicons name="send-outline" size={15} color={colors.textInverse} />
          <Text style={styles.primaryWideText}>{bookingLoading ? t('booking.sending') : t('booking.submit')}</Text>
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
  maxLength,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  maxLength?: number;
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
          maxLength={maxLength}
          accessibilityLabel={label}
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
