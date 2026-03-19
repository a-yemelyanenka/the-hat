import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import './CreateRoomPage.css'
import './JoinRoomPage.css'

type JoinRoomPageProps = {
  inviteCode: string
  displayName: string
  fieldError: string
  serverError: string
  isSubmitting: boolean
  onBack: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDisplayNameChange: (value: string) => void
}

export function JoinRoomPage({
  inviteCode,
  displayName,
  fieldError,
  serverError,
  isSubmitting,
  onBack,
  onSubmit,
  onDisplayNameChange,
}: JoinRoomPageProps) {
  const { t } = useTranslation()

  return (
    <main className="app-shell app-shell-narrow">
      <section className="page-header">
        <button className="button button-secondary" type="button" onClick={onBack}>
          {t('common.back')}
        </button>
        <div>
          <p className="eyebrow">{t('joinRoom.eyebrow')}</p>
          <h1>{t('joinRoom.title')}</h1>
          <p className="lead">
            {t('joinRoom.inviteLead', { inviteCode })}
          </p>
        </div>
      </section>

      <section className="form-layout">
        <form className="panel join-room-form" onSubmit={onSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="displayName">{t('joinRoom.displayName')}</label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="nickname"
              maxLength={40}
              placeholder={t('joinRoom.placeholder')}
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? 'displayName-error' : undefined}
            />
            <p className="field-hint">{t('joinRoom.hint')}</p>
            {fieldError ? (
              <p className="field-error" id="displayName-error">
                {fieldError}
              </p>
            ) : null}
          </div>

          {serverError ? <p className="banner banner-error">{serverError}</p> : null}

          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('joinRoom.joining') : t('joinRoom.eyebrow')}
            </button>
          </div>
        </form>

        <aside className="panel join-room-copy" aria-label={t('joinRoom.asideAriaLabel')}>
          <h2>{t('joinRoom.asideTitle')}</h2>
          <p>{t('joinRoom.asideBody')}</p>
          <dl className="summary-list">
            <div>
              <dt>{t('common.inviteCode')}</dt>
              <dd>{inviteCode}</dd>
            </div>
            <div>
              <dt>{t('joinRoom.nameMatching')}</dt>
              <dd>{t('joinRoom.matchingRule')}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  )
}