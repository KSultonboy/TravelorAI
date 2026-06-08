import React from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '../../constants/fonts';
import { RADIUS, SPACING } from '../../constants/spacing';
import { type AppColors, useAppTheme } from '../../theme/app-theme';

export const STITCH_IMAGES = {
  hero: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=1400&auto=format&fit=crop',
  samarkand: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=1200&auto=format&fit=crop',
  bukhara: 'https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?q=80&w=1200&auto=format&fit=crop',
  mountains: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop',
  city: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200&auto=format&fit=crop',
};

export function useStitchMobileStyles() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return { colors, insets, styles: createStyles(colors) };
}

export function StitchScrollScreen({
  children,
  contentStyle,
}: {
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}) {
  const { insets, styles } = useStitchMobileStyles();
  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function StitchHeader({
  title = 'TravelorAI',
  subtitle,
  back = false,
  menu = false,
  right,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  menu?: boolean;
  right?: React.ReactNode;
}) {
  const { colors, styles } = useStitchMobileStyles();
  const icon = back ? 'chevron-back' : menu ? 'menu' : 'close';
  const fallbackPress = back ? () => router.back() : menu ? () => router.push('/side-menu' as any) : () => router.back();

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} onPress={fallbackPress} activeOpacity={0.82}>
        <Ionicons name={icon as any} size={19} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right || (
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(tabs)/profile' as any)} activeOpacity={0.82}>
          <Ionicons name="person-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function StitchHero({
  title,
  subtitle,
  image = STITCH_IMAGES.hero,
  children,
}: {
  title: string;
  subtitle?: string;
  image?: string;
  children?: React.ReactNode;
}) {
  const { styles } = useStitchMobileStyles();
  return (
    <ImageBackground source={{ uri: image }} style={styles.hero} imageStyle={styles.heroImage}>
      <View style={styles.heroScrim} />
      <Text style={styles.heroTitle}>{title}</Text>
      {subtitle ? <Text style={styles.heroSub}>{subtitle}</Text> : null}
      {children}
    </ImageBackground>
  );
}

export function StitchCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { styles } = useStitchMobileStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StitchSectionTitle({ title, action }: { title: string; action?: string }) {
  const { styles } = useStitchMobileStyles();
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

export function StitchInput({
  label,
  icon = 'search-outline',
  right,
  ...props
}: TextInputProps & {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
}) {
  const { colors, styles } = useStitchMobileStyles();
  return (
    <View style={styles.inputGroup}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={17} color={colors.textMuted} />
        <TextInput
          {...props}
          style={[styles.input, props.style]}
          placeholderTextColor={props.placeholderTextColor || colors.textMuted}
        />
        {right}
      </View>
    </View>
  );
}

export function StitchButton({
  title,
  icon,
  onPress,
  variant = 'primary',
  disabled,
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'dark' | 'danger';
  disabled?: boolean;
}) {
  const { colors, styles } = useStitchMobileStyles();
  const isPrimary = variant === 'primary';
  const iconColor = isPrimary || variant === 'dark' || variant === 'danger' ? colors.textInverse : colors.text;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'dark' && styles.buttonDark,
        variant === 'danger' && styles.buttonDanger,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      activeOpacity={0.84}
      disabled={disabled}
    >
      {icon ? <Ionicons name={icon} size={17} color={iconColor} /> : null}
      <Text
        style={[
          styles.buttonText,
          variant === 'ghost' && styles.buttonGhostText,
          variant === 'dark' && styles.buttonDarkText,
          variant === 'danger' && styles.buttonDarkText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export function StitchListRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colors, styles } = useStitchMobileStyles();
  const Wrapper = onPress ? TouchableOpacity : View;
  const iconColor = danger ? colors.error : colors.success;

  return (
    <Wrapper style={styles.listRow} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.listIcon, danger && { backgroundColor: colors.errorPale }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.listCopy}>
        <Text style={[styles.listTitle, danger && { color: colors.error }]}>{title}</Text>
        {subtitle ? <Text style={styles.listSub} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right || (onPress ? <Ionicons name="chevron-forward" size={17} color={colors.textMuted} /> : null)}
    </Wrapper>
  );
}

export function StitchStatGrid({ items }: { items: { label: string; value: string; icon?: keyof typeof Ionicons.glyphMap }[] }) {
  const { colors, styles } = useStitchMobileStyles();
  return (
    <View style={styles.statGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.statBox}>
          {item.icon ? <Ionicons name={item.icon} size={16} color={colors.success} /> : null}
          <Text style={styles.statValue}>{item.value}</Text>
          <Text style={styles.statLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function StitchBottomSpace({ extra = 98 }: { extra?: number }) {
  const { insets } = useStitchMobileStyles();
  return <View style={{ height: extra + Math.max(insets.bottom, 22) }} />;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.xl,
      gap: SPACING.md,
    },
    header: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 4,
    },
    headerCopy: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontFamily: FONTS.display,
      fontSize: 16,
      color: colors.text,
    },
    headerSub: {
      marginTop: 2,
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textMuted,
    },
    hero: {
      minHeight: 222,
      borderRadius: 30,
      overflow: 'hidden',
      padding: SPACING.xl,
      justifyContent: 'flex-end',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.18,
      shadowRadius: 26,
      elevation: 8,
    },
    heroImage: {
      borderRadius: 30,
    },
    heroScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(2,6,23,0.48)',
    },
    heroTitle: {
      fontFamily: FONTS.display,
      fontSize: 34,
      lineHeight: 39,
      color: colors.textInverse,
    },
    heroSub: {
      marginTop: SPACING.sm,
      fontFamily: FONTS.regular,
      fontSize: 15,
      lineHeight: 22,
      color: 'rgba(255,255,255,0.88)',
    },
    card: {
      borderRadius: 26,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.lg,
      gap: SPACING.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 4,
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.sm,
    },
    sectionTitle: {
      fontFamily: FONTS.display,
      fontSize: 22,
      color: colors.text,
    },
    sectionAction: {
      fontFamily: FONTS.semibold,
      fontSize: 12,
      color: colors.success,
    },
    inputGroup: {
      gap: 7,
    },
    inputLabel: {
      fontFamily: FONTS.semibold,
      fontSize: 12,
      color: colors.textSecondary,
    },
    inputShell: {
      minHeight: 56,
      borderRadius: RADIUS.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    input: {
      flex: 1,
      paddingVertical: 0,
      fontFamily: FONTS.regular,
      fontSize: 14,
      color: colors.text,
    },
    button: {
      minHeight: 54,
      borderRadius: RADIUS.full,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: SPACING.lg,
    },
    buttonGhost: {
      backgroundColor: colors.cardMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    buttonDark: {
      backgroundColor: '#050814',
    },
    buttonDanger: {
      backgroundColor: colors.error,
    },
    buttonDisabled: {
      opacity: 0.62,
    },
    buttonText: {
      fontFamily: FONTS.semibold,
      fontSize: 14,
      color: colors.textInverse,
    },
    buttonGhostText: {
      color: colors.text,
    },
    buttonDarkText: {
      color: colors.textInverse,
    },
    listRow: {
      minHeight: 68,
      borderRadius: 18,
      backgroundColor: colors.cardMuted,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    listIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.successPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listCopy: {
      flex: 1,
      gap: 3,
    },
    listTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 14,
      color: colors.text,
    },
    listSub: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
    },
    statGrid: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    statBox: {
      flex: 1,
      minHeight: 86,
      borderRadius: 18,
      backgroundColor: colors.cardMuted,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: SPACING.sm,
    },
    statValue: {
      fontFamily: FONTS.display,
      fontSize: 18,
      color: colors.text,
    },
    statLabel: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}
