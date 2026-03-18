using TheHat.Backend.Contracts;
using TheHat.Backend.Domain;

namespace TheHat.Backend.Api;

internal static class RoomContractMappingExtensions
{
    public static RoomSettings ToDomain(this RoomSettingsDto dto) => new()
    {
        WordsPerPlayer = dto.WordsPerPlayer,
        TurnDurationSeconds = dto.TurnDurationSeconds,
        PlayerOrderMode = dto.PlayerOrderMode,
    };

    public static RoomSnapshotDto ToDto(this RoomState room) => new(
        room.RoomId,
        room.InviteCode,
        room.Phase,
        room.HostPlayerId,
        room.Settings.ToDto(),
        room.Players
            .OrderBy(player => player.OrderIndex)
            .Select(player => player.ToDto())
            .ToList(),
        room.GetSubmissionProgress()
            .Select(progress => progress.ToDto())
            .ToList(),
        room.GetLobbyReadiness().ToDto(),
        [],
        room.Rounds
            .OrderBy(round => round.RoundNumber)
            .Select(round => round.ToDto())
            .ToList(),
        room.CurrentRoundNumber,
        room.CurrentTurn?.ToDto(),
        room.CreatedAtUtc,
        room.UpdatedAtUtc);

    public static PlayerWordSubmissionDto ToDto(this PlayerWordSubmission submission) => new(
        submission.PlayerId,
        submission.RequiredCount,
        submission.Words.Select(word => word.ToDto()).ToList());

    public static GameplayViewDto ToDto(this PlayerGameplayState gameplayState) => new(
        gameplayState.Room.ToDto(),
        gameplayState.PlayerId,
        gameplayState.CurrentRule,
        gameplayState.ActiveWordText,
        gameplayState.RemainingTurnSeconds,
        gameplayState.IsCurrentPlayerExplainer,
        gameplayState.IsCurrentPlayerGuesser);

    private static RoomSettingsDto ToDto(this RoomSettings settings) => new(
        settings.WordsPerPlayer,
        settings.TurnDurationSeconds,
        settings.PlayerOrderMode);

    private static PlayerDto ToDto(this PlayerState player) => new(
        player.Id,
        player.DisplayName,
        player.IsHost,
        player.IsActive,
        player.OrderIndex,
        player.Score);

    private static PlayerSubmissionProgressDto ToDto(this PlayerSubmissionProgress progress) => new(
        progress.PlayerId,
        progress.SubmittedCount,
        progress.RequiredCount,
        progress.IsComplete);

    private static LobbyReadinessDto ToDto(this LobbyReadiness readiness) => new(
        readiness.CanStart,
        readiness.BlockingReasons.ToList());

    private static WordSubmissionDto ToDto(this WordEntry word) => new(
        word.Id,
        word.Text,
        word.SubmittedByPlayerId);

    private static RoundStateDto ToDto(this RoundState round) => new(
        round.RoundNumber,
        round.Rule,
        round.RemainingWordIds.ToList(),
        round.GuessedWordIds.ToList(),
        round.IsCompleted);

    private static TurnStateDto ToDto(this TurnState turn) => new(
        turn.TurnNumber,
        turn.ExplainerPlayerId,
        turn.GuesserPlayerId,
        turn.ActiveWordId,
        turn.DurationSeconds,
        turn.StartedAtUtc,
        turn.EndsAtUtc,
        turn.PausedAtUtc,
        turn.RemainingSecondsWhenPaused,
        turn.ExpiredAtUtc,
        turn.CompletedAtUtc);
}