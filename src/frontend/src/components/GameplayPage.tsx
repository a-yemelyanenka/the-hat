import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RealtimeSyncState, RoomSessionState } from '../appModels'
import type { GameplayViewDto, PlayerDto, RoundRule } from '../contracts/theHatContracts'
import type { CopyState } from '../appModels'
import './CreateRoomPage.css'
import './LobbyPage.css'
import './GameplayPage.css'

type GameplayPageProps = {
  session: RoomSessionState | null
  gameplayView: GameplayViewDto | null
  syncError: string
  realtimeSyncState: RealtimeSyncState
  isRefreshing: boolean
  isStartingTurn: boolean
  isConfirmingGuess: boolean
  isEndingTurn: boolean
  isPausingGame: boolean
  isResumingGame: boolean
  isContinuingRound: boolean
  actionError: string
  onStartTurn: () => Promise<void>
  onConfirmGuess: () => Promise<void>
  onEndTurn: () => Promise<void>
  onPauseGame: () => Promise<void>
  onResumeGame: () => Promise<void>
  onContinueRound: () => Promise<void>
  onCreateRoom: () => void
  copyState: CopyState
  inviteLink: string
  onCopyInviteLink: () => void
}

type RankedPlayer = {
  player: PlayerDto
  rank: number
  isTied: boolean
}

function getRealtimeStatusMessage(
  realtimeSyncState: RealtimeSyncState,
  isRefreshing: boolean,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (realtimeSyncState === 'connected') {
    return t('gameplay.realtime.connected')
  }

  if (realtimeSyncState === 'connecting') {
    return t('gameplay.realtime.connecting')
  }

  if (realtimeSyncState === 'reconnecting') {
    return t('gameplay.realtime.reconnecting')
  }

  return isRefreshing ? t('gameplay.realtime.refreshing') : t('gameplay.realtime.fallback')
}

function getRoundCopy(
  rule: RoundRule | null | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): { title: string; description: string } | null {
  if (!rule) {
    return null
  }

  return {
    title: t(`gameplay.rounds.${rule}.title`),
    description: t(`gameplay.rounds.${rule}.description`),
  }
}

function getUpcomingRuleCopy(
  roundNumber: number | null | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): { title: string; description: string } | null {
  if (!roundNumber || roundNumber >= 3) {
    return null
  }

  const nextRule = roundNumber === 1 ? 'gesturesOnly' : 'oneWordOnly'
  return getRoundCopy(nextRule, t)
}

function getPlayerName(
  players: PlayerDto[],
  playerId: string | null | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (!playerId) {
    return '—'
  }

  return players.find((player) => player.playerId === playerId)?.displayName ?? t('common.unknownPlayer')
}

function rankPlayers(players: PlayerDto[]): RankedPlayer[] {
  const sortedPlayers = [...players].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }

    return left.orderIndex - right.orderIndex
  })

  return sortedPlayers.map((player, index) => {
    const priorPlayers = sortedPlayers.slice(0, index)
    const firstSameScoreIndex = priorPlayers.findIndex((candidate) => candidate.score === player.score)
    const rank = firstSameScoreIndex >= 0 ? firstSameScoreIndex + 1 : index + 1
    const isTied = sortedPlayers.some(
      (candidate, candidateIndex) => candidateIndex !== index && candidate.score === player.score,
    )

    return {
      player,
      rank,
      isTied,
    }
  })
}

function calculateRemainingSeconds(gameplayView: GameplayViewDto | null): number | null {
  const room = gameplayView?.room
  const currentTurn = room?.currentTurn

  if (!room || !currentTurn) {
    return null
  }

  if (room.phase === 'paused') {
    return currentTurn.remainingSecondsWhenPaused ?? gameplayView.remainingTurnSeconds ?? null
  }

  if (room.phase !== 'inProgress') {
    return gameplayView.remainingTurnSeconds ?? null
  }

  const endsAtMilliseconds = Date.parse(currentTurn.endsAtUtc)
  if (Number.isNaN(endsAtMilliseconds)) {
    return gameplayView.remainingTurnSeconds ?? null
  }

  return Math.max(0, Math.ceil((endsAtMilliseconds - Date.now()) / 1000))
}

export function GameplayPage({
  session,
  gameplayView,
  syncError,
  realtimeSyncState,
  isRefreshing,
  isStartingTurn,
  isConfirmingGuess,
  isEndingTurn,
  isPausingGame,
  isResumingGame,
  isContinuingRound,
  actionError,
  onStartTurn,
  onConfirmGuess,
  onEndTurn,
  onPauseGame,
  onResumeGame,
  onContinueRound,
  onCreateRoom,
  copyState,
  inviteLink,
  onCopyInviteLink,
}: GameplayPageProps) {
  const { t } = useTranslation()
  const room = session?.room ?? null
  const currentPlayerId = session?.currentPlayerId ?? ''
  const [, setTimerTick] = useState(0)

  useEffect(() => {
    if (gameplayView?.room.phase !== 'inProgress' || !gameplayView.room.currentTurn) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setTimerTick((currentValue) => currentValue + 1)
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [gameplayView])

  const liveRemainingSeconds = calculateRemainingSeconds(gameplayView)

  if (!room) {
    return (
      <main className="app-shell app-shell-narrow">
        <section className="panel empty-state">
          <p className="eyebrow">{t('common.gameplay')}</p>
          <h1>{t('gameplay.emptyTitle')}</h1>
          <p className="lead">{t('gameplay.emptyLead')}</p>
          <button className="button button-primary" type="button" onClick={onCreateRoom}>
            {t('common.createAnotherRoom')}
          </button>
        </section>
      </main>
    )
  }

  const currentPlayer = room.players.find((player) => player.playerId === currentPlayerId) ?? null
  const currentRound = room.rounds.find((round) => round.roundNumber === room.currentRoundNumber) ?? null
  const currentRule = gameplayView?.currentRule ?? currentRound?.rule ?? null
  const roundCopy = getRoundCopy(currentRule, t)
  const currentTurn = room.currentTurn
  const isHost = currentPlayerId === room.hostPlayerId
  const rankedPlayers = rankPlayers(room.players)
  const summaryRoundNumber = room.phase === 'roundSummary' || room.phase === 'completed' ? room.currentRoundNumber : null
  const upcomingRuleCopy = getUpcomingRuleCopy(summaryRoundNumber, t)
  const activePlayers = room.players.filter((player) => player.isActive)
  const interruptedTurnPlayers = currentTurn
    ? room.players.filter(
        (player) =>
          (player.playerId === currentTurn.explainerPlayerId || player.playerId === currentTurn.guesserPlayerId) && !player.isActive,
      )
    : []
  const isInterruptedTurn = interruptedTurnPlayers.length > 0
  const canEndInterruptedTurn = room.phase === 'inProgress' && gameplayView?.isCurrentPlayerExplainer && isInterruptedTurn
  const waitingForReconnect = room.phase === 'paused' && !currentTurn && activePlayers.length < 2
  const explainerName = getPlayerName(room.players, currentTurn?.explainerPlayerId, t)
  const guesserName = getPlayerName(room.players, currentTurn?.guesserPlayerId, t)
  const isAwaitingTurnStart = room.phase === 'awaitingTurnStart' && Boolean(currentTurn)
  const phaseLabel =
    room.phase === 'awaitingTurnStart'
      ? t('gameplay.phase.awaitingTurnStart')
      : room.phase === 'inProgress'
      ? t('gameplay.phase.inProgress')
      : room.phase === 'paused'
        ? t('gameplay.phase.paused')
        : room.phase === 'roundSummary'
          ? t('gameplay.phase.roundComplete', { roundNumber: summaryRoundNumber ?? '—' })
          : t('gameplay.phase.finalResults')

  return (
    <main className="app-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">{t('common.gameplay')}</p>
          <h1>{t('gameplay.title')}</h1>
          <p className="lead">{t('gameplay.lead')}</p>
        </div>
        <button className="button button-secondary" type="button" onClick={onCreateRoom}>
          {t('common.newRoom')}
        </button>
      </section>

      <section className="lobby-status-row gameplay-status-row" aria-label={t('gameplay.statusAriaLabel')}>
        <span className={`status-pill ${room.phase === 'completed' ? 'success' : room.phase === 'paused' ? 'warning' : ''}`}>
          {phaseLabel}
        </span>
        <span className="status-note">{getRealtimeStatusMessage(realtimeSyncState, isRefreshing, t)}</span>
        {currentPlayer ? <span className="status-note">{t('lobby.youAre', { displayName: currentPlayer.displayName })}</span> : null}
      </section>

      {syncError ? <p className="banner banner-error">{syncError}</p> : null}
      {actionError ? <p className="banner banner-error">{actionError}</p> : null}

      <section className="gameplay-grid">
        <article className="panel gameplay-panel gameplay-hero-panel">
          <div className="gameplay-hero-copy">
            <p className="eyebrow">{roundCopy?.title ?? t('gameplay.heroEyebrowFallback')}</p>
            <h2>
              {room.phase === 'completed'
                ? t('gameplay.heroTitle.completed')
                : room.phase === 'roundSummary'
                  ? t('gameplay.heroTitle.roundSummary', { roundNumber: summaryRoundNumber ?? '—' })
                  : isAwaitingTurnStart
                    ? gameplayView?.isCurrentPlayerExplainer
                      ? t('gameplay.heroTitle.currentPlayerNext')
                      : t('gameplay.heroTitle.nextExplainer', { explainerName })
                  : waitingForReconnect
                    ? t('gameplay.heroTitle.waitingReconnect')
                    : gameplayView?.isCurrentPlayerExplainer
                      ? t('gameplay.heroTitle.currentPlayerExplain')
                      : gameplayView?.isCurrentPlayerGuesser
                        ? t('gameplay.heroTitle.currentPlayerGuess')
                        : t('gameplay.heroTitle.observer')}
            </h2>
            <p className="lead gameplay-hero-lead">
              {room.phase === 'completed'
                ? t('gameplay.heroLead.completed')
                : room.phase === 'roundSummary'
                  ? t('gameplay.heroLead.roundSummary')
                  : isAwaitingTurnStart
                    ? gameplayView?.isCurrentPlayerExplainer
                      ? t('gameplay.heroLead.currentPlayerNext', { guesserName })
                      : t('gameplay.heroLead.nextPlayers', { explainerName, guesserName })
                  : isInterruptedTurn
                    ? t(
                        interruptedTurnPlayers.length === 1
                          ? 'gameplay.heroLead.interruptedTurnSingle'
                          : 'gameplay.heroLead.interruptedTurnPlural',
                        {
                          playerNames: interruptedTurnPlayers.map((player) => player.displayName).join(', '),
                        },
                      )
                  : waitingForReconnect
                    ? t('gameplay.heroLead.waitingReconnect')
                    : roundCopy?.description ?? t('gameplay.heroLead.fallback')}
            </p>
          </div>

          <div className="gameplay-hero-meta">
            <div className="hero-stat">
              <span>{t('common.round')}</span>
              <strong>{room.currentRoundNumber ?? '—'}</strong>
            </div>
            <div className="hero-stat">
              <span>{t('common.timer')}</span>
              <strong>{liveRemainingSeconds ?? '—'}s</strong>
            </div>
            <div className="hero-stat">
              <span>{t('common.activePlayers')}</span>
              <strong>{activePlayers.length}</strong>
            </div>
          </div>
        </article>

        <article className="panel gameplay-panel invite-panel">
          <h2>{t('gameplay.inviteTitle')}</h2>
          <p className="invite-code">{room.inviteCode}</p>
          <a className="invite-link" href={inviteLink}>
            {inviteLink}
          </a>
          <div className="invite-actions">
            <button className="button button-primary" type="button" onClick={onCopyInviteLink}>
              {t('common.copyInviteLink')}
            </button>
            {copyState === 'copied' ? <span className="status-pill success">{t('common.copied')}</span> : null}
            {copyState === 'failed' ? <span className="status-pill error">{t('common.copyFailed')}</span> : null}
          </div>
        </article>

        <article className="panel gameplay-panel">
          <h2>{t('common.roundRule')}</h2>
          {roundCopy ? (
            <>
              <p className="gameplay-rule-title">{roundCopy.title}</p>
              <p>{roundCopy.description}</p>
            </>
          ) : (
            <p>{t('gameplay.roundRuleFallback')}</p>
          )}
        </article>

        <article className="panel gameplay-panel">
          <h2>{t('gameplay.turnStatus')}</h2>
          {currentTurn ? (
            <>
              <dl className="summary-list">
                <div>
                  <dt>{t('common.turn')}</dt>
                  <dd>{currentTurn.turnNumber}</dd>
                </div>
                <div>
                  <dt>{t('common.explainer')}</dt>
                  <dd>{explainerName}</dd>
                </div>
                <div>
                  <dt>{t('common.guesser')}</dt>
                  <dd>{guesserName}</dd>
                </div>
                <div>
                  <dt>{t('common.timer')}</dt>
                  <dd>
                    {isAwaitingTurnStart
                      ? t('gameplay.startsOnClick')
                      : liveRemainingSeconds === null
                        ? '—'
                        : t('common.secondsLeft', { count: liveRemainingSeconds })}
                  </dd>
                </div>
              </dl>

              <div className="turn-role-grid">
                <article className={`turn-role-card ${gameplayView?.isCurrentPlayerExplainer ? 'turn-role-card-active' : ''}`}>
                  <span className="eyebrow">{t('common.explainer')}</span>
                  <strong>{explainerName}</strong>
                  <p>{gameplayView?.isCurrentPlayerExplainer ? t('gameplay.roleExplainerCurrent') : t('gameplay.roleExplainerOther')}</p>
                  {currentTurn && room.players.some((player) => player.playerId === currentTurn.explainerPlayerId && !player.isActive) ? (
                    <span className="status-pill error">{t('common.inactive')}</span>
                  ) : null}
                </article>

                <article className={`turn-role-card ${gameplayView?.isCurrentPlayerGuesser ? 'turn-role-card-active' : ''}`}>
                  <span className="eyebrow">{t('common.guesser')}</span>
                  <strong>{guesserName}</strong>
                  <p>{gameplayView?.isCurrentPlayerGuesser ? t('gameplay.roleGuesserCurrent') : t('gameplay.roleGuesserOther')}</p>
                  {currentTurn && room.players.some((player) => player.playerId === currentTurn.guesserPlayerId && !player.isActive) ? (
                    <span className="status-pill error">{t('common.inactive')}</span>
                  ) : null}
                </article>
              </div>
            </>
          ) : room.phase === 'roundSummary' ? (
            <p>{t('gameplay.waitingNextRound')}</p>
          ) : waitingForReconnect ? (
            <p>{t('gameplay.clearedTurnWaitingReconnect')}</p>
          ) : (
            <p>{t('gameplay.noActiveTurn')}</p>
          )}
        </article>

        <article className="panel gameplay-panel gameplay-word-panel">
          <h2>{t('common.currentWord')}</h2>
          {room.phase === 'awaitingTurnStart' ? (
            <div className="round-transition-copy">
              <p>{t('gameplay.nextTurnReady')}</p>
              <div className="transition-rule-card gameplay-next-turn-card">
                <span className="eyebrow">{t('common.nextTurn')}</span>
                <strong>
                  {t('gameplay.nextTurnPlayers', { explainerName, guesserName })}
                </strong>
                <p>{t('gameplay.startTimerManually')}</p>
              </div>
              {gameplayView?.isCurrentPlayerExplainer ? (
                <button className="button button-primary" type="button" disabled={isStartingTurn} onClick={() => void onStartTurn()}>
                  {isStartingTurn ? t('gameplay.startingTurn') : t('gameplay.startTurn')}
                </button>
              ) : (
                <p className="status-note">{t('gameplay.waitingForExplainer', { explainerName })}</p>
              )}
            </div>
          ) : room.phase === 'inProgress' || room.phase === 'paused' ? (
            gameplayView?.isCurrentPlayerExplainer ? (
              <>
                <p className="active-word">{gameplayView.activeWord ?? t('common.loadingWord')}</p>
                <p className="status-note">{t('gameplay.onlyExplainerSeesWord')}</p>
                {isInterruptedTurn ? <p className="status-note">{t('gameplay.interruptedTurnHint')}</p> : null}
                <button
                  className="button button-primary"
                  type="button"
                  disabled={room.phase !== 'inProgress' || isConfirmingGuess || !gameplayView.activeWord}
                  onClick={() => void onConfirmGuess()}
                >
                  {isConfirmingGuess ? t('gameplay.confirmingGuess') : t('gameplay.confirmGuessedWord')}
                </button>
                {canEndInterruptedTurn ? (
                  <button className="button button-secondary" type="button" disabled={isEndingTurn} onClick={() => void onEndTurn()}>
                    {isEndingTurn ? t('gameplay.endingTurn') : t('gameplay.endTurn')}
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <p className="observer-copy">{t('gameplay.hiddenWordHint')}</p>
                {gameplayView?.isCurrentPlayerGuesser ? <span className="status-pill">{t('gameplay.youAreGuessing')}</span> : null}
                {!gameplayView?.isCurrentPlayerGuesser ? <span className="status-pill">{t('common.observerView')}</span> : null}
                {isInterruptedTurn ? <p className="status-note">{t('gameplay.interruptedObserverHint')}</p> : null}
              </>
            )
          ) : room.phase === 'roundSummary' ? (
            <div className="round-transition-copy">
              <p>{t('gameplay.roundCompleteReview', { roundNumber: summaryRoundNumber ?? '—' })}</p>
              {upcomingRuleCopy ? (
                <div className="transition-rule-card">
                  <span className="eyebrow">{t('common.nextRound')}</span>
                  <strong>{upcomingRuleCopy.title}</strong>
                  <p>{upcomingRuleCopy.description}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p>{t('gameplay.gameCompleteShownBelow')}</p>
          )}
        </article>

        <article className="panel gameplay-panel">
          <h2>{t('common.hostControls')}</h2>
          {isHost ? (
            <div className="host-actions">
              {room.phase === 'inProgress' ? (
                <button className="button button-secondary" type="button" disabled={isPausingGame} onClick={() => void onPauseGame()}>
                  {isPausingGame ? t('gameplay.pausing') : t('gameplay.pauseGame')}
                </button>
              ) : null}

              {room.phase === 'paused' ? (
                <button className="button button-primary" type="button" disabled={isResumingGame} onClick={() => void onResumeGame()}>
                  {isResumingGame ? t('gameplay.resuming') : t('gameplay.resumeGame')}
                </button>
              ) : null}

              {room.phase === 'roundSummary' ? (
                <button className="button button-primary" type="button" disabled={isContinuingRound} onClick={() => void onContinueRound()}>
                  {isContinuingRound ? t('gameplay.startingNextRound') : t('gameplay.startNextRound')}
                </button>
              ) : null}

              {room.phase === 'completed' ? <p className="status-note">{t('gameplay.allRoundsComplete')}</p> : null}
            </div>
          ) : (
            <p className="status-note">{t('gameplay.onlyHostControls')}</p>
          )}
        </article>

        <article className="panel gameplay-panel gameplay-scoreboard-panel">
          <h2>{room.phase === 'completed' ? t('common.finalRanking') : t('common.scoreboard')}</h2>
          <ol className="scoreboard-list">
            {rankedPlayers.map(({ player, rank, isTied }) => (
              <li key={player.playerId} className={`scoreboard-row ${!player.isActive ? 'inactive-player' : ''}`}>
                <div>
                  <strong>
                    #{rank} · {player.displayName}
                  </strong>
                  <div className="player-badges">
                    {player.isHost ? <span className="status-pill">{t('common.host')}</span> : null}
                    {player.playerId === currentPlayerId ? <span className="status-pill">{t('common.you')}</span> : null}
                    {!player.isActive ? <span className="status-pill error">{t('common.inactive')}</span> : null}
                    {isTied ? <span className="status-pill warning">{t('gameplay.tie')}</span> : null}
                  </div>
                </div>
                <strong>{t('common.pointsShort', { count: player.score })}</strong>
              </li>
            ))}
          </ol>
        </article>

        {(room.phase === 'roundSummary' || room.phase === 'completed') && summaryRoundNumber ? (
          <article className="panel gameplay-panel gameplay-summary-panel">
            <h2>{room.phase === 'completed' ? t('gameplay.gameComplete') : t('gameplay.phase.roundComplete', { roundNumber: summaryRoundNumber })}</h2>
            <p>
              {room.phase === 'completed'
                ? t('gameplay.gameCompleteBody')
                : t('gameplay.roundSummaryBody', { roundNumber: summaryRoundNumber })}
            </p>
            {room.phase === 'roundSummary' && upcomingRuleCopy ? (
              <div className="transition-rule-card">
                <span className="eyebrow">{t('gameplay.prepareNextRule')}</span>
                <strong>{upcomingRuleCopy.title}</strong>
                <p>{upcomingRuleCopy.description}</p>
              </div>
            ) : null}
            {room.phase === 'completed' ? (
              <p className="status-note">{t('gameplay.finalTieHint')}</p>
            ) : null}
          </article>
        ) : null}
      </section>
    </main>
  )
}
