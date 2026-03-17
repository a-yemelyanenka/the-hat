# Copilot Instructions for The Hat

## Project overview
- Build **The Hat** as a full-stack web app using **.NET** for the backend and **React** for the frontend.
- Primary targets are **mobile web** and **desktop web**.
- The app is a real-time multiplayer party game.
- Source-of-truth product scope lives in [docs/features.md](../docs/features.md).

## Core product rules
- No accounts. Players join by invite link and display name.
- Host is also a player.
- Host can configure:
  - number of words per player
  - turn timer
  - player order mode: random or manual
- Host can edit settings after players join.
- Duplicate words are allowed.
- Rejoin matching uses trimmed, case-insensitive display name comparison.
- Current player is the explainer; the player on the left in the configured cyclic order is the guesser.
- No skipping words.
- Each guessed word gives +1 point to both explainer and guesser.
- If timer expires mid-word, that word returns to the hat as unguessed.
- Three rounds reuse the same word pool, reshuffled each round:
  - Round 1: explain normally, no synonyms
  - Round 2: gestures only, no speaking
  - Round 3: one word only, no synonyms
- Game ends after round 3 and shows final scores.

## Technical guidance
- Prefer clean separation between:
  - game/domain logic
  - API/realtime transport
  - persistence
  - React UI state and presentation
- Put core business rules, validations, and state-transition orchestration in the `Domain` layer.
- Keep the `Api` layer thin: it should mainly handle HTTP transport concerns, request/response mapping, and protocol-specific concerns.
- If logic can live outside controllers/endpoints, prefer moving it into `Domain` services or domain objects.
- Prefer explicit abstractions for domain behavior. Domain services should usually be accessed through interfaces.
- Register domain dependencies from a dedicated `Domain` dependency injection entry point instead of scattering registrations across other layers.
- Avoid static methods for core domain behavior when an injectable service or domain object is a better fit.
- Organize the `Domain` project with a clear folder structure by responsibility, such as `Abstractions`, `Models`, `Services`, `Exceptions`, and `DependencyInjection`.
- Keep gameplay rules centralized on the backend.
- Prefer strongly typed contracts between backend and frontend.
- Prefer test coverage for core game engine behavior and state transitions.
- Design with real-time synchronization in mind.
- Make UI responsive and mobile-first.
- Keep i18n in mind when adding user-facing strings.

## File and documentation guidance
- Before implementing significant features, consult [docs/features.md](../docs/features.md).
- Keep documentation aligned with implemented behavior.
- When requirements change, update relevant docs.
- When adding new domain code, place files in the appropriate `Domain` subfolder instead of keeping a flat structure.

## Prompt logging requirement
- Always update [docs/developer/prompts.md](../docs/developer/prompts.md) when the user provides a new prompt or materially changes requirements.
- Append new prompts in chronological order.
- Preserve prior prompt history.
- Record prompts verbatim when practical.
- Include the LLM model used for each recorded prompt entry.

## Implementation preferences
- Prefer minimal, focused changes.
- Do not introduce unnecessary complexity.
- Preserve existing project conventions.
- When adding backend features, start by deciding what belongs in `Domain`, then keep transport code as a thin wrapper around it.
- Prefer constructor-injected collaborators and interface-based dependencies for domain services.
- Keep dependency registration cohesive and close to the layer that owns the services.
- Favor maintainable architecture over premature optimization.
- For MVP work, prioritize playable end-to-end functionality.
