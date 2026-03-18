namespace TheHat.Backend.Domain;

public sealed class RoomEngine(IDisplayNameNormalizer displayNameNormalizer) : IRoomEngine
{
    public PlayerState? FindRejoinCandidate(RoomState room, string displayName)
    {
        ArgumentNullException.ThrowIfNull(room);

        var normalizedName = displayNameNormalizer.Normalize(displayName);
        return room.Players.FirstOrDefault(player => player.NormalizedDisplayName == normalizedName);
    }

    public PlayerGameplayState CreateGameplayState(RoomState room, string playerId, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        var normalizedPlayerId = playerId?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedPlayerId)
            || room.Players.All(player => !string.Equals(player.Id, normalizedPlayerId, StringComparison.Ordinal)))
        {
            throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                [nameof(playerId)] = ["A valid player identifier is required to load gameplay."],
            });
        }

        var currentTurn = room.CurrentTurn;
        var isCurrentPlayerExplainer = string.Equals(currentTurn?.ExplainerPlayerId, normalizedPlayerId, StringComparison.Ordinal);
        var isCurrentPlayerGuesser = string.Equals(currentTurn?.GuesserPlayerId, normalizedPlayerId, StringComparison.Ordinal);
        var activeWordText = room.Phase == RoomPhase.InProgress
            && isCurrentPlayerExplainer
            && !string.IsNullOrWhiteSpace(currentTurn?.ActiveWordId)
            ? room.Words.Single(word => word.Id == currentTurn.ActiveWordId).Text
            : null;

        return new PlayerGameplayState
        {
            Room = room,
            PlayerId = normalizedPlayerId,
            CurrentRule = room.TryGetCurrentRound()?.Rule,
            ActiveWordText = activeWordText,
            RemainingTurnSeconds = GetRemainingTurnSeconds(room, nowUtc),
            IsCurrentPlayerExplainer = isCurrentPlayerExplainer,
            IsCurrentPlayerGuesser = isCurrentPlayerGuesser,
        };
    }

    public bool ReactivatePlayer(RoomState room, string playerId, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        var player = room.Players.SingleOrDefault(existingPlayer => existingPlayer.Id == playerId)
            ?? throw new InvalidOperationException($"Player '{playerId}' was not found in the room.");

        if (player.IsActive)
        {
            return false;
        }

        player.IsActive = true;
        var timestamp = nowUtc ?? DateTime.UtcNow;
        room.UpdatedAtUtc = timestamp;

        if (room.Phase == RoomPhase.Paused
            && room.CurrentTurn is null
            && room.CurrentRoundNumber is not null
            && room.TryGetCurrentRound() is { IsCompleted: false, RemainingWordIds.Count: > 0 }
            && room.Players.Count(existingPlayer => existingPlayer.IsActive) >= 2)
        {
            StartNextTurn(room, timestamp);
        }

        return true;
    }

    public bool DeactivatePlayer(RoomState room, string playerId, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        var player = room.Players.SingleOrDefault(existingPlayer => existingPlayer.Id == playerId)
            ?? throw new InvalidOperationException($"Player '{playerId}' was not found in the room.");

        if (!player.IsActive)
        {
            return false;
        }

        player.IsActive = false;
        var timestamp = nowUtc ?? DateTime.UtcNow;

        if (room.Phase == RoomPhase.AwaitingTurnStart
            && room.CurrentTurn is not null
            && (string.Equals(room.CurrentTurn.ExplainerPlayerId, playerId, StringComparison.Ordinal)
                || string.Equals(room.CurrentTurn.GuesserPlayerId, playerId, StringComparison.Ordinal)))
        {
            room.CurrentTurn = null;

            if (room.Players.Count(existingPlayer => existingPlayer.IsActive) < 2)
            {
                room.Phase = RoomPhase.Paused;
                room.UpdatedAtUtc = timestamp;
                return true;
            }

            StartNextTurn(room, timestamp);
            return true;
        }

        room.UpdatedAtUtc = timestamp;
        return true;
    }

    public void StartGame(RoomState room, int? seed = null, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        if (room.Words.Count == 0)
        {
            throw new InvalidOperationException("A room must contain words before gameplay starts.");
        }

        if (room.Players.Count(player => player.IsActive) < 2)
        {
            throw new InvalidOperationException("At least two active players are required to start a game.");
        }

        var timestamp = nowUtc ?? DateTime.UtcNow;
        room.Rounds.Clear();
        room.CurrentRoundNumber = null;
        room.LastCompletedExplainerPlayerId = null;
        room.LastCompletedTurnNumber = 0;
        room.CurrentTurn = null;

        foreach (var player in room.Players)
        {
            player.Score = 0;
        }

        room.UpdatedAtUtc = timestamp;

        BeginRound(room, 1, seed, timestamp);
    }

    public void StartTurn(RoomState room, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        if (room.Phase != RoomPhase.AwaitingTurnStart)
        {
            throw new InvalidOperationException("The room is not waiting for the next explainer to start the turn.");
        }

        var round = GetCurrentRound(room);
        if (round.RemainingWordIds.Count == 0)
        {
            throw new InvalidOperationException("A turn cannot be started because the current round has no remaining words.");
        }

        var turn = GetCurrentTurn(room);
        var timestamp = nowUtc ?? DateTime.UtcNow;

        turn.StartedAtUtc = timestamp;
        turn.EndsAtUtc = timestamp.AddSeconds(turn.DurationSeconds);
        turn.PausedAtUtc = null;
        turn.RemainingSecondsWhenPaused = null;
        turn.ExpiredAtUtc = null;
        turn.CompletedAtUtc = null;
        turn.ActiveWordId = DrawNextWordId(round);

        room.Phase = RoomPhase.InProgress;
        room.UpdatedAtUtc = timestamp;
    }

    public bool AdvanceState(RoomState room, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        if (room.Phase != RoomPhase.InProgress || room.CurrentTurn is null)
        {
            return false;
        }

        var timestamp = nowUtc ?? DateTime.UtcNow;
        if (room.CurrentTurn.EndsAtUtc > timestamp)
        {
            return false;
        }

        ExpireTurn(room, timestamp);
        return true;
    }

    public string DrawWord(RoomState room)
    {
        ArgumentNullException.ThrowIfNull(room);

        var turn = GetCurrentTurn(room);
        if (!string.IsNullOrWhiteSpace(turn.ActiveWordId))
        {
            return turn.ActiveWordId;
        }

        var round = GetCurrentRound(room);
        if (round.RemainingWordIds.Count == 0)
        {
            throw new InvalidOperationException("There are no words left to draw in the current round.");
        }

        var wordId = round.RemainingWordIds[0];
        round.RemainingWordIds.RemoveAt(0);
        turn.ActiveWordId = wordId;
        room.UpdatedAtUtc = DateTime.UtcNow;
        return wordId;
    }

    public void RecordCorrectGuess(RoomState room, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        var timestamp = nowUtc ?? DateTime.UtcNow;
        EnsureActiveGameplay(room, "Guesses can only be confirmed during an active turn.");
        var round = GetCurrentRound(room);
        var turn = GetCurrentTurn(room);
        var activeWordId = turn.ActiveWordId ?? throw new InvalidOperationException("A word must be active before it can be guessed.");

        round.GuessedWordIds.Add(activeWordId);
        turn.ActiveWordId = null;
        AddPoint(room, turn.ExplainerPlayerId);
        AddPoint(room, turn.GuesserPlayerId);
        room.UpdatedAtUtc = timestamp;

        if (round.RemainingWordIds.Count == 0)
        {
            CompleteCurrentRound(room, turn, round, timestamp);
            return;
        }

        turn.ActiveWordId = DrawNextWordId(round);
    }

    public void EndTurn(RoomState room, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        var timestamp = nowUtc ?? DateTime.UtcNow;
        EnsureActiveGameplay(room, "The current turn can only be ended during active gameplay.");
        CompleteCurrentTurnAndAdvance(room, timestamp, markExpired: false);
    }

    public void ExpireTurn(RoomState room, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        var timestamp = nowUtc ?? DateTime.UtcNow;
        EnsureActiveGameplay(room, "Turns can only expire during active gameplay.");
        CompleteCurrentTurnAndAdvance(room, timestamp, markExpired: true);
    }

    public void PauseGame(RoomState room, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        var timestamp = nowUtc ?? DateTime.UtcNow;
        EnsureActiveGameplay(room, "The game can only be paused during an active turn.");
        var turn = GetCurrentTurn(room);
        var remainingSeconds = CalculateRemainingTurnSeconds(turn, timestamp);

        if (remainingSeconds <= 0)
        {
            ExpireTurn(room, timestamp);
            return;
        }

        room.Phase = RoomPhase.Paused;
        turn.PausedAtUtc = timestamp;
        turn.RemainingSecondsWhenPaused = remainingSeconds;
        room.UpdatedAtUtc = timestamp;
    }

    public void ResumeGame(RoomState room, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        if (room.Phase != RoomPhase.Paused)
        {
            throw new InvalidOperationException("The game is not paused.");
        }

        var timestamp = nowUtc ?? DateTime.UtcNow;
        var turn = GetCurrentTurn(room);
        var remainingSeconds = Math.Max(1, turn.RemainingSecondsWhenPaused ?? CalculateRemainingTurnSeconds(turn, timestamp));

        room.Phase = RoomPhase.InProgress;
        turn.PausedAtUtc = null;
        turn.EndsAtUtc = timestamp.AddSeconds(remainingSeconds);
        turn.RemainingSecondsWhenPaused = null;
        room.UpdatedAtUtc = timestamp;
    }

    public void ContinueToNextRound(RoomState room, int? seed = null, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        if (room.Phase != RoomPhase.RoundSummary)
        {
            throw new InvalidOperationException("The room is not waiting to start the next round.");
        }

        var currentRoundNumber = room.CurrentRoundNumber ?? throw new InvalidOperationException("The room does not have a completed round to continue from.");
        if (currentRoundNumber >= 3)
        {
            throw new InvalidOperationException("The game has already completed all rounds.");
        }

        BeginRound(room, currentRoundNumber + 1, seed, nowUtc ?? DateTime.UtcNow);
    }

    public void StartNextTurn(RoomState room, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        if (room.Phase != RoomPhase.InProgress
            && room.Phase != RoomPhase.AwaitingTurnStart)
        {
            throw new InvalidOperationException("Turns can only be prepared while the game is active.");
        }

        var round = GetCurrentRound(room);
        if (round.RemainingWordIds.Count == 0)
        {
            throw new InvalidOperationException("A new turn cannot start because the current round has no remaining words.");
        }

        var orderedActivePlayers = room.Players
            .Where(player => player.IsActive)
            .OrderBy(player => player.OrderIndex)
            .ToList();

        if (orderedActivePlayers.Count < 2)
        {
            throw new InvalidOperationException("At least two active players are required to create a turn.");
        }

        var timestamp = nowUtc ?? DateTime.UtcNow;
        var priorExplainerId = room.CurrentTurn?.ExplainerPlayerId ?? room.LastCompletedExplainerPlayerId;
        var nextExplainerId = priorExplainerId is null
            ? orderedActivePlayers[0].Id
            : FindNextActivePlayerId(room, priorExplainerId);

        var nextGuesserId = FindNextActivePlayerId(room, nextExplainerId);
        var nextTurnNumber = (room.CurrentTurn?.TurnNumber ?? room.LastCompletedTurnNumber) + 1;

        room.CurrentTurn = new TurnState
        {
            TurnNumber = nextTurnNumber,
            ExplainerPlayerId = nextExplainerId,
            GuesserPlayerId = nextGuesserId,
            DurationSeconds = room.Settings.TurnDurationSeconds,
            StartedAtUtc = timestamp,
            EndsAtUtc = timestamp,
        };

        room.Phase = RoomPhase.AwaitingTurnStart;
        room.UpdatedAtUtc = timestamp;
    }

    public string FindNextActivePlayerId(RoomState room, string currentPlayerId)
    {
        ArgumentNullException.ThrowIfNull(room);

        var orderedPlayers = room.Players
            .OrderBy(player => player.OrderIndex)
            .ToList();

        var orderedActivePlayers = orderedPlayers
            .Where(player => player.IsActive)
            .ToList();

        if (orderedActivePlayers.Count == 0)
        {
            throw new InvalidOperationException("The room does not contain any active players.");
        }

        var currentIndex = orderedPlayers.FindIndex(player => player.Id == currentPlayerId);
        if (currentIndex < 0)
        {
            throw new InvalidOperationException($"Player '{currentPlayerId}' was not found in the room order.");
        }

        for (var offset = 1; offset <= orderedPlayers.Count; offset++)
        {
            var nextIndex = (currentIndex + offset) % orderedPlayers.Count;
            if (orderedPlayers[nextIndex].IsActive)
            {
                return orderedPlayers[nextIndex].Id;
            }
        }

        throw new InvalidOperationException("The room does not contain any active players.");
    }

    public int? GetRemainingTurnSeconds(RoomState room, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        if (room.CurrentTurn is null)
        {
            return null;
        }

        if (room.Phase == RoomPhase.AwaitingTurnStart)
        {
            return null;
        }

        var timestamp = nowUtc ?? DateTime.UtcNow;
        return room.Phase == RoomPhase.Paused
            ? Math.Max(0, room.CurrentTurn.RemainingSecondsWhenPaused ?? CalculateRemainingTurnSeconds(room.CurrentTurn, timestamp))
            : Math.Max(0, CalculateRemainingTurnSeconds(room.CurrentTurn, timestamp));
    }

    private RoundState GetCurrentRound(RoomState room)
    {
        ArgumentNullException.ThrowIfNull(room);

        var currentRoundNumber = room.CurrentRoundNumber ?? throw new InvalidOperationException("The room does not have an active round.");
        return room.Rounds.Single(round => round.RoundNumber == currentRoundNumber);
    }

    private TurnState GetCurrentTurn(RoomState room)
    {
        ArgumentNullException.ThrowIfNull(room);
        return room.CurrentTurn ?? throw new InvalidOperationException("The room does not have an active turn.");
    }

    private void AddPoint(RoomState room, string playerId)
    {
        var player = room.Players.Single(playerState => playerState.Id == playerId);
        player.Score += 1;
    }

    private void BeginRound(RoomState room, int roundNumber, int? seed, DateTime timestamp)
    {
        room.CurrentRoundNumber = roundNumber;
        PrepareRound(room, roundNumber, seed, timestamp);
        StartNextTurn(room, timestamp);
    }

    private void PrepareRound(RoomState room, int roundNumber, int? seed, DateTime timestamp)
    {
        var shuffledWordIds = room.Words
            .Select(word => word.Id)
            .ToList();

        Shuffle(shuffledWordIds, new Random(seed ?? Random.Shared.Next()));

        room.Rounds.Add(new RoundState
        {
            RoundNumber = roundNumber,
            Rule = ResolveRule(roundNumber),
            RemainingWordIds = shuffledWordIds,
            StartedAtUtc = timestamp,
        });
    }

    private void CompleteCurrentRound(RoomState room, TurnState turn, RoundState round, DateTime timestamp)
    {
        turn.CompletedAtUtc = timestamp;
        room.LastCompletedExplainerPlayerId = turn.ExplainerPlayerId;
        room.LastCompletedTurnNumber = turn.TurnNumber;
        round.IsCompleted = true;
        round.CompletedAtUtc = timestamp;
        room.CurrentTurn = null;

        if (round.RoundNumber >= 3)
        {
            room.Phase = RoomPhase.Completed;
            room.UpdatedAtUtc = timestamp;
            return;
        }

        room.Phase = RoomPhase.RoundSummary;
        room.UpdatedAtUtc = timestamp;
    }

    private static int CalculateRemainingTurnSeconds(TurnState turn, DateTime timestamp)
        => (int)Math.Ceiling((turn.EndsAtUtc - timestamp).TotalSeconds);

    private void CompleteCurrentTurnAndAdvance(RoomState room, DateTime timestamp, bool markExpired)
    {
        var turn = GetCurrentTurn(room);
        var round = GetCurrentRound(room);

        if (!string.IsNullOrWhiteSpace(turn.ActiveWordId))
        {
            round.RemainingWordIds.Insert(0, turn.ActiveWordId);
            turn.ActiveWordId = null;
        }

        turn.ExpiredAtUtc = markExpired ? timestamp : null;
        turn.CompletedAtUtc = timestamp;
        room.LastCompletedExplainerPlayerId = turn.ExplainerPlayerId;
        room.LastCompletedTurnNumber = turn.TurnNumber;
        room.CurrentTurn = null;
        room.UpdatedAtUtc = timestamp;

        if (room.Players.Count(player => player.IsActive) < 2)
        {
            room.Phase = RoomPhase.Paused;
            return;
        }

        StartNextTurn(room, timestamp);
    }

    private static string DrawNextWordId(RoundState round)
    {
        if (round.RemainingWordIds.Count == 0)
        {
            throw new InvalidOperationException("There are no words left to draw in the current round.");
        }

        var wordId = round.RemainingWordIds[0];
        round.RemainingWordIds.RemoveAt(0);
        return wordId;
    }

    private static void EnsureActiveGameplay(RoomState room, string errorMessage)
    {
        if (room.Phase == RoomPhase.InProgress)
        {
            return;
        }

        throw new InvalidOperationException(errorMessage);
    }

    private RoundRule ResolveRule(int roundNumber) => roundNumber switch
    {
        1 => RoundRule.ExplainNoSynonyms,
        2 => RoundRule.GesturesOnly,
        3 => RoundRule.OneWordOnly,
        _ => throw new ArgumentOutOfRangeException(nameof(roundNumber), roundNumber, "Only three rounds exist in The Hat."),
    };

    private void Shuffle(List<string> items, Random random)
    {
        for (var index = items.Count - 1; index > 0; index--)
        {
            var swapIndex = random.Next(index + 1);
            (items[index], items[swapIndex]) = (items[swapIndex], items[index]);
        }
    }
}
