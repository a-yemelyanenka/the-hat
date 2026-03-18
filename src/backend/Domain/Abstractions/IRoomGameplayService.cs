namespace TheHat.Backend.Domain;

public interface IRoomGameplayService
{
    Task<PlayerGameplayState> GetGameplayViewAsync(string roomId, string playerId, CancellationToken cancellationToken = default);

    Task<RoomState> ConfirmGuessAsync(string roomId, string playerId, CancellationToken cancellationToken = default);

    Task<RoomState> PauseGameAsync(string roomId, string hostPlayerId, CancellationToken cancellationToken = default);

    Task<RoomState> ResumeGameAsync(string roomId, string hostPlayerId, CancellationToken cancellationToken = default);

    Task<RoomState> ContinueToNextRoundAsync(string roomId, string hostPlayerId, CancellationToken cancellationToken = default);
}