import type { FormEvent } from 'react'
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
  return (
    <main className="app-shell app-shell-narrow">
      <section className="page-header">
        <button className="button button-secondary" type="button" onClick={onBack}>
          Back
        </button>
        <div>
          <p className="eyebrow">Join room</p>
          <h1>Enter a display name to join or rejoin the lobby</h1>
          <p className="lead">
            Invite code <span className="join-room-invite-code">{inviteCode}</span>
          </p>
        </div>
      </section>

      <section className="form-layout">
        <form className="panel join-room-form" onSubmit={onSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="nickname"
              maxLength={40}
              placeholder="Sam"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? 'displayName-error' : undefined}
            />
            <p className="field-hint">Names must be unique in the room after trimming spaces and ignoring case.</p>
            {fieldError ? (
              <p className="field-error" id="displayName-error">
                {fieldError}
              </p>
            ) : null}
          </div>

          {serverError ? <p className="banner banner-error">{serverError}</p> : null}

          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Joining room…' : 'Join room'}
            </button>
          </div>
        </form>

        <aside className="panel join-room-copy" aria-label="Join room details">
          <h2>Before you join</h2>
          <p>
            The host is already included as a player. Use the same trimmed display name to restore your player entry
            after a refresh or reconnect.
          </p>
          <dl className="summary-list">
            <div>
              <dt>Invite code</dt>
              <dd>{inviteCode}</dd>
            </div>
            <div>
              <dt>Name matching</dt>
              <dd>Trimmed and case-insensitive</dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  )
}