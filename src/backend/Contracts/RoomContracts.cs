using TheHat.Backend.Domain;

namespace TheHat.Backend.Contracts;

public sealed record RoomSettingsDto(
    int WordsPerPlayer,
    int TurnDurationSeconds,
    PlayerOrderMode PlayerOrderMode);

public sealed record PlayerDto(
    string PlayerId,
    string DisplayName,
    bool IsHost,
    bool IsActive,
    int OrderIndex,
    int Score);

public sealed record PlayerSubmissionProgressDto(
    string PlayerId,
    int SubmittedCount,
    int RequiredCount,
    bool IsComplete);

public sealed record LobbyReadinessDto(
    bool CanStart,
    IReadOnlyList<string> BlockingReasons);

public sealed record WordSubmissionDto(
    string WordId,
    string Text,
    string SubmittedByPlayerId);

public sealed record PlayerWordSubmissionDto(
    string PlayerId,
    int RequiredCount,
    IReadOnlyList<WordSubmissionDto> Words);

public sealed record RoundStateDto(
    int RoundNumber,
    RoundRule Rule,
    IReadOnlyList<string> RemainingWordIds,
    IReadOnlyList<string> GuessedWordIds,
    bool IsCompleted);

public sealed record TurnStateDto(
    int TurnNumber,
    string ExplainerPlayerId,
    string GuesserPlayerId,
    string? ActiveWordId,
    int DurationSeconds,
    DateTime StartedAtUtc,
    DateTime EndsAtUtc,
    DateTime? PausedAtUtc,
    int? RemainingSecondsWhenPaused,
    DateTime? ExpiredAtUtc,
    DateTime? CompletedAtUtc);

public sealed record GameplayViewDto(
    RoomSnapshotDto Room,
    string PlayerId,
    RoundRule? CurrentRule,
    string? ActiveWord,
    int? RemainingTurnSeconds,
    bool IsCurrentPlayerExplainer,
    bool IsCurrentPlayerGuesser);

public sealed record RoomSnapshotDto(
    string RoomId,
    string InviteCode,
    RoomPhase Phase,
    string HostPlayerId,
    RoomSettingsDto Settings,
    IReadOnlyList<PlayerDto> Players,
    IReadOnlyList<PlayerSubmissionProgressDto> SubmissionProgress,
    LobbyReadinessDto LobbyReadiness,
    IReadOnlyList<WordSubmissionDto> Words,
    IReadOnlyList<RoundStateDto> Rounds,
    int? CurrentRoundNumber,
    TurnStateDto? CurrentTurn,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public sealed record CreateRoomRequestDto(
    string HostDisplayName,
    RoomSettingsDto Settings);

public sealed record CreateRoomResponseDto(
    RoomSnapshotDto Room);

public sealed record JoinRoomRequestDto(
    string DisplayName);

public sealed record RejoinRoomRequestDto(
    string DisplayName);

public sealed record UpdateRoomSettingsRequestDto(
    string HostPlayerId,
    RoomSettingsDto Settings,
    IReadOnlyList<string>? OrderedPlayerIds);

public sealed record SubmitWordsRequestDto(
    string PlayerId,
    IReadOnlyList<string> Words);

public sealed record StartGameRequestDto(
    string HostPlayerId);

public sealed record StartTurnRequestDto(
    string PlayerId);

public sealed record ConfirmGuessRequestDto(
    string PlayerId);

public sealed record EndTurnRequestDto(
    string PlayerId);

public sealed record PauseGameRequestDto(
    string HostPlayerId);

public sealed record ResumeGameRequestDto(
    string HostPlayerId);

public sealed record ContinueRoundRequestDto(
    string HostPlayerId);

public abstract record RoomEventDto(
    string RoomId,
    DateTime OccurredAtUtc);

public sealed record PlayerJoinedEventDto(
    string RoomId,
    DateTime OccurredAtUtc,
    PlayerDto Player) : RoomEventDto(RoomId, OccurredAtUtc);

public sealed record PlayerRejoinedEventDto(
    string RoomId,
    DateTime OccurredAtUtc,
    string PlayerId) : RoomEventDto(RoomId, OccurredAtUtc);

public sealed record PlayerLeftEventDto(
    string RoomId,
    DateTime OccurredAtUtc,
    string PlayerId,
    bool IsActive) : RoomEventDto(RoomId, OccurredAtUtc);

public sealed record RoomSettingsChangedEventDto(
    string RoomId,
    DateTime OccurredAtUtc,
    RoomSettingsDto Settings,
    IReadOnlyList<string>? OrderedPlayerIds) : RoomEventDto(RoomId, OccurredAtUtc);

public sealed record WordSubmissionUpdatedEventDto(
    string RoomId,
    DateTime OccurredAtUtc,
    string PlayerId,
    int SubmittedCount,
    int RequiredCount) : RoomEventDto(RoomId, OccurredAtUtc);

public sealed record GameStartedEventDto(
    string RoomId,
    DateTime OccurredAtUtc,
    int RoundNumber,
    TurnStateDto CurrentTurn) : RoomEventDto(RoomId, OccurredAtUtc);

public sealed record TurnStartedEventDto(
    string RoomId,
    DateTime OccurredAtUtc,
    int RoundNumber,
    TurnStateDto Turn) : RoomEventDto(RoomId, OccurredAtUtc);

public sealed record WordGuessedEventDto(
    string RoomId,
    DateTime OccurredAtUtc,
    int RoundNumber,
    string WordId,
    string ExplainerPlayerId,
    string GuesserPlayerId,
    IReadOnlyList<PlayerDto> Scores) : RoomEventDto(RoomId, OccurredAtUtc);

public sealed record TurnExpiredEventDto(
    string RoomId,
    DateTime OccurredAtUtc,
    int RoundNumber,
    string ReturnedWordId,
    TurnStateDto NextTurn) : RoomEventDto(RoomId, OccurredAtUtc);

public sealed record RoundCompletedEventDto(
    string RoomId,
    DateTime OccurredAtUtc,
    int RoundNumber,
    IReadOnlyList<PlayerDto> Scores) : RoomEventDto(RoomId, OccurredAtUtc);

public sealed record GameCompletedEventDto(
    string RoomId,
    DateTime OccurredAtUtc,
    IReadOnlyList<PlayerDto> FinalScores) : RoomEventDto(RoomId, OccurredAtUtc);
