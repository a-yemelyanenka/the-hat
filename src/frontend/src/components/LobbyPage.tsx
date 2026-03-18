import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { LobbySettingsFormState, RoomSessionState } from '../appModels'
import type { CopyState } from '../appModels'
import type { PlayerDto, RoomSnapshotDto } from '../contracts/theHatContracts'
import { WordSubmissionPanel } from './WordSubmissionPanel'
import './CreateRoomPage.css'
import './LobbyPage.css'

type LobbyPageProps = {
  session: RoomSessionState | null
  inviteLink: string
  copyState: CopyState
  syncError: string
  isRefreshing: boolean
  isSavingSettings: boolean
  settingsError: string
  settingsSuccess: string
  isStartingGame: boolean
  startError: string
  onCopyInviteLink: () => void
  onCreateRoom: () => void
  onSaveSettings: (settings: LobbySettingsFormState, orderedPlayerIds?: string[]) => Promise<boolean>
  onStartGame: () => Promise<void>
  onRoomUpdated: (room: RoomSnapshotDto) => void
}

function buildSettingsForm(room: RoomSnapshotDto): LobbySettingsFormState {
  return {
    wordsPerPlayer: String(room.settings.wordsPerPlayer),
    turnDurationSeconds: String(room.settings.turnDurationSeconds),
    playerOrderMode: room.settings.playerOrderMode,
  }
}

function getOrderedPlayerIds(players: PlayerDto[]): string[] {
  return [...players]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((player) => player.playerId)
}

export function LobbyPage({
  session,
  inviteLink,
  copyState,
  syncError,
  isRefreshing,
  isSavingSettings,
  settingsError,
  settingsSuccess,
  isStartingGame,
  startError,
  onCopyInviteLink,
  onCreateRoom,
  onSaveSettings,
  onStartGame,
  onRoomUpdated,
}: LobbyPageProps) {
  const room = session?.room ?? null
  const currentPlayerId = session?.currentPlayerId ?? ''
  const currentPlayer = room?.players.find((player) => player.playerId === currentPlayerId) ?? null
  const hostPlayer = room?.players.find((player) => player.playerId === room.hostPlayerId) ?? null
  const isHost = Boolean(room && currentPlayerId === room.hostPlayerId)

  const [draftSettingsForm, setDraftSettingsForm] = useState<LobbySettingsFormState | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [localSettingsError, setLocalSettingsError] = useState('')

  const settingsForm = isDirty && draftSettingsForm ? draftSettingsForm : room ? buildSettingsForm(room) : null

  const progressByPlayerId = useMemo(
    () =>
      new Map(
        (room?.submissionProgress ?? []).map((progress) => [progress.playerId, progress] as const),
      ),
    [room],
  )

  if (!room || !settingsForm) {
    return (
      <main className="app-shell app-shell-narrow">
        <section className="panel empty-state">
          <p className="eyebrow">Lobby</p>
          <h1>Room data is not available in this session</h1>
          <p className="lead">
            Create a new room or reopen an invite link to continue in the current browser session.
          </p>
          <button className="button button-primary" type="button" onClick={onCreateRoom}>
            Create another room
          </button>
        </section>
      </main>
    )
  }

  const orderedPlayers = [...room.players].sort((left, right) => left.orderIndex - right.orderIndex)
  const canStartGame = room.phase === 'lobby' && room.lobbyReadiness.canStart

  const handleSettingsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const wordsPerPlayer = Number(settingsForm.wordsPerPlayer)
    const turnDurationSeconds = Number(settingsForm.turnDurationSeconds)

    if (!Number.isInteger(wordsPerPlayer) || wordsPerPlayer <= 0) {
      setLocalSettingsError('Words per player must be a whole number greater than zero.')
      return
    }

    if (!Number.isInteger(turnDurationSeconds) || turnDurationSeconds <= 0) {
      setLocalSettingsError('Turn timer must be a whole number greater than zero.')
      return
    }

    setLocalSettingsError('')
    const saved = await onSaveSettings(
      settingsForm,
      settingsForm.playerOrderMode === 'manual' ? getOrderedPlayerIds(orderedPlayers) : undefined,
    )

    if (saved) {
      setDraftSettingsForm(null)
      setLocalSettingsError('')
      setIsDirty(false)
    }
  }

  const handleMovePlayer = async (playerId: string, offset: -1 | 1) => {
    const currentIndex = orderedPlayers.findIndex((player) => player.playerId === playerId)
    const nextIndex = currentIndex + offset
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedPlayers.length) {
      return
    }

    const reorderedPlayers = [...orderedPlayers]
    ;[reorderedPlayers[currentIndex], reorderedPlayers[nextIndex]] = [reorderedPlayers[nextIndex], reorderedPlayers[currentIndex]]

    await onSaveSettings(buildSettingsForm(room), getOrderedPlayerIds(reorderedPlayers))
  }

  return (
    <main className="app-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Lobby</p>
          <h1>Live lobby ready for players</h1>
          <p className="lead">
            The player list, readiness state, and settings refresh automatically while everyone joins.
          </p>
        </div>
        <button className="button button-secondary" type="button" onClick={onCreateRoom}>
          New room
        </button>
      </section>

      <section className="lobby-status-row" aria-label="Lobby status">
        <span className={`status-pill ${room.lobbyReadiness.canStart ? 'success' : 'warning'}`}>
          {room.lobbyReadiness.canStart ? 'Ready to start' : 'Waiting for submissions'}
        </span>
        <span className="status-note">{isRefreshing ? 'Refreshing lobby…' : 'Updates every few seconds'}</span>
        {currentPlayer ? <span className="status-note">You are {currentPlayer.displayName}</span> : null}
      </section>

      {syncError ? <p className="banner banner-error">{syncError}</p> : null}
      {room.phase !== 'lobby' ? (
        <p className="banner banner-success">
          The game has started. Gameplay screens are planned in a later issue, so the lobby remains read-only for now.
        </p>
      ) : null}

      <section className="lobby-grid">
        <article className="panel invite-panel">
          <h2>Invite</h2>
          <p className="invite-code">{room.inviteCode}</p>
          <a className="invite-link" href={inviteLink}>
            {inviteLink}
          </a>
          <div className="invite-actions">
            <button className="button button-primary" type="button" onClick={onCopyInviteLink}>
              Copy invite link
            </button>
            {copyState === 'copied' ? <span className="status-pill success">Copied</span> : null}
            {copyState === 'failed' ? <span className="status-pill error">Copy failed</span> : null}
          </div>
        </article>

        <article className="panel readiness-panel">
          <h2>Start readiness</h2>
          <dl className="summary-list">
            <div>
              <dt>Host</dt>
              <dd>{hostPlayer?.displayName ?? 'Host'}</dd>
            </div>
            <div>
              <dt>Players connected</dt>
              <dd>{room.players.length}</dd>
            </div>
            <div>
              <dt>Submission progress</dt>
              <dd>
                {room.submissionProgress.filter((progress) => progress.isComplete).length}/{room.submissionProgress.length} ready
              </dd>
            </div>
          </dl>

          {room.lobbyReadiness.blockingReasons.length > 0 ? (
            <ul className="blocking-list">
              {room.lobbyReadiness.blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="status-note">Every active player has the required words, so the host can start.</p>
          )}

          {isHost ? (
            <div className="start-actions">
              <button
                className="button button-primary"
                type="button"
                disabled={!canStartGame || isStartingGame}
                onClick={() => void onStartGame()}
              >
                {isStartingGame ? 'Starting game…' : 'Start game'}
              </button>
              {startError ? <p className="banner banner-error compact-banner">{startError}</p> : null}
            </div>
          ) : (
            <p className="status-note">Only the host can start the game.</p>
          )}
        </article>

        <article className="panel players-panel">
          <h2>Players</h2>
          <ul className="player-list">
            {orderedPlayers.map((player, index) => {
              const progress = progressByPlayerId.get(player.playerId)

              return (
                <li key={player.playerId} className="player-row">
                  <div className="player-main">
                    <span className="player-order">{index + 1}</span>
                    <div className="player-copy">
                      <strong>{player.displayName}</strong>
                      <div className="player-badges">
                        {player.isHost ? <span className="status-pill">Host</span> : null}
                        {player.playerId === currentPlayerId ? <span className="status-pill">You</span> : null}
                        {!player.isActive ? <span className="status-pill error">Inactive</span> : null}
                      </div>
                    </div>
                  </div>
                  <div className="player-progress">
                    <span className={`status-pill ${progress?.isComplete ? 'success' : 'warning'}`}>
                      {progress ? `${progress.submittedCount}/${progress.requiredCount} words` : '0/0 words'}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </article>

        <WordSubmissionPanel room={room} currentPlayerId={currentPlayerId} onRoomUpdated={onRoomUpdated} />

        <article className="panel settings-panel">
          <h2>{isHost ? 'Lobby settings' : 'Current settings'}</h2>

          {isHost ? (
            <form className="settings-form" onSubmit={handleSettingsSubmit} noValidate>
              <div className="two-column-grid">
                <div className="form-field">
                  <label htmlFor="lobbyWordsPerPlayer">Words per player</label>
                  <input
                    id="lobbyWordsPerPlayer"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={settingsForm.wordsPerPlayer}
                    onChange={(event) => {
                      setDraftSettingsForm({
                        ...settingsForm,
                        wordsPerPlayer: event.target.value,
                      })
                      setIsDirty(true)
                    }}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="lobbyTurnDuration">Turn timer (seconds)</label>
                  <input
                    id="lobbyTurnDuration"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={settingsForm.turnDurationSeconds}
                    onChange={(event) => {
                      setDraftSettingsForm({
                        ...settingsForm,
                        turnDurationSeconds: event.target.value,
                      })
                      setIsDirty(true)
                    }}
                  />
                </div>
              </div>

              <fieldset className="form-field radio-group">
                <legend>Player order mode</legend>
                <label className="choice-card compact-choice-card">
                  <input
                    type="radio"
                    name="lobbyPlayerOrderMode"
                    value="random"
                    checked={settingsForm.playerOrderMode === 'random'}
                    onChange={() => {
                      setDraftSettingsForm({
                        ...settingsForm,
                        playerOrderMode: 'random',
                      })
                      setIsDirty(true)
                    }}
                  />
                  <span>
                    <strong>Random</strong>
                    <small>The backend keeps a random order visible to everyone.</small>
                  </span>
                </label>

                <label className="choice-card compact-choice-card">
                  <input
                    type="radio"
                    name="lobbyPlayerOrderMode"
                    value="manual"
                    checked={settingsForm.playerOrderMode === 'manual'}
                    onChange={() => {
                      setDraftSettingsForm({
                        ...settingsForm,
                        playerOrderMode: 'manual',
                      })
                      setIsDirty(true)
                    }}
                  />
                  <span>
                    <strong>Manual</strong>
                    <small>Move players up and down before the game starts.</small>
                  </span>
                </label>
              </fieldset>

              {localSettingsError ? <p className="banner banner-error compact-banner">{localSettingsError}</p> : null}
              {settingsError ? <p className="banner banner-error compact-banner">{settingsError}</p> : null}
              {settingsSuccess ? <p className="banner banner-success compact-banner">{settingsSuccess}</p> : null}

              <div className="form-actions">
                <button className="button button-primary" type="submit" disabled={!isDirty || isSavingSettings}>
                  {isSavingSettings ? 'Saving settings…' : 'Save settings'}
                </button>
              </div>
            </form>
          ) : (
            <dl className="summary-list">
              <div>
                <dt>Words per player</dt>
                <dd>{room.settings.wordsPerPlayer}</dd>
              </div>
              <div>
                <dt>Turn timer</dt>
                <dd>{room.settings.turnDurationSeconds} seconds</dd>
              </div>
              <div>
                <dt>Order mode</dt>
                <dd>{room.settings.playerOrderMode === 'random' ? 'Random' : 'Manual'}</dd>
              </div>
            </dl>
          )}
        </article>

        <article className="panel order-panel">
          <div className="order-panel-header">
            <h2>Player order</h2>
            <span className="status-note">
              {room.settings.playerOrderMode === 'random' ? 'Random order is active' : 'Manual order is active'}
            </span>
          </div>
          <ol className="order-list">
            {orderedPlayers.map((player, index) => (
              <li key={player.playerId} className="order-row">
                <span>{player.displayName}</span>
                {isHost && room.settings.playerOrderMode === 'manual' && room.phase === 'lobby' ? (
                  <div className="order-actions">
                    <button
                      className="button button-secondary order-button"
                      type="button"
                      disabled={index === 0 || isSavingSettings}
                      onClick={() => void handleMovePlayer(player.playerId, -1)}
                    >
                      Move up
                    </button>
                    <button
                      className="button button-secondary order-button"
                      type="button"
                      disabled={index === orderedPlayers.length - 1 || isSavingSettings}
                      onClick={() => void handleMovePlayer(player.playerId, 1)}
                    >
                      Move down
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="status-note">
            The explainer and the player on their left use this stored order cyclically when turns begin.
          </p>
        </article>
      </section>
    </main>
  )
}
