# The Hat — GitHub Issue Backlog

## Scope
This document contains a GitHub-ready MVP backlog for **The Hat**, implemented with **.NET + React**, using the clarified rules and defaults.

## Product assumptions
- No accounts; players join by invite link and enter a display name.
- Real-time synchronization is required.
- Platforms: mobile web + desktop web.
- Full i18n is planned.
- Expected room size: up to 20 players.
- No moderation in MVP.
- Rejoin is based on trimmed, case-insensitive player name.
- Host is also a normal player.
- Host can edit room settings after players join.
- Duplicate words are allowed.
- If timer expires mid-word, that word returns to the hat as unguessed.
- Player order can be either random or manually set by host.
- Submitted words are hidden during play.
- Host can start only when all required words are submitted.
- Explainer confirms correct guesses.
- Host can pause/resume the game.
- If a player leaves mid-game, they become inactive, keep prior score, and are skipped in future turns.

---

## Suggested labels
- `epic`
- `backend`
- `frontend`
- `fullstack`
- `infra`
- `realtime`
- `gameplay`
- `ux`
- `i18n`
- `testing`
- `bug`
- `enhancement`
- `priority:high`
- `priority:medium`
- `priority:low`
- `milestone:mvp-foundation`
- `milestone:mvp-lobby`
- `milestone:mvp-gameplay`
- `milestone:mvp-polish`

## Suggested milestones
1. **MVP Foundation**
2. **MVP Lobby & Room Setup**
3. **MVP Gameplay Core**
4. **MVP Polish & Release Readiness**

---

# Epic 1: Project foundation

## Issue 1 — Initialize solution structure for .NET backend and React frontend
**Labels:** `epic`, `fullstack`, `infra`, `priority:high`, `milestone:mvp-foundation`

**Description**
Set up the initial repository structure for a full-stack application using .NET for the backend and React for the frontend. Establish a clean folder layout for app code, shared contracts, and documentation.

**Acceptance criteria**
- Repository contains a backend application, frontend application, and shared docs structure.
- Local development can be started for backend and frontend independently.
- Base README explains project structure and local startup steps.
- Environment variable strategy is defined for local development.

**Notes**
Suggested structure:
- `/src/backend`
- `/src/frontend`
- `/docs`

---

## Issue 2 — Add Docker-based local development setup
**Labels:** `infra`, `priority:high`, `milestone:mvp-foundation`

**Description**
Create Docker configuration for local development and future self-hosted deployment. The setup should support the backend and any persistence layer selected for the MVP.

**Acceptance criteria**
- Repository includes `Dockerfile` files and a compose setup for local development.
- Application services can run in containers locally.
- Environment variables required by containers are documented.
- Basic health check strategy is defined.

---

## Issue 3 — Define shared domain model and API contracts
**Labels:** `backend`, `frontend`, `fullstack`, `priority:high`, `milestone:mvp-foundation`

**Description**
Define the core domain model and the contracts used between frontend and backend for rooms, players, settings, words, rounds, turns, scores, and reconnect behavior.

**Acceptance criteria**
- Domain entities are documented.
- DTOs/events for room, lobby, and gameplay flows are defined.
- Round, turn, and score rules are represented explicitly.
- Rejoin matching rules are documented: trim whitespace + case-insensitive name comparison.

---

## Issue 4 — Choose and implement persistence strategy for rooms and game state
**Labels:** `backend`, `priority:high`, `milestone:mvp-foundation`

**Description**
Implement persistence for room state, player state, word submissions, rounds, and scores. The chosen storage should support the MVP and self-hosted deployment.

**Acceptance criteria**
- Persistence approach is selected and documented.
- Room state survives backend restarts if intended by MVP design.
- Player, word, and score data can be stored and restored correctly.
- Data model supports inactive players and reconnect by player name.

**Notes**
A pragmatic MVP option would be PostgreSQL or SQL Server with a simple schema.

---

## Issue 5 — Add backend test project for game rules and room state transitions
**Labels:** `backend`, `testing`, `priority:high`, `milestone:mvp-foundation`

**Description**
Create automated tests for the core game engine and room state transitions so rule changes can be validated safely.

**Acceptance criteria**
- Test project exists and runs locally.
- Tests cover round transitions, scoring, timer-expiry behavior, and player order logic.
- Tests cover duplicate words being allowed.
- Tests cover inactive player skipping and reconnect matching rules.

---

# Epic 2: Room creation and lobby

## Issue 6 — Implement room creation API
**Labels:** `backend`, `gameplay`, `priority:high`, `milestone:mvp-lobby`

**Description**
Allow the host to create a room with configurable settings including number of words per player, turn timer, and player ordering mode.

**Acceptance criteria**
- Host can create a room.
- Room receives a unique room identifier and shareable invite token/link.
- Host can configure words per player.
- Host can configure turn timer.
- Host can choose random order or manual order mode.

---

## Issue 7 — Build create-room screen in React
**Labels:** `frontend`, `ux`, `priority:high`, `milestone:mvp-lobby`

**Description**
Create the UI for a host to create a room and define initial game settings.

**Acceptance criteria**
- User can open a create-room flow.
- Form validates required inputs.
- Successful room creation routes the host into the lobby.
- UI works on mobile and desktop screen sizes.

---

## Issue 8 — Implement join-room flow with display name entry
**Labels:** `fullstack`, `priority:high`, `milestone:mvp-lobby`

**Description**
Allow players to join a room from an invite link by entering a display name.

**Acceptance criteria**
- Invite link opens the room join flow.
- Player can enter a display name and join successfully.
- Join validation prevents ambiguous duplicates based on trimmed, case-insensitive comparison.
- Host is included as a player in the room.

---

## Issue 9 — Build live lobby screen with player list and readiness state
**Labels:** `frontend`, `realtime`, `ux`, `priority:high`, `milestone:mvp-lobby`

**Description**
Create the room lobby screen showing players, settings, submission progress, and readiness before the game starts.

**Acceptance criteria**
- Lobby updates in real time when players join or leave.
- Player list is visible to all connected users.
- Lobby shows submission progress per player.
- Host can see whether the room is ready to start.

---

## Issue 10 — Implement host editing of room settings after players join
**Labels:** `fullstack`, `gameplay`, `priority:medium`, `milestone:mvp-lobby`

**Description**
Allow the host to update room settings in the lobby after players have joined.

**Acceptance criteria**
- Host can edit words-per-player setting.
- Host can edit turn timer.
- Host can change player ordering mode before game start.
- Updated settings synchronize to all players in real time.
- Invalid changes are blocked or clearly explained.

---

## Issue 11 — Implement player ordering management
**Labels:** `fullstack`, `gameplay`, `priority:high`, `milestone:mvp-lobby`

**Description**
Support both random player order generation and manual host-defined player order.

**Acceptance criteria**
- Host can choose random ordering.
- Host can manually arrange players in a specific order.
- Final order is visible to all players before game start.
- Turn logic uses the stored order consistently.
- “Player on the left” is derived from this order cyclically.

---

## Issue 12 — Prevent game start until all word submissions are complete
**Labels:** `backend`, `frontend`, `priority:high`, `milestone:mvp-lobby`

**Description**
Enforce the rule that the host can start the game only after every active player has submitted the required number of words.

**Acceptance criteria**
- Backend rejects start requests if submissions are incomplete.
- Frontend shows why the game cannot be started yet.
- Submission progress is visible in the lobby.
- Inactive players are excluded only if they have already left before game start.

---

# Epic 3: Word submission

## Issue 13 — Implement word submission API and storage
**Labels:** `backend`, `gameplay`, `priority:high`, `milestone:mvp-lobby`

**Description**
Allow each player to submit the exact configured number of words for the game.

**Acceptance criteria**
- Active player can submit required words.
- Duplicate words are allowed.
- Submitted words are stored with room and player association.
- Submission can be edited until the host starts the game.

---

## Issue 14 — Build word entry UX for players
**Labels:** `frontend`, `ux`, `priority:high`, `milestone:mvp-lobby`

**Description**
Create a simple and fast UI for players to submit their words.

**Acceptance criteria**
- Player sees how many words are required and how many are left.
- Player can add, edit, and remove own words before game start.
- Validation handles empty or whitespace-only values.
- UI works well on mobile devices.

---

## Issue 15 — Hide submitted words from gameplay views
**Labels:** `backend`, `frontend`, `priority:medium`, `milestone:mvp-lobby`

**Description**
Ensure the game preserves secrecy around the word pool and does not reveal submitted words outside the entry context.

**Acceptance criteria**
- Players cannot browse the full submitted word list during gameplay.
- APIs only expose word content where required by active turn rules.
- Lobby screens do not leak word contents.

---

# Epic 4: Real-time room and session management

## Issue 16 — Implement real-time messaging for lobby and gameplay state
**Labels:** `backend`, `realtime`, `priority:high`, `milestone:mvp-gameplay`

**Description**
Implement real-time updates between clients and server for room membership, settings, submissions, turn changes, timer state, guesses, and score updates.

**Acceptance criteria**
- Clients receive room updates without manual refresh.
- Gameplay events propagate in near real time.
- Reconnect flow restores current room state.
- Real-time transport and fallback behavior are documented.

**Notes**
A likely fit on .NET is SignalR.

---

## Issue 17 — Implement rejoin and session recovery by display name
**Labels:** `backend`, `frontend`, `realtime`, `priority:high`, `milestone:mvp-gameplay`

**Description**
Allow a disconnected player to rejoin the same room by using the same trimmed, case-insensitive display name.

**Acceptance criteria**
- Refreshing or reconnecting can restore player presence.
- Name matching is case-insensitive and trims outer whitespace.
- Restored player regains the correct room role and status.
- Rejoin does not create duplicate player entries.

---

## Issue 18 — Handle player leave/disconnect state mid-game
**Labels:** `backend`, `gameplay`, `realtime`, `priority:medium`, `milestone:mvp-gameplay`

**Description**
When a player disconnects or leaves during gameplay, mark them inactive while preserving prior state.

**Acceptance criteria**
- Inactive players keep previously earned scores.
- Inactive players are skipped in future turn rotation.
- Room state updates in real time for all connected players.
- If the active turn is affected, the system resolves it predictably.

---

# Epic 5: Game engine and rules

## Issue 19 — Implement game state machine for rounds, turns, and room phases
**Labels:** `backend`, `gameplay`, `priority:high`, `milestone:mvp-gameplay`

**Description**
Create the backend game engine that manages lobby, round start, turn start, turn end, round end, and game end states.

**Acceptance criteria**
- Room phases are explicitly modeled.
- System supports 3 rounds using the same word pool reshuffled each round.
- Round ends when all words in that round are guessed.
- After round 3, the game enters final results state.

---

## Issue 20 — Implement turn rotation based on ordered player ring
**Labels:** `backend`, `gameplay`, `priority:high`, `milestone:mvp-gameplay`

**Description**
Use the configured player order to determine the current explainer and the guesser on the left.

**Acceptance criteria**
- Explainer role advances clockwise each turn.
- Guesser is always the next active player in the cyclic order.
- Inactive players are skipped.
- Rotation remains consistent across rounds.

---

## Issue 21 — Implement round-specific rule enforcement
**Labels:** `backend`, `gameplay`, `priority:high`, `milestone:mvp-gameplay`

**Description**
Encode the specific rule set for all three rounds.

**Acceptance criteria**
- Round 1 rule is defined as normal explanation with no synonyms.
- Round 2 rule is defined as gestures only with no speaking.
- Round 3 rule is defined as one word only with no synonyms.
- Frontend can display the active round rule clearly.

**Notes**
Behavioral enforcement of speech/gesture rules is social, but the system must display and track the correct rule.

---

## Issue 22 — Implement word draw, guess confirmation, and no-skip rule
**Labels:** `backend`, `gameplay`, `priority:high`, `milestone:mvp-gameplay`

**Description**
Implement the core in-turn word handling mechanics.

**Acceptance criteria**
- Active turn reveals one current word at a time to the explainer.
- No skip action is available.
- Explainer can confirm a successful guess.
- On confirmation, both explainer and guesser receive +1 point.
- Confirmed word is removed from the round pool only for the current round.

---

## Issue 23 — Implement turn timer and timeout behavior
**Labels:** `backend`, `frontend`, `gameplay`, `priority:high`, `milestone:mvp-gameplay`

**Description**
Implement countdown timing for turns and enforce timeout behavior.

**Acceptance criteria**
- Turn starts with configured countdown timer.
- Remaining time is synchronized to clients.
- If time expires mid-word, that word is returned to the virtual hat as unguessed.
- Turn ends automatically on timeout.

---

## Issue 24 — Implement reshuffle logic for each round
**Labels:** `backend`, `gameplay`, `priority:high`, `milestone:mvp-gameplay`

**Description**
At the start of each round, rebuild the round pool from the original submitted words and reshuffle it.

**Acceptance criteria**
- Same submitted word multiset is reused in rounds 1, 2, and 3.
- Word order is reshuffled at the beginning of each round.
- Previous round removals do not affect subsequent rounds.
- Duplicate words remain represented correctly.

---

## Issue 25 — Implement end-of-round and final scoring summary
**Labels:** `backend`, `frontend`, `gameplay`, `priority:medium`, `milestone:mvp-gameplay`

**Description**
Provide score summaries after each round and final results after round 3.

**Acceptance criteria**
- End-of-round summary shows updated cumulative scores.
- Final screen appears after round 3 completes.
- Final screen shows ranking and total points.
- Ties are displayed clearly.

---

## Issue 26 — Implement host pause/resume controls
**Labels:** `fullstack`, `gameplay`, `priority:medium`, `milestone:mvp-gameplay`

**Description**
Allow the host to pause and resume gameplay while preserving current turn state.

**Acceptance criteria**
- Host can pause an active turn.
- Timer stops while paused.
- Host can resume the paused turn.
- Pause state is visible to all players in real time.

---

# Epic 6: Gameplay UI

## Issue 27 — Build active turn screen for explainer and observers
**Labels:** `frontend`, `ux`, `priority:high`, `milestone:mvp-gameplay`

**Description**
Create the main gameplay screen showing the active round, timer, current roles, and the current word for the explainer.

**Acceptance criteria**
- Explainer sees the current word and confirmation control.
- Other players do not see the current word.
- UI shows current round, timer, explainer, and guesser.
- Layout is optimized for phone usage.

---

## Issue 28 — Build score and turn-status panels for all players
**Labels:** `frontend`, `ux`, `priority:medium`, `milestone:mvp-gameplay`

**Description**
Provide a lightweight scoreboard and turn-status UI visible during play.

**Acceptance criteria**
- All players can see cumulative scores.
- Current turn owner and guesser are visible.
- Inactive players are visibly distinguished.
- Updates happen in real time.

---

## Issue 29 — Build round transition and summary screens
**Labels:** `frontend`, `ux`, `priority:medium`, `milestone:mvp-gameplay`

**Description**
Add screens for round completion, next-round instructions, and game completion.

**Acceptance criteria**
- Round summary appears when all round words are guessed.
- Next-round screen clearly communicates the new rule.
- Final results screen appears after round 3.
- Host can continue flow where appropriate.

---

# Epic 7: Internationalization and usability

## Issue 30 — Add internationalization framework to frontend
**Labels:** `frontend`, `i18n`, `priority:medium`, `milestone:mvp-polish`

**Description**
Set up frontend internationalization support so the UI can support multiple languages.

**Acceptance criteria**
- Translation framework is integrated.
- UI strings are externalized.
- At least one non-default locale can be added without code changes to components.
- Language switching strategy is documented.

---

## Issue 31 — Externalize backend/user-facing game messages for i18n support
**Labels:** `backend`, `i18n`, `priority:medium`, `milestone:mvp-polish`

**Description**
Ensure server-originated messages and validation errors can support localization.

**Acceptance criteria**
- User-facing backend messages are externalized or mapped through translation keys.
- Validation and error messages can be localized.
- Contracts support message keys where needed.

---

## Issue 32 — Improve responsive UX for mobile-first gameplay
**Labels:** `frontend`, `ux`, `priority:medium`, `milestone:mvp-polish`

**Description**
Polish the app for mobile-first play sessions where users may be moving around and interacting quickly.

**Acceptance criteria**
- Primary gameplay actions are thumb-friendly.
- Important content remains usable on narrow screens.
- Screen transitions are clear and fast.
- Orientation changes do not break key views.

---

# Epic 8: Release readiness

## Issue 33 — Add error handling and recovery UX for failed realtime/API actions
**Labels:** `frontend`, `backend`, `priority:medium`, `milestone:mvp-polish`

**Description**
Provide user-visible recovery for network interruptions, stale room links, and server-side validation failures.

**Acceptance criteria**
- Failed API actions show understandable feedback.
- Lost real-time connection is surfaced clearly.
- App attempts reconnect where appropriate.
- Invalid or expired room links are handled gracefully.

---

## Issue 34 — Add basic telemetry/logging for room lifecycle and gameplay failures
**Labels:** `backend`, `priority:low`, `milestone:mvp-polish`

**Description**
Add minimal logging needed to debug room creation, joining, turn progression, and disconnect issues in a self-hosted environment.

**Acceptance criteria**
- Key room lifecycle events are logged.
- Gameplay state transition failures are logged.
- Reconnect/disconnect problems are traceable.
- Logging approach is documented.

---

## Issue 35 — Create manual QA checklist for MVP gameplay flows
**Labels:** `testing`, `priority:medium`, `milestone:mvp-polish`

**Description**
Document a manual test checklist covering the critical gameplay and lobby flows.

**Acceptance criteria**
- Checklist covers room creation, join, word entry, game start, all 3 rounds, timeout, pause/resume, reconnect, and final scoring.
- Checklist covers both mobile and desktop browsers.
- Checklist includes duplicate word scenarios and inactive-player scenarios.

---

# Epic 9: Frontend architecture refactoring

## Issue 36 — Quick wins: error boundary, countdown timer hook, memoization, and bug fixes
**Labels:** `frontend`, `enhancement`, `priority:high`, `milestone:mvp-polish`

**Description**
Address immediate performance issues, small bugs, and missing error resilience in the React frontend without changing overall component architecture.

**Acceptance criteria**
- An `ErrorBoundary` component wraps the app root and each page, preventing full-app crashes on render errors.
- A `useCountdownTimer(endsAtUtc, isPaused)` hook is extracted and used in `GameplayPage` so that the 1-second timer tick only re-renders the timer display, not the entire 700-line component.
- `rankPlayers()` result is memoized with `useMemo` in `GameplayPage`.
- Clipboard copy state auto-resets to `'idle'` after a short timeout (e.g. 2 seconds).
- `WordSubmissionPanel` uses stable keys (e.g. `crypto.randomUUID()` per draft entry) instead of index-based keys.
- The gameplay refresh `useEffect` uses an `AbortController` in its cleanup to cancel in-flight fetches.

**Notes**
No structural changes to component hierarchy or state management. Each fix is independently verifiable. This is the lowest-risk phase and should be completed first.

---

## Issue 37 — Extract custom hooks from App.tsx to reduce god-component complexity
**Labels:** `frontend`, `enhancement`, `priority:high`, `milestone:mvp-polish`

**Description**
Extract focused custom hooks from `App.tsx` (~980 lines) to separate routing, session persistence, and gameplay action dispatch from the component render logic.

**Acceptance criteria**
- A `useRouter` hook encapsulates `pushState`/`popstate` routing, `route` state, and `navigate()`.
- A `useRoomSession` hook encapsulates `roomSession` state, `sessionStorage` persistence, and `updateRoomSessionSnapshot`.
- A `useGameplayAction` generic hook replaces the 7 nearly-identical gameplay action handlers (`handleStartTurn`, `handleConfirmGuess`, `handleEndTurn`, `handlePauseGame`, `handleResumeGame`, `handleContinueRound`, `handleStartGame`).
- A `useClipboard` hook encapsulates copy-to-clipboard with auto-reset (if not already done in Issue 36).
- `App.tsx` drops below ~400 lines with no UI changes.
- All existing gameplay flows continue to work identically.

**Depends on:** Issue 36

---

## Issue 38 — Introduce RoomSessionContext to eliminate prop drilling
**Labels:** `frontend`, `enhancement`, `priority:medium`, `milestone:mvp-polish`

**Description**
Create a React context that provides room session state (current room snapshot, current player ID) to descendant components, removing the need to thread session-related props through multiple levels.

**Acceptance criteria**
- A `RoomSessionContext` is created with a provider wrapping the app.
- `LobbyPage`, `GameplayPage`, and `WordSubmissionPanel` consume session data from context instead of props.
- Props on `GameplayPage` drop from ~23 to ~12 or fewer.
- Props on `LobbyPage` drop from ~17 to ~10 or fewer.
- No UI changes.

**Depends on:** Issue 37

---

## Issue 39 — Extract realtime connection and gameplay sync into dedicated hooks
**Labels:** `frontend`, `realtime`, `enhancement`, `priority:medium`, `milestone:mvp-polish`

**Description**
Move the ~100-line SignalR realtime connection lifecycle and gameplay view fetching/turn-expiry scheduling out of `App.tsx` into focused, independently testable hooks.

**Acceptance criteria**
- A `useRoomRealtime` hook manages SignalR connection, reconnection, fallback polling, and event callbacks.
- A `useGameplaySync` hook manages gameplay view fetching, turn-expiry timeout scheduling, and refresh state.
- `App.tsx` drops to ~100 lines and serves as a thin route coordinator.
- Reconnection and fallback-to-polling behavior is preserved.
- Each hook is independently testable.

**Depends on:** Issue 38

---

## Issue 40 — Decompose GameplayPage into phase-specific stage components
**Labels:** `frontend`, `ux`, `enhancement`, `priority:medium`, `milestone:mvp-polish`

**Description**
Break the 716-line `GameplayPage` into focused sub-components for each game phase and player role, plus extracted panels for scoreboard and details.

**Acceptance criteria**
- Separate components exist for: `ExplainerStage`, `GuesserStage`, `ObserverStage`, `RoundSummaryStage`, `GameCompleteStage`, `AwaitingTurnStage`.
- `ScoreboardPanel` and `GameDetailsPanel` are extracted into their own files.
- `GameplayPage` becomes a ~80-line coordinator that selects the appropriate stage component.
- Each stage component is under ~100 lines.
- No visual or behavioral changes.

**Depends on:** Issue 39

---

## Issue 41 — Decompose LobbyPage into focused sub-components
**Labels:** `frontend`, `ux`, `enhancement`, `priority:low`, `milestone:mvp-polish`

**Description**
Extract the distinct sections of `LobbyPage` into dedicated components for better maintainability.

**Acceptance criteria**
- Separate components exist for: `LobbySettingsForm`, `PlayerList` (with reorder controls), `InvitePanel`, `ReadinessPanel`.
- `LobbyPage` becomes a thin coordinator.
- No visual or behavioral changes.

**Depends on:** Issue 38

---

## Issue 42 — Add frontend component tests
**Labels:** `frontend`, `testing`, `priority:medium`, `milestone:mvp-polish`

**Description**
Introduce a frontend test setup and add component-level tests for the extracted hooks and key UI components.

**Acceptance criteria**
- Vitest and React Testing Library are configured in the frontend project.
- Tests cover: `useCountdownTimer`, `useRouter`, `useRoomSession`, `useGameplayAction`, `useClipboard`.
- At least one integration-style test exists for `CreateRoomPage` and `JoinRoomPage` form submission flows.
- Tests run in CI alongside backend tests.
- Focus management on route change is verified for accessibility.

**Depends on:** Issue 40

---

# Suggested implementation order
1. Issue 1
2. Issue 3
3. Issue 4
4. Issue 5
5. Issue 6
6. Issue 8
7. Issue 9
8. Issue 11
9. Issue 13
10. Issue 12
11. Issue 16
12. Issue 17
13. Issue 19
14. Issue 20
15. Issue 22
16. Issue 23
17. Issue 24
18. Issue 21
19. Issue 25
20. Issue 27
21. Issue 28
22. Issue 29
23. Issue 10
24. Issue 14
25. Issue 15
26. Issue 26
27. Issue 30
28. Issue 31
29. Issue 32
30. Issue 33
31. Issue 34
32. Issue 35
33. Issue 2
34. Issue 7
35. Issue 36
36. Issue 37
37. Issue 38
38. Issue 39
39. Issue 40
40. Issue 41
41. Issue 42

---

# Suggested MVP cut line
If you want a tighter first playable release, the minimum recommended MVP subset is:
- 1, 3, 4, 5
- 6, 8, 9, 11, 12, 13, 14
- 16, 17, 19, 20, 22, 23, 24, 25
- 27, 28, 29
- 33, 35

Optional for post-MVP:
- 10, 15, 26, 30, 31, 32, 34

---

# Optional next step
This backlog can be converted into:
- one GitHub issue per item
- one GitHub epic per section
- a GitHub Projects board with status columns and priorities
