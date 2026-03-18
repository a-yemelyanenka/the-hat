using Microsoft.EntityFrameworkCore;

namespace TheHat.Backend.Domain;

public sealed class RoomPresenceService(
    IApplicationDbContext dbContext,
    IRoomEngine roomEngine) : IRoomPresenceService
{
    public async Task<RoomState?> ReactivatePlayerAsync(
        string roomId,
        string playerId,
        CancellationToken cancellationToken = default)
    {
        var room = await GetRoomAsync(roomId, cancellationToken);
        var normalizedPlayerId = ValidatePlayer(room, playerId, "A valid player identifier is required to reactivate presence.");

        if (!roomEngine.ReactivatePlayer(room, normalizedPlayerId))
        {
            return null;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return room;
    }

    public async Task<RoomState?> DeactivatePlayerAsync(
        string roomId,
        string playerId,
        CancellationToken cancellationToken = default)
    {
        var room = await GetRoomAsync(roomId, cancellationToken);
        var normalizedPlayerId = ValidatePlayer(room, playerId, "A valid player identifier is required to deactivate presence.");

        if (!roomEngine.DeactivatePlayer(room, normalizedPlayerId))
        {
            return null;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return room;
    }

    private async Task<RoomState> GetRoomAsync(string roomId, CancellationToken cancellationToken)
    {
        var normalizedRoomId = roomId?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedRoomId))
        {
            throw new RoomNotFoundException(string.Empty);
        }

        return await dbContext.Rooms.SingleOrDefaultAsync(room => room.RoomId == normalizedRoomId, cancellationToken)
            ?? throw new RoomNotFoundException(normalizedRoomId);
    }

    private static string ValidatePlayer(RoomState room, string playerId, string errorMessage)
    {
        var normalizedPlayerId = playerId?.Trim();
        if (!string.IsNullOrWhiteSpace(normalizedPlayerId)
            && room.Players.Any(player => string.Equals(player.Id, normalizedPlayerId, StringComparison.Ordinal)))
        {
            return normalizedPlayerId;
        }

        throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [nameof(playerId)] = [errorMessage],
        });
    }
}