using Microsoft.EntityFrameworkCore;

namespace TheHat.Backend.Domain;

public sealed class RoomJoinService(
    IApplicationDbContext dbContext,
    IDisplayNameNormalizer displayNameNormalizer,
    IRoomEngine roomEngine) : IRoomJoinService
{
    public async Task<RoomState> JoinRoomAsync(
        string inviteCode,
        string displayName,
        CancellationToken cancellationToken = default)
    {
        var room = await GetRoomByInviteCodeAsync(inviteCode, cancellationToken);

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

        if (room.Settings.PlayerOrderMode == PlayerOrderMode.Random)
        {
            room.ShufflePlayers(Random.Shared);
        }

        room.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return room;
    }

    public async Task<RoomState> RejoinRoomAsync(
        string inviteCode,
        string displayName,
        CancellationToken cancellationToken = default)
    {
        var room = await GetRoomByInviteCodeAsync(inviteCode, cancellationToken);
        var player = ValidateRejoinRoom(room, displayName);

        roomEngine.ReactivatePlayer(room, player.Id, DateTime.UtcNow);
        await dbContext.SaveChangesAsync(cancellationToken);

        return room;
    }

    private async Task<RoomState> GetRoomByInviteCodeAsync(string inviteCode, CancellationToken cancellationToken)
    {
        var normalizedInviteCode = inviteCode?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalizedInviteCode))
        {
            throw new RoomNotFoundException(string.Empty);
        }

        return await dbContext.Rooms.SingleOrDefaultAsync(
                existingRoom => existingRoom.InviteCode == normalizedInviteCode,
                cancellationToken)
            ?? throw new RoomNotFoundException(normalizedInviteCode);
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

    private PlayerState ValidateRejoinRoom(RoomState room, string displayName)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [nameof(displayName)] = string.IsNullOrWhiteSpace(displayName)
                ? ["The display name is required."]
                : [],
        };

        var validationErrors = errors
            .Where(entry => entry.Value.Length > 0)
            .ToDictionary(entry => entry.Key, entry => entry.Value, StringComparer.Ordinal);

        if (validationErrors.Count > 0)
        {
            throw new DomainValidationException(validationErrors);
        }

        var player = roomEngine.FindRejoinCandidate(room, displayName);
        if (player is not null)
        {
            return player;
        }

        throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [nameof(displayName)] = ["No player with this display name was found in the room."],
        });
    }
}