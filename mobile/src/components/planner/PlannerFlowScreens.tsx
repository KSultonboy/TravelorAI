import React, { useMemo, useState } from 'react';
import { Alert, ImageBackground, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '../../constants/fonts';
import { SPACING } from '../../constants/spacing';
import { type AppColors, useAppTheme } from '../../theme/app-theme';
import { bookingsAPI } from '../../utils/api';
import type { HomeTourItem } from '../../utils/homeContent';

function parseTourParam(value: string | string[] | undefined): HomeTourItem | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as HomeTourItem;
  } catch {
    return null;
  }
}

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

  async function submitBooking() {
    if (!tour?.id) {
      Alert.alert('Tour tanlanmagan', 'Booking yuborish uchun public tour katalogidan tour tanlang.');
      return;
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      Alert.alert('Ma’lumot yetarli emas', 'Ism va email kiritilishi kerak.');
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
      Alert.alert('So‘rov yuborildi', 'Agency booking so‘rovingizni ko‘rib chiqadi va siz bilan bog‘lanadi.');
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
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Booking so‘rovi</Text>
        <Text style={styles.muted}>Agency siz bilan bog‘lanishi uchun kontakt ma’lumotlaringizni qoldiring.</Text>
        <Input label="Ism" icon="person-outline" value={customerName} onChangeText={setCustomerName} placeholder="Ismingiz" styles={styles} colors={colors} />
        <Input label="Email" icon="mail-outline" value={customerEmail} onChangeText={setCustomerEmail} placeholder="email@example.com" styles={styles} colors={colors} keyboardType="email-address" />
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
          <Text style={styles.primaryWideText}>{bookingLoading ? 'Yuborilmoqda...' : 'Booking so‘rov yuborish'}</Text>
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
    detailStats: { flexDirection: 'row', gap: SPACING.sm },
    statBox: { flex: 1, borderRadius: 18, backgroundColor: colors.cardMuted, padding: SPACING.md },
    statValue: { fontFamily: FONTS.display, fontSize: 17, color: colors.text },
    tinyMuted: { fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted },
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
