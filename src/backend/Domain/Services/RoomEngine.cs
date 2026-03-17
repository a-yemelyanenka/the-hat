namespace TheHat.Backend.Domain;

public sealed class RoomEngine(IDisplayNameNormalizer displayNameNormalizer) : IRoomEngine
{
    public PlayerState? FindRejoinCandidate(RoomState room, string displayName)
    {
        ArgumentNullException.ThrowIfNull(room);

        var normalizedName = displayNameNormalizer.Normalize(displayName);
        return room.Players.FirstOrDefault(player => player.NormalizedDisplayName == normalizedName);
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
        room.Phase = RoomPhase.InProgress;
        room.Rounds.Clear();
        room.CurrentRoundNumber = 1;
        room.CurrentTurn = null;
        room.UpdatedAtUtc = timestamp;

        PrepareRound(room, 1, seed, timestamp);
        StartNextTurn(room, timestamp);
    }

    public string DrawWord(RoomState room)
    {
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
        var timestamp = nowUtc ?? DateTime.UtcNow;
        var round = GetCurrentRound(room);
        var turn = GetCurrentTurn(room);
        var activeWordId = turn.ActiveWordId ?? throw new InvalidOperationException("A word must be active before it can be guessed.");

        round.GuessedWordIds.Add(activeWordId);
        turn.ActiveWordId = null;
        AddPoint(room, turn.ExplainerPlayerId);
        AddPoint(room, turn.GuesserPlayerId);
        room.UpdatedAtUtc = timestamp;

        TryAdvanceRound(room, timestamp);
    }

    public void ExpireTurn(RoomState room, DateTime? nowUtc = null)
    {
        var timestamp = nowUtc ?? DateTime.UtcNow;
        var round = GetCurrentRound(room);
        var turn = GetCurrentTurn(room);

        if (!string.IsNullOrWhiteSpace(turn.ActiveWordId))
        {
            round.RemainingWordIds.Insert(0, turn.ActiveWordId);
            turn.ActiveWordId = null;
        }

        turn.ExpiredAtUtc = timestamp;
        turn.CompletedAtUtc = timestamp;
        room.UpdatedAtUtc = timestamp;

        StartNextTurn(room, timestamp);
    }

    public void StartNextTurn(RoomState room, DateTime? nowUtc = null)
    {
        ArgumentNullException.ThrowIfNull(room);

        var orderedActivePlayers = room.Players
            .Where(player => player.IsActive)
            .OrderBy(player => player.OrderIndex)
            .ToList();

        if (orderedActivePlayers.Count < 2)
        {
            throw new InvalidOperationException("At least two active players are required to create a turn.");
        }

        var timestamp = nowUtc ?? DateTime.UtcNow;
        var nextExplainerId = room.CurrentTurn is null
            ? orderedActivePlayers[0].Id
            : FindNextActivePlayerId(room, room.CurrentTurn.ExplainerPlayerId);

        var nextGuesserId = FindNextActivePlayerId(room, nextExplainerId);
        var nextTurnNumber = (room.CurrentTurn?.TurnNumber ?? 0) + 1;

        room.CurrentTurn = new TurnState
        {
            TurnNumber = nextTurnNumber,
            ExplainerPlayerId = nextExplainerId,
            GuesserPlayerId = nextGuesserId,
            StartedAtUtc = timestamp,
        };

        room.UpdatedAtUtc = timestamp;
    }

    public string FindNextActivePlayerId(RoomState room, string currentPlayerId)
    {
        ArgumentNullException.ThrowIfNull(room);

        var orderedActivePlayers = room.Players
            .Where(player => player.IsActive)
            .OrderBy(player => player.OrderIndex)
            .ToList();

        if (orderedActivePlayers.Count == 0)
        {
            throw new InvalidOperationException("The room does not contain any active players.");
        }

        var currentIndex = orderedActivePlayers.FindIndex(player => player.Id == currentPlayerId);
        if (currentIndex < 0)
        {
            throw new InvalidOperationException($"Active player '{currentPlayerId}' was not found in the room order.");
        }

        var nextIndex = (currentIndex + 1) % orderedActivePlayers.Count;
        return orderedActivePlayers[nextIndex].Id;
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

    private void TryAdvanceRound(RoomState room, DateTime timestamp)
    {
        var round = GetCurrentRound(room);
        if (round.RemainingWordIds.Count > 0 || room.CurrentTurn?.ActiveWordId is not null)
        {
            return;
        }

        round.IsCompleted = true;
        round.CompletedAtUtc = timestamp;

        if (round.RoundNumber >= 3)
        {
            room.Phase = RoomPhase.Completed;
            room.CurrentTurn = null;
            room.UpdatedAtUtc = timestamp;
            return;
        }

        var nextRoundNumber = round.RoundNumber + 1;
        room.CurrentRoundNumber = nextRoundNumber;
        PrepareRound(room, nextRoundNumber, nextRoundNumber, timestamp);
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
