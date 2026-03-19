import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { LobbySettingsFormState, RealtimeSyncState, RoomSessionState } from '../appModels'
import type { CopyState } from '../appModels'
import type { PlayerDto, RoomSnapshotDto } from '../contracts/theHatContracts'
import { translateLocalizedMessage } from '../localization'
import { WordSubmissionPanel } from './WordSubmissionPanel'
import './CreateRoomPage.css'
import './LobbyPage.css'

type LobbyPageProps = {
  session: RoomSessionState | null
  inviteLink: string
  copyState: CopyState
  syncError: string
  isRefreshing: boolean
  realtimeSyncState: RealtimeSyncState
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
  return players.map((player) => player.playerId)
}

export function LobbyPage({
  session,
  inviteLink,
  copyState,
  syncError,
  isRefreshing,
  realtimeSyncState,
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
  const { t } = useTranslation()
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
          <p className="eyebrow">{t('common.lobby')}</p>
          <h1>{t('lobby.emptyTitle')}</h1>
          <p className="lead">{t('lobby.emptyLead')}</p>
          <button className="button button-primary" type="button" onClick={onCreateRoom}>
            {t('common.createAnotherRoom')}
          </button>
        </section>
      </main>
    )
  }

  const orderedPlayers = [...room.players].sort((left, right) => left.orderIndex - right.orderIndex)
  const canStartGame = room.phase === 'lobby' && room.lobbyReadiness.canStart
  const realtimeStatusMessage =
    realtimeSyncState === 'connected'
      ? t('lobby.realtime.connected')
      : realtimeSyncState === 'connecting'
        ? t('lobby.realtime.connecting')
        : realtimeSyncState === 'reconnecting'
          ? t('lobby.realtime.reconnecting')
          : isRefreshing
            ? t('lobby.realtime.refreshing')
            : t('lobby.realtime.fallback')

  const handleSettingsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const wordsPerPlayer = Number(settingsForm.wordsPerPlayer)
    const turnDurationSeconds = Number(settingsForm.turnDurationSeconds)

    if (!Number.isInteger(wordsPerPlayer) || wordsPerPlayer <= 0) {
      setLocalSettingsError(t('lobby.localValidationWords'))
      return
    }

    if (!Number.isInteger(turnDurationSeconds) || turnDurationSeconds <= 0) {
      setLocalSettingsError(t('lobby.localValidationTimer'))
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
          <p className="eyebrow">{t('common.lobby')}</p>
          <h1>{t('lobby.title')}</h1>
          <p className="lead">{t('lobby.lead')}</p>
        </div>
        <button className="button button-secondary" type="button" onClick={onCreateRoom}>
          {t('common.newRoom')}
        </button>
      </section>

      <section className="lobby-status-row" aria-label={t('lobby.statusAriaLabel')}>
        <span className={`status-pill ${room.lobbyReadiness.canStart ? 'success' : 'warning'}`}>
          {room.lobbyReadiness.canStart ? t('lobby.readyToStart') : t('lobby.waitingForSubmissions')}
        </span>
        <span className="status-note">{realtimeStatusMessage}</span>
        {currentPlayer ? <span className="status-note">{t('lobby.youAre', { displayName: currentPlayer.displayName })}</span> : null}
      </section>

      {syncError ? <p className="banner banner-error">{syncError}</p> : null}
      {room.phase !== 'lobby' ? (
        <p className="banner banner-success">
          {t('lobby.gameStartedBanner')}
        </p>
      ) : null}

      <section className="lobby-grid">
        <article className="panel invite-panel">
          <h2>{t('lobby.inviteTitle')}</h2>
          <p className="invite-code">{room.inviteCode}</p>
          <a className="invite-link" href={inviteLink} aria-label={t('lobby.inviteLinkAriaLabel')}>
            {inviteLink}
          </a>
          <div className="invite-actions">
            <button className="button button-primary" type="button" onClick={onCopyInviteLink}>
              {t('lobby.copyInviteLink')}
            </button>
            {copyState === 'copied' ? <span className="status-pill success">{t('common.copied')}</span> : null}
            {copyState === 'failed' ? <span className="status-pill error">{t('common.copyFailed')}</span> : null}
          </div>
        </article>

        <article className="panel readiness-panel">
          <h2>{t('lobby.startReadiness')}</h2>
          <dl className="summary-list">
            <div>
              <dt>{t('common.host')}</dt>
              <dd>{hostPlayer?.displayName ?? t('lobby.hostFallback')}</dd>
            </div>
            <div>
              <dt>{t('lobby.playersConnected')}</dt>
              <dd>{room.players.length}</dd>
            </div>
            <div>
              <dt>{t('lobby.submissionProgress')}</dt>
              <dd>
                {t('common.readyFraction', {
                  readyCount: room.submissionProgress.filter((progress) => progress.isComplete).length,
                  totalCount: room.submissionProgress.length,
                })}
              </dd>
            </div>
          </dl>

          {room.lobbyReadiness.blockingReasons.length > 0 ? (
            <ul className="blocking-list">
              {room.lobbyReadiness.blockingReasons.map((reason, index) => (
                <li key={`${reason}-${index}`}>
                  {translateLocalizedMessage(t, room.lobbyReadiness.blockingMessages[index], reason)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="status-note">{t('lobby.readyToStartHint')}</p>
          )}

          {isHost ? (
            <div className="start-actions">
              <button
                className="button button-primary"
                type="button"
                disabled={!canStartGame || isStartingGame}
                onClick={() => void onStartGame()}
              >
                {isStartingGame ? t('lobby.startingGame') : t('common.startGame')}
              </button>
              {startError ? <p className="banner banner-error compact-banner">{startError}</p> : null}
            </div>
          ) : (
            <p className="status-note">{t('lobby.onlyHostCanStart')}</p>
          )}
        </article>

        <article className="panel players-panel">
          <h2>{t('lobby.playersTitle')}</h2>
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
                        {player.isHost ? <span className="status-pill">{t('common.host')}</span> : null}
                        {player.playerId === currentPlayerId ? <span className="status-pill">{t('common.you')}</span> : null}
                        {!player.isActive ? <span className="status-pill error">{t('common.inactive')}</span> : null}
                      </div>
                    </div>
                  </div>
                  <div className="player-progress">
                    <span className={`status-pill ${progress?.isComplete ? 'success' : 'warning'}`}>
                      {progress
                        ? t('lobby.wordsProgress', {
                            submittedCount: progress.submittedCount,
                            requiredCount: progress.requiredCount,
                          })
                        : t('lobby.zeroWordsProgress')}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </article>

        <WordSubmissionPanel room={room} currentPlayerId={currentPlayerId} onRoomUpdated={onRoomUpdated} />

        <article className="panel settings-panel">
          <h2>{isHost ? t('lobby.lobbySettings') : t('lobby.currentSettings')}</h2>

          {isHost ? (
            <form className="settings-form" onSubmit={handleSettingsSubmit} noValidate>
              <div className="two-column-grid">
                <div className="form-field">
                  <label htmlFor="lobbyWordsPerPlayer">{t('common.wordsPerPlayer')}</label>
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
                  <label htmlFor="lobbyTurnDuration">{t('common.turnTimerSeconds')}</label>
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
                <legend>{t('common.playerOrderMode')}</legend>
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
                    <strong>{t('common.random')}</strong>
                    <small>{t('lobby.randomDescription')}</small>
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
                    <strong>{t('common.manual')}</strong>
                    <small>{t('lobby.manualDescription')}</small>
                  </span>
                </label>
              </fieldset>

              {localSettingsError ? <p className="banner banner-error compact-banner">{localSettingsError}</p> : null}
              {settingsError ? <p className="banner banner-error compact-banner">{settingsError}</p> : null}
              {settingsSuccess ? <p className="banner banner-success compact-banner">{settingsSuccess}</p> : null}

              <div className="form-actions">
                <button className="button button-primary" type="submit" disabled={!isDirty || isSavingSettings}>
                  {isSavingSettings ? t('lobby.savingSettings') : t('common.saveSettings')}
                </button>
              </div>
            </form>
          ) : (
            <dl className="summary-list">
              <div>
                <dt>{t('common.wordsPerPlayer')}</dt>
                <dd>{room.settings.wordsPerPlayer}</dd>
              </div>
              <div>
                <dt>{t('common.timer')}</dt>
                <dd>{t('common.secondsLong', { count: room.settings.turnDurationSeconds })}</dd>
              </div>
              <div>
                <dt>{t('common.orderMode')}</dt>
                <dd>{room.settings.playerOrderMode === 'random' ? t('common.random') : t('common.manual')}</dd>
              </div>
            </dl>
          )}
        </article>

        <article className="panel order-panel">
          <div className="order-panel-header">
            <h2>{t('lobby.playerOrder')}</h2>
            <span className="status-note">
              {room.settings.playerOrderMode === 'random' ? t('lobby.randomOrderActive') : t('lobby.manualOrderActive')}
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
                      {t('lobby.moveUp')}
                    </button>
                    <button
                      className="button button-secondary order-button"
                      type="button"
                      disabled={index === orderedPlayers.length - 1 || isSavingSettings}
                      onClick={() => void handleMovePlayer(player.playerId, 1)}
                    >
                      {t('lobby.moveDown')}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="status-note">{t('lobby.storedOrderHint')}</p>
        </article>
      </section>
    </main>
  )
}
