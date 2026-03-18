using Microsoft.EntityFrameworkCore;

namespace TheHat.Backend.Domain;

public sealed class RoomJoinService(
    IApplicationDbContext dbContext,
    IDisplayNameNormalizer displayNameNormalizer) : IRoomJoinService
{
    public async Task<RoomState> JoinRoomAsync(
        string inviteCode,
        string displayName,
        CancellationToken cancellationToken = default)
    {
        var normalizedInviteCode = inviteCode?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalizedInviteCode))
        {
            throw new RoomNotFoundException(string.Empty);
        }

        var room = await dbContext.Rooms.SingleOrDefaultAsync(
                existingRoom => existingRoom.InviteCode == normalizedInviteCode,
                cancellationToken)
            ?? throw new RoomNotFoundException(normalizedInviteCode);

        ValidateJoinRoom(room, displayName);

        var trimmedDisplayName = displayName.Trim();
        var normalizedDisplayName = displayNameNormalizer.Normalize(trimmedDisplayName);
        var nextOrderIndex = room.Players.Count == 0
            ? 0
            : room.Players.Max(player => player.OrderIndex) + 1;

        room.Players.Add(new PlayerState
        {
            Id = Guid.NewGuid().ToString("N"),
            DisplayName = trimmedDisplayName,
            NormalizedDisplayName = normalizedDisplayName,
            IsHost = false,
            IsActive = true,
            OrderIndex = nextOrderIndex,
            Score = 0,
        });

        room.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return room;
    }

    private void ValidateJoinRoom(RoomState room, string displayName)
    {
        var normalizedDisplayName = string.IsNullOrWhiteSpace(displayName)
            ? string.Empty
            : displayNameNormalizer.Normalize(displayName);

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [nameof(displayName)] = string.IsNullOrWhiteSpace(displayName)
                ? ["The display name is required."]
                : room.Players.Any(player => player.NormalizedDisplayName == normalizedDisplayName)
                    ? ["This display name is already taken in the room."]
                    : [],
        };

        var validationErrors = errors
            .Where(entry => entry.Value.Length > 0)
            .ToDictionary(entry => entry.Key, entry => entry.Value, StringComparer.Ordinal);

        if (validationErrors.Count > 0)
        {
            throw new DomainValidationException(validationErrors);
        }
    }
}