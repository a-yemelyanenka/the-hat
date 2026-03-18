namespace TheHat.Backend.Domain;

public interface IRoomWordSubmissionService
{
    Task<PlayerWordSubmission> GetPlayerWordSubmissionAsync(
        string roomId,
        string playerId,
        CancellationToken cancellationToken = default);

    Task<RoomState> SubmitWordsAsync(
        string roomId,
        string playerId,
        IReadOnlyList<string>? words,
        CancellationToken cancellationToken = default);
}