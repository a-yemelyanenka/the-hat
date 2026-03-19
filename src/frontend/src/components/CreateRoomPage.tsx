import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { PlayerOrderMode } from '../contracts/theHatContracts'
import type { CreateRoomFormState, FieldErrors } from '../appModels'
import './CreateRoomPage.css'

type CreateRoomPageProps = {
  formState: CreateRoomFormState
  fieldErrors: FieldErrors
  serverError: string
  isSubmitting: boolean
  onBack: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onHostDisplayNameChange: (value: string) => void
  onWordsPerPlayerChange: (value: string) => void
  onTurnDurationSecondsChange: (value: string) => void
  onPlayerOrderModeChange: (value: PlayerOrderMode) => void
}

export function CreateRoomPage({
  formState,
  fieldErrors,
  serverError,
  isSubmitting,
  onBack,
  onSubmit,
  onHostDisplayNameChange,
  onWordsPerPlayerChange,
  onTurnDurationSecondsChange,
  onPlayerOrderModeChange,
}: CreateRoomPageProps) {
  const { t } = useTranslation()

  return (
    <main className="app-shell app-shell-narrow">
      <section className="page-header">
        <button className="button button-secondary" type="button" onClick={onBack}>
          {t('common.back')}
        </button>
        <div>
          <p className="eyebrow">{t('createRoom.eyebrow')}</p>
          <h1>{t('createRoom.title')}</h1>
          <p className="lead">{t('createRoom.lead')}</p>
        </div>
      </section>

      <section className="form-layout">
        <form className="panel create-room-form" onSubmit={onSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="hostDisplayName">{t('createRoom.hostDisplayName')}</label>
            <input
              id="hostDisplayName"
              name="hostDisplayName"
              type="text"
              autoComplete="nickname"
              maxLength={40}
              placeholder={t('createRoom.hostPlaceholder')}
              value={formState.hostDisplayName}
              onChange={(event) => onHostDisplayNameChange(event.target.value)}
              aria-invalid={Boolean(fieldErrors.hostDisplayName)}
              aria-describedby={fieldErrors.hostDisplayName ? 'hostDisplayName-error' : undefined}
            />
            <p className="field-hint">{t('createRoom.hostHint')}</p>
            {fieldErrors.hostDisplayName ? (
              <p className="field-error" id="hostDisplayName-error">
                {fieldErrors.hostDisplayName}
              </p>
            ) : null}
          </div>

          <div className="two-column-grid">
            <div className="form-field">
              <label htmlFor="wordsPerPlayer">{t('common.wordsPerPlayer')}</label>
              <input
                id="wordsPerPlayer"
                name="wordsPerPlayer"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={formState.wordsPerPlayer}
                onChange={(event) => onWordsPerPlayerChange(event.target.value)}
                aria-invalid={Boolean(fieldErrors.wordsPerPlayer)}
                aria-describedby={fieldErrors.wordsPerPlayer ? 'wordsPerPlayer-error' : undefined}
              />
              {fieldErrors.wordsPerPlayer ? (
                <p className="field-error" id="wordsPerPlayer-error">
                  {fieldErrors.wordsPerPlayer}
                </p>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor="turnDurationSeconds">{t('common.turnTimerSeconds')}</label>
              <input
                id="turnDurationSeconds"
                name="turnDurationSeconds"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={formState.turnDurationSeconds}
                onChange={(event) => onTurnDurationSecondsChange(event.target.value)}
                aria-invalid={Boolean(fieldErrors.turnDurationSeconds)}
                aria-describedby={fieldErrors.turnDurationSeconds ? 'turnDurationSeconds-error' : undefined}
              />
              {fieldErrors.turnDurationSeconds ? (
                <p className="field-error" id="turnDurationSeconds-error">
                  {fieldErrors.turnDurationSeconds}
                </p>
              ) : null}
            </div>
          </div>

          <fieldset className="form-field radio-group">
            <legend>{t('createRoom.orderLegend')}</legend>
            <label className="choice-card">
              <input
                type="radio"
                name="playerOrderMode"
                value="random"
                checked={formState.playerOrderMode === 'random'}
                onChange={() => onPlayerOrderModeChange('random')}
              />
              <span>
                <strong>{t('common.random')}</strong>
                <small>{t('createRoom.randomDescription')}</small>
              </span>
            </label>

            <label className="choice-card">
              <input
                type="radio"
                name="playerOrderMode"
                value="manual"
                checked={formState.playerOrderMode === 'manual'}
                onChange={() => onPlayerOrderModeChange('manual')}
              />
              <span>
                <strong>{t('common.manual')}</strong>
                <small>{t('createRoom.manualDescription')}</small>
              </span>
            </label>
          </fieldset>

          {serverError ? <p className="banner banner-error">{serverError}</p> : null}

          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('createRoom.creating') : t('common.createRoom')}
            </button>
          </div>
        </form>

        <aside className="panel side-panel" aria-label={t('createRoom.summaryAriaLabel')}>
          <h2>{t('createRoom.summaryTitle')}</h2>
          <p>{t('createRoom.summaryBody')}</p>
          <dl className="summary-list">
            <div>
              <dt>{t('common.wordsPerPlayer')}</dt>
              <dd>{formState.wordsPerPlayer || t('createRoom.noValue')}</dd>
            </div>
            <div>
              <dt>{t('common.timer')}</dt>
              <dd>
                {formState.turnDurationSeconds
                  ? t('createRoom.secondsValue', { count: Number(formState.turnDurationSeconds) })
                  : t('createRoom.noValue')}
              </dd>
            </div>
            <div>
              <dt>{t('common.orderMode')}</dt>
              <dd>
                {formState.playerOrderMode === 'random'
                  ? t('createRoom.orderModeValue.random')
                  : t('createRoom.orderModeValue.manual')}
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  )
}
