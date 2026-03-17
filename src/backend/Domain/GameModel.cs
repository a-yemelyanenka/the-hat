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
    public int WordsPerPlayer { get; init; }

    public int TurnDurationSeconds { get; init; }

    public PlayerOrderMode PlayerOrderMode { get; init; } = PlayerOrderMode.Random;
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

    public RoomSettings Settings { get; init; } = new();

    public List<PlayerState> Players { get; init; } = [];

    public List<WordEntry> Words { get; init; } = [];

    public List<RoundState> Rounds { get; init; } = [];

    public int? CurrentRoundNumber { get; set; }

    public TurnState? CurrentTurn { get; set; }

    public DateTime CreatedAtUtc { get; init; }

    public DateTime UpdatedAtUtc { get; set; }
}
