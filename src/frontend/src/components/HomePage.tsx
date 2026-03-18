import './HomePage.css'

type HomePageProps = {
  onCreateRoom: () => void
}

export function HomePage({ onCreateRoom }: HomePageProps) {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">The Hat</p>
          <h1>Create a room and start the lobby</h1>
          <p className="lead">
            Set the host name, choose the initial game settings, and open the lobby
            in a flow that works on mobile and desktop.
          </p>
          <div className="hero-actions">
            <button className="button button-primary" type="button" onClick={onCreateRoom}>
              Create room
            </button>
          </div>
        </div>

        <aside className="panel summary-card" aria-label="Create room highlights">
          <h2>Included in this flow</h2>
          <ul className="feature-list">
            <li>Host display name entry</li>
            <li>Words-per-player and turn timer settings</li>
            <li>Random or manual player order mode</li>
            <li>Lobby routing after a successful API call</li>
          </ul>
        </aside>
      </section>
    </main>
  )
}
