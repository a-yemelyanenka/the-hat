import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { en } from './locales/en'
import { pl } from './locales/pl'
import { ru } from './locales/ru'

export const languageStorageKey = 'the-hat:language'
export const supportedLanguages = ['en', 'pl', 'ru'] as const
export type AppLanguage = (typeof supportedLanguages)[number]
export const defaultLanguage: AppLanguage = 'en'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en,
      },
      pl: {
        translation: pl,
      },
      ru: {
        translation: ru,
      },
    },
    fallbackLng: defaultLanguage,
    supportedLngs: supportedLanguages,
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: languageStorageKey,
    },
  })

export default i18n
