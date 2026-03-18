using Microsoft.EntityFrameworkCore;

namespace TheHat.Backend.Domain;

public sealed class RoomLobbyService(
    IApplicationDbContext dbContext,
    IRoomFactory roomFactory,
    IRoomEngine roomEngine) : IRoomLobbyService
{
    public async Task<RoomState> GetRoomAsync(string roomId, CancellationToken cancellationToken = default)
    {
        var normalizedRoomId = roomId?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedRoomId))
        {
            throw new RoomNotFoundException(string.Empty);
        }

        return await dbContext.Rooms.SingleOrDefaultAsync(room => room.RoomId == normalizedRoomId, cancellationToken)
            ?? throw new RoomNotFoundException(normalizedRoomId);
    }

    public async Task<RoomState> UpdateRoomSettingsAsync(
        string roomId,
        string hostPlayerId,
        RoomSettings settings,
        IReadOnlyList<string>? orderedPlayerIds,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(settings);

        var room = await GetRoomAsync(roomId, cancellationToken);

        ValidateHost(room, hostPlayerId, "Only the host can update room settings.");
        ValidateLobbyPhase(room, "Room settings can only be changed before the game starts.");
        roomFactory.ValidateSettings(settings);

        if (settings.PlayerOrderMode == PlayerOrderMode.Manual)
        {
            if (orderedPlayerIds is not null)
            {
                room.ApplyPlayerOrder(orderedPlayerIds);
            }
        }
        else if (orderedPlayerIds is not null)
        {
            throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                [nameof(orderedPlayerIds)] = ["Manual player order can only be supplied when manual ordering is selected."],
            });
        }

        if (room.Settings.PlayerOrderMode != PlayerOrderMode.Random
            && settings.PlayerOrderMode == PlayerOrderMode.Random)
        {
            room.ShufflePlayers(Random.Shared);
        }

        room.Settings = new RoomSettings
        {
            WordsPerPlayer = settings.WordsPerPlayer,
            TurnDurationSeconds = settings.TurnDurationSeconds,
            PlayerOrderMode = settings.PlayerOrderMode,
        };

        room.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return room;
    }

    public async Task<RoomState> StartGameAsync(
        string roomId,
        string hostPlayerId,
        CancellationToken cancellationToken = default)
    {
        var room = await GetRoomAsync(roomId, cancellationToken);

        ValidateHost(room, hostPlayerId, "Only the host can start the game.");
        ValidateLobbyPhase(room, "The game has already started.");

        var readiness = room.GetLobbyReadiness();
        if (!readiness.CanStart)
        {
            throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["startGame"] = readiness.BlockingReasons.ToArray(),
            });
        }

        roomEngine.StartGame(room);
        await dbContext.SaveChangesAsync(cancellationToken);

        return room;
    }

    private static void ValidateHost(RoomState room, string hostPlayerId, string errorMessage)
    {
        var normalizedHostPlayerId = hostPlayerId?.Trim();
        if (string.Equals(room.HostPlayerId, normalizedHostPlayerId, StringComparison.Ordinal))
        {
            return;
        }

        throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [nameof(hostPlayerId)] = [errorMessage],
        });
    }

    private static void ValidateLobbyPhase(RoomState room, string errorMessage)
    {
        if (room.Phase == RoomPhase.Lobby)
        {
            return;
        }

        throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [nameof(RoomState.Phase)] = [errorMessage],
        });
    }
}