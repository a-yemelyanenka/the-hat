import type { CreateRoomResponseDto } from '../contracts/theHatContracts'
import type { CopyState } from '../appModels'
import './LobbyPage.css'

type LobbyPageProps = {
  room: CreateRoomResponseDto | null
  copyState: CopyState
  onCopyInviteLink: () => void
  onCreateRoom: () => void
}

export function LobbyPage({ room, copyState, onCopyInviteLink, onCreateRoom }: LobbyPageProps) {
  if (!room) {
    return (
      <main className="app-shell app-shell-narrow">
        <section className="panel empty-state">
          <p className="eyebrow">Lobby</p>
          <h1>Room data is not available in this session</h1>
          <p className="lead">
            Create a new room to continue. Full lobby loading from invite links comes in a later issue.
          </p>
          <button className="button button-primary" type="button" onClick={onCreateRoom}>
            Create another room
          </button>
        </section>
      </main>
    )
  }

  const hostPlayer = room.room.players.find((player) => player.playerId === room.room.hostPlayerId)

  return (
    <main className="app-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Lobby</p>
          <h1>Room ready for players</h1>
          <p className="lead">
            The room was created successfully and the host has been routed into the lobby.
          </p>
        </div>
        <button className="button button-secondary" type="button" onClick={onCreateRoom}>
          New room
        </button>
      </section>

      <section className="lobby-grid">
        <article className="panel invite-panel">
          <h2>Invite</h2>
          <p className="invite-code">{room.room.inviteCode}</p>
          <a className="invite-link" href={room.inviteLink}>
            {room.inviteLink}
          </a>
          <div className="invite-actions">
            <button className="button button-primary" type="button" onClick={onCopyInviteLink}>
              Copy invite link
            </button>
            {copyState === 'copied' ? <span className="status-pill success">Copied</span> : null}
            {copyState === 'failed' ? <span className="status-pill error">Copy failed</span> : null}
          </div>
        </article>

        <article className="panel">
          <h2>Room settings</h2>
          <dl className="summary-list">
            <div>
              <dt>Host</dt>
              <dd>{hostPlayer?.displayName ?? 'Host'}</dd>
            </div>
            <div>
              <dt>Words per player</dt>
              <dd>{room.room.settings.wordsPerPlayer}</dd>
            </div>
            <div>
              <dt>Turn timer</dt>
              <dd>{room.room.settings.turnDurationSeconds} seconds</dd>
            </div>
            <div>
              <dt>Order mode</dt>
              <dd>{room.room.settings.playerOrderMode === 'random' ? 'Random' : 'Manual'}</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <h2>Players</h2>
          <ul className="player-list">
            {room.room.players.map((player) => (
              <li key={player.playerId}>
                <span>{player.displayName}</span>
                {player.isHost ? <span className="status-pill">Host</span> : null}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  )
}
