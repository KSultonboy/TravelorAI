import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import uz from './uz';
import ru from './ru';
import en from './en';

export type Language = 'uz' | 'ru' | 'en';

const i18n = createInstance();

export const LANGUAGE_OPTIONS: { key: Language; label: string; flag: string }[] = [
  { key: 'uz', label: "O'zbek", flag: '🇺🇿' },
  { key: 'ru', label: 'Русский', flag: '🇷🇺' },
  { key: 'en', label: 'English', flag: '🇬🇧' },
];

// Detect device locale, fallback to 'uz'
function detectLanguage(): Language {
  const locale = Localization.getLocales()[0]?.languageCode ?? 'uz';
  if (locale === 'ru') return 'ru';
  if (locale === 'en') return 'en';
  return 'uz';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      uz: { translation: uz },
      ru: { translation: ru },
      en: { translation: en },
    },
    lng: detectLanguage(),
    fallbackLng: 'uz',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;
