import { useTranslation } from 'react-i18next'
import './HomePage.css'

type HomePageProps = {
  onCreateRoom: () => void
}

export function HomePage({ onCreateRoom }: HomePageProps) {
  const { t } = useTranslation()

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">{t('home.eyebrow')}</p>
          <h1>{t('home.title')}</h1>
          <p className="lead">{t('home.lead')}</p>
          <div className="hero-actions">
            <button className="button button-primary" type="button" onClick={onCreateRoom}>
              {t('common.createRoom')}
            </button>
          </div>
        </div>

        <aside className="panel summary-card" aria-label={t('home.summaryAriaLabel')}>
          <h2>{t('home.includedTitle')}</h2>
          <ul className="feature-list">
            <li>{t('home.featureHostName')}</li>
            <li>{t('home.featureSettings')}</li>
            <li>{t('home.featureOrderMode')}</li>
            <li>{t('home.featureRouting')}</li>
          </ul>
        </aside>
      </section>
    </main>
  )
}
