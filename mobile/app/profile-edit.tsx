import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Button from '../src/components/Button';
import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';
import { ApiError, authAPI } from '../src/utils/api';
import { type AuthUser, extractApiData, getUserInitials } from '../src/utils/auth';
import { KEYS, getJSON, saveUserProfile } from '../src/utils/storage';

const MAX_AVATAR_DATA_URI_LENGTH = 750_000;

function buildDataUri(asset: ImagePicker.ImagePickerAsset): string | null {
  if (!asset.base64) {
    return null;
  }

  const mimeType = asset.mimeType || 'image/jpeg';
  return `data:${mimeType};base64,${asset.base64}`;
}

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getJSON<AuthUser>(KEYS.USER).then((value) => {
      if (!value) {
        router.replace('/login');
        return;
      }

      setUser(value);
      setName(value.name || '');
      setLastName(value.lastName || '');
      setBio(value.bio || '');
      setAvatarUrl(value.avatarUrl || null);
    });
  }, []);

  const pickImage = async (source: 'library' | 'camera') => {
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(t('profileEdit.permissionTitle'), source === 'camera' ? t('profileEdit.cameraPermMsg') : t('profileEdit.galleryPermMsg'));
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.5,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.5,
              base64: true,
            });

      if (result.canceled) {
        return;
      }

      const nextAvatarUrl = buildDataUri(result.assets[0]);
      if (!nextAvatarUrl) {
        Alert.alert(t('auth.errorTitle'), t('profileEdit.errorImageData'));
        return;
      }
      if (nextAvatarUrl.length > MAX_AVATAR_DATA_URI_LENGTH) {
        Alert.alert(
          t('auth.errorTitle'),
          t('profileEdit.errorImageTooLarge', {
            defaultValue: 'Rasm juda katta. Iltimos kichikroq rasm tanlang.',
          })
        );
        return;
      }

      setAvatarUrl(nextAvatarUrl);
    } catch {
      Alert.alert(t('auth.errorTitle'), t('profileEdit.errorImageSelect'));
    }
  };

  const openPicker = () => {
    Alert.alert(t('profileEdit.avatarTitle'), t('profileEdit.avatarMsg'), [
      { text: t('profileEdit.galleryOption'), onPress: () => pickImage('library') },
      { text: t('profileEdit.cameraOption'), onPress: () => pickImage('camera') },
      ...(avatarUrl ? [{ text: t('profileEdit.removeOption'), style: 'destructive' as const, onPress: () => setAvatarUrl(null) }] : []),
      { text: t('profileEdit.cancelOption'), style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (name.trim().length < 2) {
      return Alert.alert(t('auth.errorTitle'), t('profileEdit.errorNameShort'));
    }

    if (bio.trim().length > 160) {
      return Alert.alert(t('auth.errorTitle'), t('profileEdit.errorBioLong'));
    }

    setLoading(true);

    try {
      const data = extractApiData<{ message?: string; user: AuthUser }>(
        await authAPI.updateProfile({
          name: name.trim(),
          lastName: lastName.trim() || null,
          bio: bio.trim() || null,
          avatarUrl,
        })
      );

      await saveUserProfile(data.user);
      Alert.alert(t('common.ok'), data.message || t('profileEdit.successSave'));
      router.back();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('profileEdit.errorSave');
      Alert.alert(t('auth.errorTitle'), message);
    } finally {
      setLoading(false);
    }
  };

  const initials = getUserInitials({
    name: name || user?.name || t('profile.guestName'),
    lastName,
    fullName: [name, lastName].filter(Boolean).join(' ').trim(),
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
          <Text style={styles.backTxt}>{t('profileEdit.backBtn')}</Text>
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowGold} />

          <TouchableOpacity style={styles.avatarButton} onPress={openPicker} activeOpacity={0.9}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera-outline" size={16} color={colors.textInverse} />
            </View>
          </TouchableOpacity>

          <Text style={styles.title}>{t('profileEdit.title')}</Text>
          <Text style={styles.subtitle}>{t('profileEdit.subtitle')}</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>{t('profileEdit.nameLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('profileEdit.namePlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>{t('profileEdit.lastNameLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('profileEdit.lastNamePlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            value={lastName}
            onChangeText={setLastName}
          />

          <View style={styles.bioHeader}>
            <Text style={styles.label}>{t('profileEdit.bioLabel')}</Text>
            <Text style={styles.counter}>{bio.length}/160</Text>
          </View>
          <TextInput
            style={styles.bioInput}
            placeholder={t('profileEdit.bioPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={160}
            textAlignVertical="top"
            value={bio}
            onChangeText={setBio}
          />

          <View style={styles.avatarActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage('library')} activeOpacity={0.85}>
              <Ionicons name="images-outline" size={16} color={colors.primary} />
              <Text style={styles.secondaryBtnTxt}>{t('profileEdit.galleryBtn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage('camera')} activeOpacity={0.85}>
              <Ionicons name="camera-outline" size={16} color={colors.primary} />
              <Text style={styles.secondaryBtnTxt}>{t('profileEdit.cameraBtn')}</Text>
            </TouchableOpacity>
          </View>

          <Button title={t('profileEdit.saveBtn')} onPress={handleSave} loading={loading} style={styles.submitBtn} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
    backBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: SPACING.md,
    },
    backTxt: { fontFamily: FONTS.medium, fontSize: 13, color: colors.primary },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xxl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignItems: 'center',
      padding: SPACING.xl,
      marginBottom: SPACING.lg,
      overflow: 'hidden',
    },
    heroGlowPrimary: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      top: -70,
      left: -30,
      backgroundColor: colors.primaryPale,
    },
    heroGlowGold: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      bottom: -50,
      right: -20,
      backgroundColor: colors.goldPale,
    },
    avatarButton: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.24,
      shadowRadius: 18,
      elevation: 8,
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarText: { fontFamily: FONTS.semibold, fontSize: 34, color: colors.textInverse },
    cameraBadge: {
      position: 'absolute',
      right: 4,
      bottom: 6,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    title: { fontFamily: FONTS.display, fontSize: 30, color: colors.text, marginBottom: SPACING.sm },
    subtitle: {
      fontFamily: FONTS.regular,
      fontSize: 14,
      lineHeight: 22,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.lg,
    },
    label: { fontFamily: FONTS.medium, fontSize: 14, color: colors.text, marginBottom: 6, marginTop: SPACING.sm },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      fontFamily: FONTS.regular,
      fontSize: 15,
      color: colors.text,
    },
    bioHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.sm,
    },
    counter: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted },
    bioInput: {
      minHeight: 120,
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      fontFamily: FONTS.regular,
      fontSize: 15,
      color: colors.text,
    },
    avatarActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.lg,
    },
    secondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardMuted,
    },
    secondaryBtnTxt: { fontFamily: FONTS.medium, fontSize: 12, color: colors.primary },
    submitBtn: { marginTop: SPACING.xl },
  });
}
