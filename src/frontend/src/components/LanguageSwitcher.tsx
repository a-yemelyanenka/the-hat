import { useTranslation } from 'react-i18next'
import { supportedLanguages, type AppLanguage } from '../i18n'

const languageLabels: Record<AppLanguage, string> = {
  en: 'language.en',
  pl: 'language.pl',
  ru: 'language.ru',
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const currentLanguage = (supportedLanguages.find((language) => i18n.resolvedLanguage?.startsWith(language)) ?? 'en') as AppLanguage

  return (
    <div className="language-switcher" role="group" aria-label={t('language.label')}>
      <span className="language-switcher-label">{t('language.label')}</span>
      <div className="language-switcher-actions">
        {supportedLanguages.map((language) => (
          <button
            key={language}
            className={`button button-secondary language-switcher-button ${currentLanguage === language ? 'language-switcher-button-active' : ''}`}
            type="button"
            onClick={() => void i18n.changeLanguage(language)}
            aria-pressed={currentLanguage === language}
          >
            {t(languageLabels[language])}
          </button>
        ))}
      </div>
    </div>
  )
}
