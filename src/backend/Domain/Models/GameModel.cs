namespace TheHat.Backend.Domain;

public enum PlayerOrderMode
{
    Random = 1,
    Manual = 2,
}

public enum RoomPhase
{
    Lobby = 1,
    InProgress = 2,
    Paused = 3,
    Completed = 4,
}

public enum RoundRule
{
    ExplainNoSynonyms = 1,
    GesturesOnly = 2,
    OneWordOnly = 3,
}

public sealed record RoomSettings
{
    public int WordsPerPlayer { get; set; }

    public int TurnDurationSeconds { get; set; }

    public PlayerOrderMode PlayerOrderMode { get; set; } = PlayerOrderMode.Random;
}

public sealed record PlayerSubmissionProgress
{
    public string PlayerId { get; init; } = string.Empty;

    public int SubmittedCount { get; init; }

    public int RequiredCount { get; init; }

    public bool IsComplete { get; init; }
}

public sealed record PlayerWordSubmission
{
    public string PlayerId { get; init; } = string.Empty;

    public int RequiredCount { get; init; }

    public IReadOnlyList<WordEntry> Words { get; init; } = [];
}

public sealed record LobbyReadiness
{
    public bool CanStart { get; init; }

    public IReadOnlyList<string> BlockingReasons { get; init; } = [];
}

public sealed record PlayerState
{
    public string Id { get; init; } = string.Empty;

    public string DisplayName { get; init; } = string.Empty;

    public string NormalizedDisplayName { get; init; } = string.Empty;

    public bool IsHost { get; init; }

    public bool IsActive { get; set; } = true;

    public int OrderIndex { get; set; }

    public int Score { get; set; }
}

public sealed record WordEntry
{
    public string Id { get; init; } = string.Empty;

    public string Text { get; init; } = string.Empty;

    public string SubmittedByPlayerId { get; init; } = string.Empty;
}

public sealed record RoundState
{
    public int RoundNumber { get; init; }

    public RoundRule Rule { get; init; }

    public List<string> RemainingWordIds { get; init; } = [];

    public List<string> GuessedWordIds { get; init; } = [];

    public bool IsCompleted { get; set; }

    public DateTime StartedAtUtc { get; init; }

    public DateTime? CompletedAtUtc { get; set; }
}

public sealed record TurnState
{
    public int TurnNumber { get; init; }

    public string ExplainerPlayerId { get; init; } = string.Empty;

    public string GuesserPlayerId { get; init; } = string.Empty;

    public string? ActiveWordId { get; set; }

    public DateTime StartedAtUtc { get; init; }

    public DateTime? ExpiredAtUtc { get; set; }

    public DateTime? CompletedAtUtc { get; set; }
}

public sealed record RoomState
{
    public string RoomId { get; init; } = string.Empty;

    public string InviteCode { get; init; } = string.Empty;

    public string HostPlayerId { get; init; } = string.Empty;

    public RoomPhase Phase { get; set; } = RoomPhase.Lobby;

    public RoomSettings Settings { get; set; } = new();

    public List<PlayerState> Players { get; init; } = [];

    public List<WordEntry> Words { get; init; } = [];

    public List<RoundState> Rounds { get; init; } = [];

    public int? CurrentRoundNumber { get; set; }

    public TurnState? CurrentTurn { get; set; }

    public DateTime CreatedAtUtc { get; init; }

    public DateTime UpdatedAtUtc { get; set; }

    public IReadOnlyList<PlayerSubmissionProgress> GetSubmissionProgress()
    {
        var requiredCount = Settings.WordsPerPlayer;
        var submittedCounts = Words
            .GroupBy(word => word.SubmittedByPlayerId, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.Count(), StringComparer.Ordinal);

        return Players
            .OrderBy(player => player.OrderIndex)
            .Select(player =>
            {
                var submittedCount = submittedCounts.GetValueOrDefault(player.Id, 0);
                return new PlayerSubmissionProgress
                {
                    PlayerId = player.Id,
                    SubmittedCount = submittedCount,
                    RequiredCount = requiredCount,
                    IsComplete = !player.IsActive || submittedCount == requiredCount,
                };
            })
            .ToList();
    }

    public PlayerWordSubmission GetWordSubmission(string playerId)
    {
        var normalizedPlayerId = playerId?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedPlayerId))
        {
            throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                [nameof(playerId)] = ["The player identifier is required."],
            });
        }

        if (Players.All(player => !string.Equals(player.Id, normalizedPlayerId, StringComparison.Ordinal)))
        {
            throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                [nameof(playerId)] = ["The player could not be found in this room."],
            });
        }

        return new PlayerWordSubmission
        {
            PlayerId = normalizedPlayerId,
            RequiredCount = Settings.WordsPerPlayer,
            Words = Words
                .Where(word => string.Equals(word.SubmittedByPlayerId, normalizedPlayerId, StringComparison.Ordinal))
                .ToList(),
        };
    }

    public LobbyReadiness GetLobbyReadiness()
    {
        var blockingReasons = new List<string>();

        if (Phase != RoomPhase.Lobby)
        {
            blockingReasons.Add("The game can only be started from the lobby.");
        }

        var activePlayers = Players
            .Where(player => player.IsActive)
            .OrderBy(player => player.OrderIndex)
            .ToList();

        if (activePlayers.Count < 2)
        {
            blockingReasons.Add("At least two active players are required to start the game.");
        }

        var progressByPlayerId = GetSubmissionProgress()
            .ToDictionary(progress => progress.PlayerId, StringComparer.Ordinal);

        foreach (var player in activePlayers)
        {
            var progress = progressByPlayerId[player.Id];

            if (progress.SubmittedCount < progress.RequiredCount)
            {
                var missingCount = progress.RequiredCount - progress.SubmittedCount;
                var noun = missingCount == 1 ? "word" : "words";
                blockingReasons.Add($"{player.DisplayName} still needs {missingCount} more {noun}.");
                continue;
            }

            if (progress.SubmittedCount > progress.RequiredCount)
            {
                blockingReasons.Add($"{player.DisplayName} has submitted more than the allowed number of words.");
            }
        }

        return new LobbyReadiness
        {
            CanStart = blockingReasons.Count == 0,
            BlockingReasons = blockingReasons,
        };
    }

    public void ApplyPlayerOrder(IReadOnlyList<string> orderedPlayerIds)
    {
        ArgumentNullException.ThrowIfNull(orderedPlayerIds);

        var expectedPlayerIds = Players
            .Select(player => player.Id)
            .OrderBy(playerId => playerId, StringComparer.Ordinal)
            .ToList();

        var suppliedPlayerIds = orderedPlayerIds
            .OrderBy(playerId => playerId, StringComparer.Ordinal)
            .ToList();

        if (expectedPlayerIds.Count != suppliedPlayerIds.Count
            || expectedPlayerIds.Where((playerId, index) => !StringComparer.Ordinal.Equals(playerId, suppliedPlayerIds[index])).Any())
        {
            throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["orderedPlayerIds"] = ["Manual player order must include every player exactly once."],
            });
        }

        for (var index = 0; index < orderedPlayerIds.Count; index++)
        {
            var player = Players.Single(existingPlayer => existingPlayer.Id == orderedPlayerIds[index]);
            player.OrderIndex = index;
        }
    }

    public void ShufflePlayers(Random random)
    {
        ArgumentNullException.ThrowIfNull(random);

        var shuffledPlayers = Players
            .OrderBy(_ => random.Next())
            .ToList();

        for (var index = 0; index < shuffledPlayers.Count; index++)
        {
            shuffledPlayers[index].OrderIndex = index;
        }
    }
}
