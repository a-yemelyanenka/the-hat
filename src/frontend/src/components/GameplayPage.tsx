import { useEffect, useState, type ReactNode } from 'react'
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
  onGoHome: () => void
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

type GameplayDetailTab = 'details' | 'scores'

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
  onGoHome,
  onCreateRoom,
  copyState,
  inviteLink,
  onCopyInviteLink,
}: GameplayPageProps) {
  const { t } = useTranslation()
  const room = session?.room ?? null
  const currentPlayerId = session?.currentPlayerId ?? ''
  const [, setTimerTick] = useState(0)
  const [detailTab, setDetailTab] = useState<GameplayDetailTab>('details')
  const [isSecondaryPanelOpen, setIsSecondaryPanelOpen] = useState(false)

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
  const isCurrentPlayerExplainer = Boolean(gameplayView?.isCurrentPlayerExplainer)
  const isCurrentPlayerGuesser = Boolean(gameplayView?.isCurrentPlayerGuesser)
  const isCurrentPlayerObserver = !isCurrentPlayerExplainer && !isCurrentPlayerGuesser
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
  const canEndInterruptedTurn = room.phase === 'inProgress' && isCurrentPlayerExplainer && isInterruptedTurn
  const waitingForReconnect = room.phase === 'paused' && !currentTurn && activePlayers.length < 2
  const explainerName = getPlayerName(room.players, currentTurn?.explainerPlayerId, t)
  const guesserName = getPlayerName(room.players, currentTurn?.guesserPlayerId, t)
  const isAwaitingTurnStart = room.phase === 'awaitingTurnStart' && Boolean(currentTurn)
  const isFocusPhase = room.phase === 'awaitingTurnStart' || room.phase === 'inProgress' || room.phase === 'paused'
  const secondaryPanelOpen = isSecondaryPanelOpen
  const timerToneClass =
    room.phase === 'paused'
      ? 'gameplay-stage-timer-paused'
      : liveRemainingSeconds !== null && liveRemainingSeconds <= 5
        ? 'gameplay-stage-timer-critical'
        : liveRemainingSeconds !== null && liveRemainingSeconds <= 10
          ? 'gameplay-stage-timer-warning'
          : ''
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

  let stageEyebrow = roundCopy?.title ?? t('gameplay.heroEyebrowFallback')
  let stageTitle = t('gameplay.heroTitle.observer')
  let stageLead = roundCopy?.description ?? t('gameplay.heroLead.fallback')
  let stageBody: ReactNode = null

  if (room.phase === 'completed') {
    stageEyebrow = t('gameplay.gameComplete')
    stageTitle = t('gameplay.heroTitle.completed')
    stageLead = t('gameplay.gameCompleteBody')
    stageBody = (
      <div className="gameplay-stage-summary">
        <div className="gameplay-stage-focus-card">
          <span className="eyebrow">{t('common.finalResults')}</span>
          <strong>{t('gameplay.finalTieHint')}</strong>
          <p>{t('gameplay.heroLead.completed')}</p>
        </div>
      </div>
    )
  } else if (room.phase === 'roundSummary') {
    stageEyebrow = t('gameplay.prepareNextRule')
    stageTitle = t('gameplay.heroTitle.roundSummary', { roundNumber: summaryRoundNumber ?? '—' })
    stageLead = t('gameplay.roundSummaryBody', { roundNumber: summaryRoundNumber ?? '—' })
    stageBody = (
      <div className="gameplay-stage-summary">
        <div className="gameplay-stage-focus-card">
          <span className="eyebrow">{t('common.nextRound')}</span>
          <strong>{upcomingRuleCopy?.title ?? t('gameplay.waitingNextRound')}</strong>
          <p>{upcomingRuleCopy?.description ?? t('gameplay.roundCompleteReview', { roundNumber: summaryRoundNumber ?? '—' })}</p>
        </div>
        {isHost ? (
          <div className="gameplay-inline-actions gameplay-stage-actions">
            <button className="button button-primary" type="button" disabled={isContinuingRound} onClick={() => void onContinueRound()}>
              {isContinuingRound ? t('gameplay.startingNextRound') : t('gameplay.startNextRound')}
            </button>
          </div>
        ) : (
          <p className="status-note gameplay-stage-note">{t('gameplay.onlyHostControls')}</p>
        )}
      </div>
    )
  } else if (isAwaitingTurnStart) {
    stageEyebrow = t('common.nextTurn')
    stageTitle =
      isCurrentPlayerExplainer
        ? t('gameplay.heroTitle.currentPlayerNext')
        : t('gameplay.heroTitle.nextExplainer', { explainerName })
    stageLead =
      isCurrentPlayerExplainer
        ? t('gameplay.heroLead.currentPlayerNext', { guesserName })
        : t('gameplay.heroLead.nextPlayers', { explainerName, guesserName })
    stageBody = isCurrentPlayerExplainer ? (
      <div className="gameplay-stage-word-layout gameplay-stage-word-layout-explainer">
        <div className="gameplay-stage-target-card">
          <span className="eyebrow">{t('common.guesser')}</span>
          <strong>{guesserName}</strong>
          <p>{t('gameplay.explainerTargetHint')}</p>
        </div>
        <div className="gameplay-stage-word-frame gameplay-stage-word-frame-ready">
          <div className="gameplay-stage-timer gameplay-stage-timer-ready">
            <span>{t('common.timer')}</span>
            <strong>{t('common.secondsShort', { count: room.settings.turnDurationSeconds })}</strong>
          </div>
          <span className="eyebrow">{t('common.nextTurn')}</span>
          <p className="gameplay-stage-ready-title">{t('gameplay.nextTurnReady')}</p>
          <p className="gameplay-stage-ready-body">{t('gameplay.startTimerManually')}</p>
        </div>
        <div className="gameplay-stage-support">
          <span className="status-pill">{roundCopy?.title ?? t('gameplay.roundRuleFallback')}</span>
          <p className="status-note gameplay-stage-note">{t('gameplay.heroLead.currentPlayerNext', { guesserName })}</p>
        </div>
        <div className="gameplay-inline-actions gameplay-stage-actions">
          <button className="button button-primary" type="button" disabled={isStartingTurn} onClick={() => void onStartTurn()}>
            {isStartingTurn ? t('gameplay.startingTurn') : t('gameplay.startTurn')}
          </button>
        </div>
      </div>
    ) : (
      <div className="gameplay-stage-summary">
        <div className="gameplay-stage-focus-card gameplay-stage-matchup-card">
          <span className="eyebrow">{t('common.nextTurn')}</span>
          <strong>{t('gameplay.nextTurnPlayers', { explainerName, guesserName })}</strong>
          <p>{roundCopy?.description ?? t('gameplay.startTimerManually')}</p>
        </div>
        <p className="status-note gameplay-stage-note">{t('gameplay.waitingForExplainer', { explainerName })}</p>
      </div>
    )
  } else if (waitingForReconnect) {
    stageEyebrow = t('common.waiting')
    stageTitle = t('gameplay.heroTitle.waitingReconnect')
    stageLead = t('gameplay.heroLead.waitingReconnect')
    stageBody = (
      <div className="gameplay-stage-summary">
        <div className="gameplay-stage-focus-card">
          <span className="eyebrow">{t('common.activePlayers')}</span>
          <strong>{activePlayers.length}</strong>
          <p>{t('gameplay.clearedTurnWaitingReconnect')}</p>
        </div>
      </div>
    )
  } else if (room.phase === 'inProgress' || room.phase === 'paused') {
    if (isCurrentPlayerExplainer) {
      stageEyebrow = t('common.explainer')
      stageTitle = t('gameplay.heroTitle.currentPlayerExplain')
      stageLead = t('gameplay.wordFocusHint', { guesserName })
      stageBody = (
        <div className="gameplay-stage-word-layout gameplay-stage-word-layout-explainer">
          <div className="gameplay-stage-target-card">
            <span className="eyebrow">{t('common.guesser')}</span>
            <strong>{guesserName}</strong>
            <p>{t('gameplay.explainerTargetHint')}</p>
          </div>
          <div className="gameplay-stage-word-frame">
            <div className={`gameplay-stage-timer ${timerToneClass}`}>
              <span>{t('common.timer')}</span>
              <strong>{liveRemainingSeconds === null ? '—' : t('common.secondsShort', { count: liveRemainingSeconds })}</strong>
            </div>
            <span className="eyebrow">{t('gameplay.wordFocusLabel')}</span>
            <p className="active-word">{gameplayView?.activeWord ?? t('common.loadingWord')}</p>
          </div>
          <div className="gameplay-stage-support">
            <span className="status-pill">{t('gameplay.onlyExplainerSeesWord')}</span>
            {room.phase === 'paused' ? <span className="status-pill warning">{t('gameplay.timerPaused')}</span> : null}
            {isInterruptedTurn ? <p className="status-note gameplay-stage-note">{t('gameplay.interruptedTurnHint')}</p> : null}
          </div>
          <div className="gameplay-inline-actions gameplay-stage-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={room.phase !== 'inProgress' || isConfirmingGuess || !gameplayView?.activeWord}
              onClick={() => void onConfirmGuess()}
            >
              {isConfirmingGuess ? t('gameplay.confirmingGuess') : t('gameplay.confirmGuessedWord')}
            </button>
            {canEndInterruptedTurn ? (
              <button className="button button-secondary" type="button" disabled={isEndingTurn} onClick={() => void onEndTurn()}>
                {isEndingTurn ? t('gameplay.endingTurn') : t('gameplay.endTurn')}
              </button>
            ) : null}
          </div>
        </div>
      )
    } else if (isCurrentPlayerGuesser) {
      stageEyebrow = t('common.guesser')
      stageTitle = t('gameplay.guesserStageTitle')
      stageLead = t('gameplay.guesserStageLead', { explainerName })
      stageBody = (
        <div className="gameplay-stage-summary">
          <div className="gameplay-stage-focus-card gameplay-stage-focus-card-plain">
            <div className={`gameplay-stage-timer ${timerToneClass}`}>
              <span>{t('common.timer')}</span>
              <strong>{liveRemainingSeconds === null ? '—' : t('common.secondsShort', { count: liveRemainingSeconds })}</strong>
            </div>
            <div className="gameplay-stage-target-inline">
              <span className="eyebrow">{t('common.explainer')}</span>
              <strong>{explainerName}</strong>
            </div>
            <span className="status-pill">{t('gameplay.youAreGuessing')}</span>
            <p>{t('gameplay.hiddenWordHint')}</p>
          </div>
          {isInterruptedTurn ? <p className="status-note gameplay-stage-note">{t('gameplay.interruptedObserverHint')}</p> : null}
        </div>
      )
    } else {
      stageEyebrow = t('common.observerView')
      stageTitle = t('gameplay.observerStageTitle')
      stageLead = t('gameplay.observerStageLead', { explainerName, guesserName })
      stageBody = (
        <div className="gameplay-stage-summary">
          <div className="gameplay-stage-focus-card gameplay-stage-focus-card-plain">
            <div className={`gameplay-stage-timer ${timerToneClass}`}>
              <span>{t('common.timer')}</span>
              <strong>{liveRemainingSeconds === null ? '—' : t('common.secondsShort', { count: liveRemainingSeconds })}</strong>
            </div>
            <div className="gameplay-stage-target-inline gameplay-stage-target-inline-dual">
              <div>
                <span className="eyebrow">{t('common.explainer')}</span>
                <strong>{explainerName}</strong>
              </div>
              <div>
                <span className="eyebrow">{t('common.guesser')}</span>
                <strong>{guesserName}</strong>
              </div>
            </div>
            <span className="status-pill">{t('common.observerView')}</span>
            <p>{t('gameplay.hiddenWordHint')}</p>
          </div>
          {isInterruptedTurn ? <p className="status-note gameplay-stage-note">{t('gameplay.interruptedObserverHint')}</p> : null}
        </div>
      )
    }
  }

  const detailsPanel =
    detailTab === 'scores' ? (
      <article className="panel gameplay-detail-panel gameplay-detail-panel-scores">
        <div className="gameplay-detail-header">
          <div>
            <p className="eyebrow">{t('common.scoreboard')}</p>
            <h2>{room.phase === 'completed' ? t('common.finalRanking') : t('common.scoreboard')}</h2>
          </div>
        </div>
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

        {(room.phase === 'roundSummary' || room.phase === 'completed') && summaryRoundNumber ? (
          <div className="gameplay-detail-card">
            <span className="eyebrow">
              {room.phase === 'completed' ? t('gameplay.gameComplete') : t('gameplay.phase.roundComplete', { roundNumber: summaryRoundNumber })}
            </span>
            <strong>
              {room.phase === 'completed'
                ? t('gameplay.gameComplete')
                : t('gameplay.phase.roundComplete', { roundNumber: summaryRoundNumber })}
            </strong>
            <p>
              {room.phase === 'completed'
                ? t('gameplay.gameCompleteBody')
                : t('gameplay.roundSummaryBody', { roundNumber: summaryRoundNumber })}
            </p>
          </div>
        ) : null}
      </article>
    ) : (
      <article className="panel gameplay-detail-panel">
        <div className="gameplay-detail-header">
          <div>
            <p className="eyebrow">{t('common.details')}</p>
            <h2>{t('gameplay.detailsTitle')}</h2>
          </div>
        </div>

        <div className="gameplay-detail-grid">
          <section className="gameplay-detail-card">
            <span className="eyebrow">{t('gameplay.detailsTurnOverview')}</span>
            {currentTurn ? (
              <dl className="summary-list gameplay-turn-summary">
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
            ) : (
              <p>{room.phase === 'roundSummary' ? t('gameplay.waitingNextRound') : t('gameplay.noActiveTurn')}</p>
            )}
          </section>

          <section className="gameplay-detail-card">
            <span className="eyebrow">{t('common.roundRule')}</span>
            <strong>{roundCopy?.title ?? t('gameplay.roundRuleFallback')}</strong>
            <p>{roundCopy?.description ?? t('gameplay.roundRuleFallback')}</p>
          </section>

          <section className="gameplay-detail-card">
            <span className="eyebrow">{t('common.hostControls')}</span>
            {isHost ? (
              <div className="gameplay-inline-actions">
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
              <p>{t('gameplay.onlyHostControls')}</p>
            )}
          </section>

          <details className="gameplay-share-card gameplay-detail-card">
            <summary>{t('gameplay.inviteTitle')}</summary>
            <p className="status-note">{t('gameplay.shareHint')}</p>
            <p className="invite-code">{room.inviteCode}</p>
            <a className="invite-link" href={inviteLink}>
              {inviteLink}
            </a>
            <div className="invite-actions">
              <button className="button button-secondary" type="button" onClick={onCopyInviteLink}>
                {t('common.copyInviteLink')}
              </button>
              {copyState === 'copied' ? <span className="status-pill success">{t('common.copied')}</span> : null}
              {copyState === 'failed' ? <span className="status-pill error">{t('common.copyFailed')}</span> : null}
            </div>
          </details>

          <details className="gameplay-navigation-card gameplay-detail-card">
            <summary>{t('gameplay.navigationTitle')}</summary>
            <p className="status-note">{t('gameplay.navigationHint')}</p>
            <div className="gameplay-inline-actions gameplay-navigation-actions">
              <button className="button button-secondary" type="button" onClick={onGoHome}>
                {t('common.home')}
              </button>
              <button className="button button-secondary" type="button" onClick={onCreateRoom}>
                {t('common.newRoom')}
              </button>
            </div>
          </details>
        </div>
      </article>
    )

  return (
    <main className="app-shell gameplay-shell gameplay-shell-focused">
      {isFocusPhase ? (
        <section className="gameplay-focus-topbar" aria-label={t('gameplay.statusAriaLabel')}>
          <span className="status-pill">{roundCopy?.title ?? t('common.gameplay')}</span>
          <span className={`status-pill ${room.phase === 'paused' ? 'warning' : ''}`}>{phaseLabel}</span>
          <span className="status-note">{getRealtimeStatusMessage(realtimeSyncState, isRefreshing, t)}</span>
        </section>
      ) : (
        <>
          <section className="page-header gameplay-page-header">
            <div>
              <p className="eyebrow">{t('common.gameplay')}</p>
              <h1>{t('gameplay.title')}</h1>
            </div>
            <div className="gameplay-page-actions">
              <button className="button button-secondary" type="button" onClick={onGoHome}>
                {t('common.home')}
              </button>
              <button className="button button-secondary" type="button" onClick={onCreateRoom}>
                {t('common.newRoom')}
              </button>
            </div>
          </section>

          <section className="gameplay-hud" aria-label={t('gameplay.statusAriaLabel')}>
            <div className="hero-stat">
              <span>{t('gameplay.statusAriaLabel')}</span>
              <strong>{phaseLabel}</strong>
            </div>
            <div className="hero-stat gameplay-hud-timer">
              <span>{t('common.timer')}</span>
              <strong>{liveRemainingSeconds === null ? '—' : t('common.secondsShort', { count: liveRemainingSeconds })}</strong>
            </div>
            <div className="hero-stat">
              <span>{t('common.round')}</span>
              <strong>{room.currentRoundNumber ?? '—'}</strong>
            </div>
            <div className="hero-stat">
              <span>{t('common.activePlayers')}</span>
              <strong>{activePlayers.length}</strong>
            </div>
          </section>

          <section className="lobby-status-row gameplay-status-row">
            <span className="status-note">{getRealtimeStatusMessage(realtimeSyncState, isRefreshing, t)}</span>
            {currentPlayer ? <span className="status-note">{t('lobby.youAre', { displayName: currentPlayer.displayName })}</span> : null}
          </section>
        </>
      )}

      {syncError ? <p className="banner banner-error">{syncError}</p> : null}
      {actionError ? <p className="banner banner-error">{actionError}</p> : null}

      <section className={`panel gameplay-stage ${isCurrentPlayerExplainer ? 'gameplay-stage-explainer' : ''}`}>
        <div className="gameplay-stage-header">
          <div className="gameplay-stage-copy">
            <p className="eyebrow">{stageEyebrow}</p>
            <h2>{stageTitle}</h2>
            <p className="lead gameplay-stage-lead">{stageLead}</p>
          </div>
          <div className="gameplay-stage-badges">
            <span className={`status-pill ${room.phase === 'paused' ? 'warning' : ''}`}>{phaseLabel}</span>
            {isCurrentPlayerExplainer ? <span className="status-pill">{t('common.explainer')}</span> : null}
            {isCurrentPlayerGuesser ? <span className="status-pill">{t('common.guesser')}</span> : null}
            {isCurrentPlayerObserver ? <span className="status-pill">{t('common.observerView')}</span> : null}
          </div>
        </div>

        {stageBody}
      </section>

      <section className="gameplay-detail-tabs" aria-label={t('gameplay.detailsTabsAriaLabel')}>
        <button
          className={`button ${secondaryPanelOpen && detailTab === 'details' ? 'button-primary' : 'button-secondary'}`}
          type="button"
          aria-pressed={secondaryPanelOpen && detailTab === 'details'}
          onClick={() => {
            if (secondaryPanelOpen && detailTab === 'details') {
              setIsSecondaryPanelOpen(false)
              return
            }

            setDetailTab('details')
            setIsSecondaryPanelOpen(true)
          }}
        >
          {isFocusPhase ? t('gameplay.showDetailsPanel') : t('common.details')}
        </button>
        <button
          className={`button ${secondaryPanelOpen && detailTab === 'scores' ? 'button-primary' : 'button-secondary'}`}
          type="button"
          aria-pressed={secondaryPanelOpen && detailTab === 'scores'}
          onClick={() => {
            if (secondaryPanelOpen && detailTab === 'scores') {
              setIsSecondaryPanelOpen(false)
              return
            }

            setDetailTab('scores')
            setIsSecondaryPanelOpen(true)
          }}
        >
          {isFocusPhase ? t('gameplay.showScoresPanel') : t('common.scoreboard')}
        </button>
      </section>

      {secondaryPanelOpen ? detailsPanel : null}
    </main>
  )
}
