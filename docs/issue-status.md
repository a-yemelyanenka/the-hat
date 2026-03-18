# The Hat — Issue Status Tracker

This file tracks implementation progress for the backlog defined in [docs/features.md](docs/features.md).

## Status legend
- [ ] Not started
- [~] In progress
- [x] Done
- [-] Deferred / Post-MVP

## How to use
- Update the status marker for an issue when work starts or finishes.
- Optionally add links to pull requests, commits, or notes.
- Keep issue numbering aligned with [docs/features.md](docs/features.md).

---

## Epic 1: Project foundation
- [x] Issue 1 — Initialize solution structure for .NET backend and React frontend
- [x] Issue 2 — Add Docker-based local development setup
- [x] Issue 3 — Define shared domain model and API contracts
- [x] Issue 4 — Choose and implement persistence strategy for rooms and game state
- [x] Issue 5 — Add backend test project for game rules and room state transitions

## Epic 2: Room creation and lobby
- [x] Issue 6 — Implement room creation API
- [x] Issue 7 — Build create-room screen in React
- [x] Issue 8 — Implement join-room flow with display name entry
- [x] Issue 9 — Build live lobby screen with player list and readiness state
- [x] Issue 10 — Implement host editing of room settings after players join
- [x] Issue 11 — Implement player ordering management
- [x] Issue 12 — Prevent game start until all word submissions are complete

## Epic 3: Word submission
- [ ] Issue 13 — Implement word submission API and storage
- [ ] Issue 14 — Build word entry UX for players
- [ ] Issue 15 — Hide submitted words from gameplay views

## Epic 4: Real-time room and session management
- [ ] Issue 16 — Implement real-time messaging for lobby and gameplay state
- [ ] Issue 17 — Implement rejoin and session recovery by display name
- [ ] Issue 18 — Handle player leave/disconnect state mid-game

## Epic 5: Game engine and rules
- [ ] Issue 19 — Implement game state machine for rounds, turns, and room phases
- [ ] Issue 20 — Implement turn rotation based on ordered player ring
- [ ] Issue 21 — Implement round-specific rule enforcement
- [ ] Issue 22 — Implement word draw, guess confirmation, and no-skip rule
- [ ] Issue 23 — Implement turn timer and timeout behavior
- [ ] Issue 24 — Implement reshuffle logic for each round
- [ ] Issue 25 — Implement end-of-round and final scoring summary
- [ ] Issue 26 — Implement host pause/resume controls

## Epic 6: Gameplay UI
- [ ] Issue 27 — Build active turn screen for explainer and observers
- [ ] Issue 28 — Build score and turn-status panels for all players
- [ ] Issue 29 — Build round transition and summary screens

## Epic 7: Internationalization and usability
- [ ] Issue 30 — Add internationalization framework to frontend
- [ ] Issue 31 — Externalize backend/user-facing game messages for i18n support
- [ ] Issue 32 — Improve responsive UX for mobile-first gameplay

## Epic 8: Release readiness
- [ ] Issue 33 — Add error handling and recovery UX for failed realtime/API actions
- [ ] Issue 34 — Add basic telemetry/logging for room lifecycle and gameplay failures
- [ ] Issue 35 — Create manual QA checklist for MVP gameplay flows

---

## Optional notes
| Issue | Status | Notes | Links |
| --- | --- | --- | --- |
| 1 | Done | Solution, backend, frontend, shared folder, README, and env examples added. |  |
| 2 | Done | Added multi-stage Dockerfiles, root compose setup, env example, backend `/health`, and container health checks. |  |
| 3 | Done | Added documented domain model plus backend/frontend room, lobby, gameplay DTOs and events. |  |
| 4 | Done | Implemented SQLite-backed room store with persisted room snapshots and startup database initialization. |  |
| 5 | Done | Added backend xUnit test project covering scoring, round flow, timer expiry, duplicate words, inactive players, rejoin matching, and persistence restore. |  |
| 6 | Done | Added `POST /api/rooms` with room persistence, invite-link generation, and validation for initial lobby settings. |  |
| 7 | Done | Added a responsive create-room flow with form validation, backend integration, and host routing into a simple lobby screen. |  |
| 8 | Done | Added invite-link join routing, join-room API validation, and lobby snapshots that include the host plus newly joined players. |  |
| 9 | Done | Added a polling-based live lobby view with player list, host/current badges, submission progress, and readiness messaging. |  |
| 10 | Done | Added lobby settings fetch/update APIs plus host controls to change words per player, turn timer, and order mode after players join. |  |
| 11 | Done | Added persisted player-order management for random and manual modes, including host move-up/move-down controls and turn-order consistency coverage. |  |
| 12 | Done | Added backend start-game validation that blocks incomplete submissions and surfaces blocking reasons directly in the lobby UI. |  |
| 13 | Not started |  |  |
| 14 | Not started |  |  |
| 15 | Not started |  |  |
| 16 | Not started |  |  |
| 17 | Not started |  |  |
| 18 | Not started |  |  |
| 19 | Not started |  |  |
| 20 | Not started |  |  |
| 21 | Not started |  |  |
| 22 | Not started |  |  |
| 23 | Not started |  |  |
| 24 | Not started |  |  |
| 25 | Not started |  |  |
| 26 | Not started |  |  |
| 27 | Not started |  |  |
| 28 | Not started |  |  |
| 29 | Not started |  |  |
| 30 | Not started |  |  |
| 31 | Not started |  |  |
| 32 | Not started |  |  |
| 33 | Not started |  |  |
| 34 | Not started |  |  |
| 35 | Not started |  |  |
