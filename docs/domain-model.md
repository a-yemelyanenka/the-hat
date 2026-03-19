# The Hat — Domain model and contracts

This document defines the initial shared domain model, API contracts, and persistence decisions for issues 3 and 4.

## Persistence strategy

The MVP foundation uses **SQLite** as the room and game-state store.

### Why SQLite
- Simple local setup with no separate database container required.
- Works well for self-hosted single-instance deployments.
- Persists room state across backend restarts through a mounted database file.
- Lets the project move quickly before a higher-scale relational store is needed.

### Storage shape
- Backend persists one room document per room in a `Rooms` table.
- Each row stores:
  - stable room identity and invite code
  - current room phase
  - serialized room state payload including players, settings, words, rounds, turns, and scores
  - last-updated timestamp
- The serialized payload includes inactive players and normalized display names so reconnect and skip logic survive process restarts.

### Restart behavior
- MVP behavior is to **restore room state after backend restart** as long as the SQLite file is preserved.
- In Docker, the database file is stored in a named volume mounted at `/app/data`.

### Schema management
- SQLite schema changes are managed with **EF Core migrations**.
- Backend startup applies pending migrations automatically.
- Legacy local databases created before migrations existed should be deleted locally and recreated via migrations.

## Core domain entities

| Entity | Purpose | Key fields |
| --- | --- | --- |
| `RoomState` | Aggregate root for a room and active game | `roomId`, `inviteCode`, `hostPlayerId`, `phase`, `settings`, `players`, `words`, `rounds`, `currentRoundNumber`, `lastCompletedExplainerPlayerId`, `lastCompletedTurnNumber`, `currentTurn` |
| `RoomSettings` | Host-configurable rules | `wordsPerPlayer`, `turnDurationSeconds`, `playerOrderMode` |
| `PlayerState` | Player identity, seat, and score | `id`, `displayName`, `normalizedDisplayName`, `isHost`, `isActive`, `orderIndex`, `score` |
| `WordEntry` | Submitted word, including duplicates | `id`, `text`, `submittedByPlayerId` |
| `RoundState` | Per-round word order and completion status | `roundNumber`, `rule`, `remainingWordIds`, `guessedWordIds`, `isCompleted` |
| `TurnState` | Current explainer/guesser pair and active word | `turnNumber`, `explainerPlayerId`, `guesserPlayerId`, `activeWordId`, `durationSeconds`, `endsAtUtc`, pause/expiry timestamps |
| `PlayerGameplayState` | Player-specific gameplay projection for the active screen | `room`, `playerId`, `currentRule`, `activeWordText`, `remainingTurnSeconds`, role flags |

## Room phases and gameplay flow

- `Lobby`: players join, submit words, and the host can edit settings.
- `InProgress`: an active round and turn are running.
- `Paused`: the host has paused the active turn and the timer is frozen.
- `RoundSummary`: a round is complete and the host must explicitly continue to the next round.
- `Completed`: round 3 is finished and the final ranking is visible.

The backend now treats gameplay as an explicit state machine:
- start game → create round 1 → start turn 1 → auto-draw first word
- confirm guesses during a turn → score explainer and guesser → auto-draw the next word
- expire a turn → return the active word to the hat → rotate to the next explainer/guesser pair
- complete a round → enter `RoundSummary`
- continue from summary → reshuffle the original word multiset and start the next round
- complete round 3 → enter `Completed`

## Explicit game-rule representation

### Player order and turns
- Ordered seating is stored on each player with `orderIndex`.
- The explainer is the active turn owner.
- The guesser is the next active player in cyclic order.
- Inactive players remain in room history but are skipped when new turn pairs are calculated.
- SignalR room subscriptions reactivate returning players by `playerId`, and disconnects mark them inactive again.
- If the current explainer or guesser disconnects, the backend preserves the in-flight turn, keeps the active word assigned to that turn, and lets the explainer explicitly end the interrupted turn when needed.
- If fewer than two active players remain, gameplay moves into a paused waiting state until another player reconnects.

### Rounds
- Round 1 uses `ExplainNoSynonyms`.
- Round 2 uses `GesturesOnly`.
- Round 3 uses `OneWordOnly`.
- Each round reuses the same room word pool and reshuffles the word order.

### Scoring
- A correct guess gives `+1` to both the explainer and guesser.
- Scores are accumulated on `PlayerState.score`.

### Timer expiry
- If the timer expires with an active word in hand, that word is returned to the round queue as unguessed.
- The turn is completed and the next active explainer/guesser pair is selected.
- Turns store an absolute `endsAtUtc` deadline so every client can render the same countdown.
- When the host pauses the game, the remaining seconds are frozen on the turn until resume.

### Duplicate words
- Duplicate text is allowed.
- Every submitted word gets a unique `wordId`, so equal text values remain distinct entries.

### Reconnect matching
- Rejoin matching uses `trim()` plus case-insensitive comparison.
- Normalized player names are stored as `displayName.Trim().ToUpperInvariant()`.
- Persisted normalized names allow reconnect matching after restarts.

## Backend DTOs and events

Backend contract records live in [src/backend/Contracts/RoomContracts.cs](../src/backend/Contracts/RoomContracts.cs).

### Command/request DTOs
- `CreateRoomRequestDto`
- `JoinRoomRequestDto`
- `RejoinRoomRequestDto`
- `UpdateRoomSettingsRequestDto`
- `SubmitWordsRequestDto`
- `StartGameRequestDto`
- `ConfirmGuessRequestDto`
- `PauseGameRequestDto`
- `ResumeGameRequestDto`
- `ContinueRoundRequestDto`

### Snapshot/response DTOs
- `CreateRoomResponseDto`
- `RoomSnapshotDto`
- `RoomSettingsDto`
- `PlayerDto`
- `WordSubmissionDto`
- `RoundStateDto`
- `TurnStateDto`
- `GameplayViewDto`

### Realtime/domain events
- `PlayerJoinedEventDto`
- `PlayerRejoinedEventDto`
- `PlayerLeftEventDto`
- `RoomSettingsChangedEventDto`
- `WordSubmissionUpdatedEventDto`
- `GameStartedEventDto`
- `TurnStartedEventDto`
- `WordGuessedEventDto`
- `TurnExpiredEventDto`
- `RoundCompletedEventDto`
- `GameCompletedEventDto`

## Frontend contract mirror

The initial TypeScript mirror for these contracts lives in [src/frontend/src/contracts/theHatContracts.ts](../src/frontend/src/contracts/theHatContracts.ts).

This keeps room, lobby, and gameplay flows explicit on the frontend, with the current room and lobby realtime transport now delivered through the SignalR room hub. The gameplay screen uses the player-specific `GameplayViewDto` so only the active explainer receives the current word text.
