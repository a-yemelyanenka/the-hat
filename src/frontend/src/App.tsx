import './App.css'

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">The Hat</p>
        <h1>Multiplayer party game foundation</h1>
        <p className="lead">
          React frontend, .NET backend, and room for shared contracts. This
          starter gives the project a clean base for the upcoming gameplay and
          realtime issues.
        </p>
      </section>

      <section className="card-grid" aria-label="Project areas">
        <article className="card">
          <h2>Backend</h2>
          <p>ASP.NET Core API project in <code>src/backend</code>.</p>
        </article>
        <article className="card">
          <h2>Frontend</h2>
          <p>React + TypeScript app in <code>src/frontend</code>.</p>
        </article>
        <article className="card">
          <h2>Shared</h2>
          <p>Reserved space for contracts shared across the stack.</p>
        </article>
      </section>

      <section className="next-steps">
        <h2>Next steps</h2>
        <ol>
          <li>Define shared contracts.</li>
          <li>Build room creation and lobby flows.</li>
          <li>Add realtime synchronization and gameplay logic.</li>
        </ol>
      </section>
    </main>
  )
}

export default App
