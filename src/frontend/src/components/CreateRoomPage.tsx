import type { FormEvent } from 'react'
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
  return (
    <main className="app-shell app-shell-narrow">
      <section className="page-header">
        <button className="button button-secondary" type="button" onClick={onBack}>
          Back
        </button>
        <div>
          <p className="eyebrow">Create room</p>
          <h1>Set up the first lobby</h1>
          <p className="lead">
            Pick the host identity and the starting rules for the room.
          </p>
        </div>
      </section>

      <section className="form-layout">
        <form className="panel create-room-form" onSubmit={onSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="hostDisplayName">Host display name</label>
            <input
              id="hostDisplayName"
              name="hostDisplayName"
              type="text"
              autoComplete="nickname"
              maxLength={40}
              placeholder="Alex"
              value={formState.hostDisplayName}
              onChange={(event) => onHostDisplayNameChange(event.target.value)}
              aria-invalid={Boolean(fieldErrors.hostDisplayName)}
              aria-describedby={fieldErrors.hostDisplayName ? 'hostDisplayName-error' : undefined}
            />
            <p className="field-hint">This name becomes the host player in the room.</p>
            {fieldErrors.hostDisplayName ? (
              <p className="field-error" id="hostDisplayName-error">
                {fieldErrors.hostDisplayName}
              </p>
            ) : null}
          </div>

          <div className="two-column-grid">
            <div className="form-field">
              <label htmlFor="wordsPerPlayer">Words per player</label>
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
              <label htmlFor="turnDurationSeconds">Turn timer (seconds)</label>
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
            <legend>Player order mode</legend>
            <label className="choice-card">
              <input
                type="radio"
                name="playerOrderMode"
                value="random"
                checked={formState.playerOrderMode === 'random'}
                onChange={() => onPlayerOrderModeChange('random')}
              />
              <span>
                <strong>Random</strong>
                <small>Generate the order automatically when the lobby is ready.</small>
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
                <strong>Manual</strong>
                <small>The host will arrange player order later in the lobby.</small>
              </span>
            </label>
          </fieldset>

          {serverError ? <p className="banner banner-error">{serverError}</p> : null}

          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating room…' : 'Create room'}
            </button>
          </div>
        </form>

        <aside className="panel side-panel" aria-label="Setup summary">
          <h2>Default-friendly setup</h2>
          <p>
            The form starts with sensible values so a host can create a room quickly,
            then refine lobby details in later flows.
          </p>
          <dl className="summary-list">
            <div>
              <dt>Words per player</dt>
              <dd>{formState.wordsPerPlayer || '—'}</dd>
            </div>
            <div>
              <dt>Turn timer</dt>
              <dd>{formState.turnDurationSeconds || '—'} seconds</dd>
            </div>
            <div>
              <dt>Order mode</dt>
              <dd>{formState.playerOrderMode === 'random' ? 'Random' : 'Manual'}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  )
}
