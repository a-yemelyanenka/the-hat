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

## Core domain entities

| Entity | Purpose | Key fields |
| --- | --- | --- |
| `RoomState` | Aggregate root for a room and active game | `roomId`, `inviteCode`, `hostPlayerId`, `phase`, `settings`, `players`, `words`, `rounds`, `currentRoundNumber`, `currentTurn` |
| `RoomSettings` | Host-configurable rules | `wordsPerPlayer`, `turnDurationSeconds`, `playerOrderMode` |
| `PlayerState` | Player identity, seat, and score | `id`, `displayName`, `normalizedDisplayName`, `isHost`, `isActive`, `orderIndex`, `score` |
| `WordEntry` | Submitted word, including duplicates | `id`, `text`, `submittedByPlayerId` |
| `RoundState` | Per-round word order and completion status | `roundNumber`, `rule`, `remainingWordIds`, `guessedWordIds`, `isCompleted` |
| `TurnState` | Current explainer/guesser pair and active word | `turnNumber`, `explainerPlayerId`, `guesserPlayerId`, `activeWordId`, timestamps |

## Explicit game-rule representation

### Player order and turns
- Ordered seating is stored on each player with `orderIndex`.
- The explainer is the active turn owner.
- The guesser is the next active player in cyclic order.
- Inactive players remain in room history but are skipped when turn pairs are calculated.

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

### Snapshot/response DTOs
- `CreateRoomResponseDto`
- `RoomSnapshotDto`
- `RoomSettingsDto`
- `PlayerDto`
- `WordSubmissionDto`
- `RoundStateDto`
- `TurnStateDto`

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

This keeps room, lobby, and gameplay flows explicit on the frontend while the API and realtime layers are implemented in later issues.
