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
  isConfirmingGuess: boolean
  isPausingGame: boolean
  isResumingGame: boolean
  isContinuingRound: boolean
  actionError: string
  onConfirmGuess: () => Promise<void>
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

const roundRuleCopy: Record<RoundRule, { title: string; description: string }> = {
  explainNoSynonyms: {
    title: 'Round 1 · Explain normally',
    description: 'Use normal clues, but do not use synonyms.',
  },
  gesturesOnly: {
    title: 'Round 2 · Gestures only',
    description: 'Act it out without speaking.',
  },
  oneWordOnly: {
    title: 'Round 3 · One word only',
    description: 'Use exactly one word and avoid synonyms.',
  },
}

function getRealtimeStatusMessage(realtimeSyncState: RealtimeSyncState, isRefreshing: boolean): string {
  if (realtimeSyncState === 'connected') {
    return 'Live updates connected'
  }

  if (realtimeSyncState === 'connecting') {
    return 'Connecting live updates…'
  }

  if (realtimeSyncState === 'reconnecting') {
    return 'Reconnecting live updates…'
  }

  return isRefreshing ? 'Refreshing gameplay…' : 'Realtime unavailable, refreshing periodically'
}

function getRoundCopy(rule: RoundRule | null | undefined): { title: string; description: string } | null {
  if (!rule) {
    return null
  }

  return roundRuleCopy[rule]
}

function getUpcomingRuleCopy(roundNumber: number | null | undefined): { title: string; description: string } | null {
  if (!roundNumber || roundNumber >= 3) {
    return null
  }

  const nextRule = roundNumber === 1 ? 'gesturesOnly' : 'oneWordOnly'
  return roundRuleCopy[nextRule]
}

function getPlayerName(players: PlayerDto[], playerId: string | null | undefined): string {
  if (!playerId) {
    return '—'
  }

  return players.find((player) => player.playerId === playerId)?.displayName ?? 'Unknown player'
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

export function GameplayPage({
  session,
  gameplayView,
  syncError,
  realtimeSyncState,
  isRefreshing,
  isConfirmingGuess,
  isPausingGame,
  isResumingGame,
  isContinuingRound,
  actionError,
  onConfirmGuess,
  onPauseGame,
  onResumeGame,
  onContinueRound,
  onCreateRoom,
  copyState,
  inviteLink,
  onCopyInviteLink,
}: GameplayPageProps) {
  const room = session?.room ?? null
  const currentPlayerId = session?.currentPlayerId ?? ''

  if (!room) {
    return (
      <main className="app-shell app-shell-narrow">
        <section className="panel empty-state">
          <p className="eyebrow">Gameplay</p>
          <h1>Room data is not available in this session</h1>
          <p className="lead">Create a new room or reopen the invite link to continue.</p>
          <button className="button button-primary" type="button" onClick={onCreateRoom}>
            Create another room
          </button>
        </section>
      </main>
    )
  }

  const currentPlayer = room.players.find((player) => player.playerId === currentPlayerId) ?? null
  const currentRound = room.rounds.find((round) => round.roundNumber === room.currentRoundNumber) ?? null
  const currentRule = gameplayView?.currentRule ?? currentRound?.rule ?? null
  const roundCopy = getRoundCopy(currentRule)
  const currentTurn = room.currentTurn
  const isHost = currentPlayerId === room.hostPlayerId
  const rankedPlayers = rankPlayers(room.players)
  const summaryRoundNumber = room.phase === 'roundSummary' || room.phase === 'completed' ? room.currentRoundNumber : null
  const upcomingRuleCopy = getUpcomingRuleCopy(summaryRoundNumber)
  const activePlayers = room.players.filter((player) => player.isActive)
  const waitingForReconnect = room.phase === 'paused' && !currentTurn && activePlayers.length < 2
  const explainerName = getPlayerName(room.players, currentTurn?.explainerPlayerId)
  const guesserName = getPlayerName(room.players, currentTurn?.guesserPlayerId)
  const phaseLabel =
    room.phase === 'inProgress'
      ? 'Turn in progress'
      : room.phase === 'paused'
        ? 'Game paused'
        : room.phase === 'roundSummary'
          ? `Round ${summaryRoundNumber ?? '—'} complete`
          : 'Final results'

  return (
    <main className="app-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Gameplay</p>
          <h1>The round is live</h1>
          <p className="lead">The backend now drives rounds, turns, timer expiry, pause and resume, and round summaries.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={onCreateRoom}>
          New room
        </button>
      </section>

      <section className="lobby-status-row gameplay-status-row" aria-label="Gameplay status">
        <span className={`status-pill ${room.phase === 'completed' ? 'success' : room.phase === 'paused' ? 'warning' : ''}`}>
          {phaseLabel}
        </span>
        <span className="status-note">{getRealtimeStatusMessage(realtimeSyncState, isRefreshing)}</span>
        {currentPlayer ? <span className="status-note">You are {currentPlayer.displayName}</span> : null}
      </section>

      {syncError ? <p className="banner banner-error">{syncError}</p> : null}
      {actionError ? <p className="banner banner-error">{actionError}</p> : null}

      <section className="gameplay-grid">
        <article className="panel gameplay-panel gameplay-hero-panel">
          <div className="gameplay-hero-copy">
            <p className="eyebrow">{roundCopy?.title ?? 'Gameplay status'}</p>
            <h2>
              {room.phase === 'completed'
                ? 'Final results are ready'
                : room.phase === 'roundSummary'
                  ? `Round ${summaryRoundNumber ?? '—'} complete`
                  : waitingForReconnect
                    ? 'Waiting for another player to reconnect'
                    : gameplayView?.isCurrentPlayerExplainer
                      ? 'Your turn to explain'
                      : gameplayView?.isCurrentPlayerGuesser
                        ? 'Your turn to guess'
                        : 'Watch the current turn'}
            </h2>
            <p className="lead gameplay-hero-lead">
              {room.phase === 'completed'
                ? 'Review the final ranking and start a fresh room when everyone is ready.'
                : room.phase === 'roundSummary'
                  ? 'Scores are cumulative. The host can move everyone into the next round when ready.'
                  : waitingForReconnect
                    ? 'Gameplay is paused because fewer than two active players remain in the room.'
                    : roundCopy?.description ?? 'Live turn details stay in sync for every player.'}
            </p>
          </div>

          <div className="gameplay-hero-meta">
            <div className="hero-stat">
              <span>Round</span>
              <strong>{room.currentRoundNumber ?? '—'}</strong>
            </div>
            <div className="hero-stat">
              <span>Timer</span>
              <strong>{gameplayView?.remainingTurnSeconds ?? '—'}s</strong>
            </div>
            <div className="hero-stat">
              <span>Active players</span>
              <strong>{activePlayers.length}</strong>
            </div>
          </div>
        </article>

        <article className="panel gameplay-panel invite-panel">
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

        <article className="panel gameplay-panel">
          <h2>Round rule</h2>
          {roundCopy ? (
            <>
              <p className="gameplay-rule-title">{roundCopy.title}</p>
              <p>{roundCopy.description}</p>
            </>
          ) : (
            <p>The next round rule will appear here when gameplay starts.</p>
          )}
        </article>

        <article className="panel gameplay-panel">
          <h2>Turn status</h2>
          {currentTurn ? (
            <>
              <dl className="summary-list">
                <div>
                  <dt>Turn</dt>
                  <dd>{currentTurn.turnNumber}</dd>
                </div>
                <div>
                  <dt>Explainer</dt>
                  <dd>{explainerName}</dd>
                </div>
                <div>
                  <dt>Guesser</dt>
                  <dd>{guesserName}</dd>
                </div>
                <div>
                  <dt>Timer</dt>
                  <dd>{gameplayView?.remainingTurnSeconds ?? '—'} seconds left</dd>
                </div>
              </dl>

              <div className="turn-role-grid">
                <article className={`turn-role-card ${gameplayView?.isCurrentPlayerExplainer ? 'turn-role-card-active' : ''}`}>
                  <span className="eyebrow">Explainer</span>
                  <strong>{explainerName}</strong>
                  <p>{gameplayView?.isCurrentPlayerExplainer ? 'You can see the word and confirm each correct guess.' : 'This player sees the active word.'}</p>
                </article>

                <article className={`turn-role-card ${gameplayView?.isCurrentPlayerGuesser ? 'turn-role-card-active' : ''}`}>
                  <span className="eyebrow">Guesser</span>
                  <strong>{guesserName}</strong>
                  <p>{gameplayView?.isCurrentPlayerGuesser ? 'You are the guesser for this turn.' : 'This player is answering clues right now.'}</p>
                </article>
              </div>
            </>
          ) : room.phase === 'roundSummary' ? (
            <p>Waiting for the host to start the next round.</p>
          ) : waitingForReconnect ? (
            <p>The active turn was cleared because too few active players remain. Reconnect another player to continue.</p>
          ) : (
            <p>No active turn is running.</p>
          )}
        </article>

        <article className="panel gameplay-panel gameplay-word-panel">
          <h2>Current word</h2>
          {room.phase === 'inProgress' || room.phase === 'paused' ? (
            gameplayView?.isCurrentPlayerExplainer ? (
              <>
                <p className="active-word">{gameplayView.activeWord ?? 'Loading word…'}</p>
                <p className="status-note">Only the explainer can see the active word.</p>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={room.phase !== 'inProgress' || isConfirmingGuess || !gameplayView.activeWord}
                  onClick={() => void onConfirmGuess()}
                >
                  {isConfirmingGuess ? 'Confirming guess…' : 'Confirm guessed word'}
                </button>
              </>
            ) : (
              <>
                <p className="observer-copy">The current word stays hidden from observers and the guesser.</p>
                {gameplayView?.isCurrentPlayerGuesser ? <span className="status-pill">You are guessing this turn</span> : null}
                {!gameplayView?.isCurrentPlayerGuesser ? <span className="status-pill">Observer view</span> : null}
              </>
            )
          ) : room.phase === 'roundSummary' ? (
            <div className="round-transition-copy">
              <p>Round {summaryRoundNumber ?? '—'} is complete. Review scores and continue when ready.</p>
              {upcomingRuleCopy ? (
                <div className="transition-rule-card">
                  <span className="eyebrow">Next round</span>
                  <strong>{upcomingRuleCopy.title}</strong>
                  <p>{upcomingRuleCopy.description}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p>The game is complete. Final results are shown below.</p>
          )}
        </article>

        <article className="panel gameplay-panel">
          <h2>Host controls</h2>
          {isHost ? (
            <div className="host-actions">
              {room.phase === 'inProgress' ? (
                <button className="button button-secondary" type="button" disabled={isPausingGame} onClick={() => void onPauseGame()}>
                  {isPausingGame ? 'Pausing…' : 'Pause game'}
                </button>
              ) : null}

              {room.phase === 'paused' ? (
                <button className="button button-primary" type="button" disabled={isResumingGame} onClick={() => void onResumeGame()}>
                  {isResumingGame ? 'Resuming…' : 'Resume game'}
                </button>
              ) : null}

              {room.phase === 'roundSummary' ? (
                <button className="button button-primary" type="button" disabled={isContinuingRound} onClick={() => void onContinueRound()}>
                  {isContinuingRound ? 'Starting next round…' : 'Start next round'}
                </button>
              ) : null}

              {room.phase === 'completed' ? <p className="status-note">All three rounds are complete.</p> : null}
            </div>
          ) : (
            <p className="status-note">Only the host can pause, resume, or start the next round.</p>
          )}
        </article>

        <article className="panel gameplay-panel gameplay-scoreboard-panel">
          <h2>{room.phase === 'completed' ? 'Final ranking' : 'Scoreboard'}</h2>
          <ol className="scoreboard-list">
            {rankedPlayers.map(({ player, rank, isTied }) => (
              <li key={player.playerId} className={`scoreboard-row ${!player.isActive ? 'inactive-player' : ''}`}>
                <div>
                  <strong>
                    #{rank} · {player.displayName}
                  </strong>
                  <div className="player-badges">
                    {player.isHost ? <span className="status-pill">Host</span> : null}
                    {player.playerId === currentPlayerId ? <span className="status-pill">You</span> : null}
                    {!player.isActive ? <span className="status-pill error">Inactive</span> : null}
                    {isTied ? <span className="status-pill warning">Tie</span> : null}
                  </div>
                </div>
                <strong>{player.score} pts</strong>
              </li>
            ))}
          </ol>
        </article>

        {(room.phase === 'roundSummary' || room.phase === 'completed') && summaryRoundNumber ? (
          <article className="panel gameplay-panel gameplay-summary-panel">
            <h2>{room.phase === 'completed' ? 'Game complete' : `Round ${summaryRoundNumber} summary`}</h2>
            <p>
              {room.phase === 'completed'
                ? 'All rounds are finished. Rankings stay cumulative across the full game.'
                : `Scores above are cumulative after round ${summaryRoundNumber}. The next round reuses the same word pool with a fresh shuffle.`}
            </p>
            {room.phase === 'roundSummary' && upcomingRuleCopy ? (
              <div className="transition-rule-card">
                <span className="eyebrow">Prepare for the next rule</span>
                <strong>{upcomingRuleCopy.title}</strong>
                <p>{upcomingRuleCopy.description}</p>
              </div>
            ) : null}
            {room.phase === 'completed' ? (
              <p className="status-note">Ties stay grouped on the final ranking so the winner view is clear for everyone.</p>
            ) : null}
          </article>
        ) : null}
      </section>
    </main>
  )
}
