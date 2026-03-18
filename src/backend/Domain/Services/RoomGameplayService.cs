using Microsoft.EntityFrameworkCore;

namespace TheHat.Backend.Domain;

public sealed class RoomGameplayService(
    IApplicationDbContext dbContext,
    IRoomEngine roomEngine) : IRoomGameplayService
{
    public async Task<PlayerGameplayState> GetGameplayViewAsync(
        string roomId,
        string playerId,
        CancellationToken cancellationToken = default)
    {
        var room = await GetRoomAsync(roomId, cancellationToken);
        var normalizedPlayerId = ValidatePlayer(room, playerId, "A valid player identifier is required to load gameplay.");

        if (roomEngine.AdvanceState(room))
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var currentTurn = room.CurrentTurn;
        var isCurrentPlayerExplainer = string.Equals(currentTurn?.ExplainerPlayerId, normalizedPlayerId, StringComparison.Ordinal);
        var isCurrentPlayerGuesser = string.Equals(currentTurn?.GuesserPlayerId, normalizedPlayerId, StringComparison.Ordinal);
        var activeWordText = isCurrentPlayerExplainer && !string.IsNullOrWhiteSpace(currentTurn?.ActiveWordId)
            ? room.Words.Single(word => word.Id == currentTurn.ActiveWordId).Text
            : null;

        return new PlayerGameplayState
        {
            Room = room,
            PlayerId = normalizedPlayerId,
            CurrentRule = room.TryGetCurrentRound()?.Rule,
            ActiveWordText = activeWordText,
            RemainingTurnSeconds = roomEngine.GetRemainingTurnSeconds(room),
            IsCurrentPlayerExplainer = isCurrentPlayerExplainer,
            IsCurrentPlayerGuesser = isCurrentPlayerGuesser,
        };
    }

    public async Task<RoomState> ConfirmGuessAsync(
        string roomId,
        string playerId,
        CancellationToken cancellationToken = default)
    {
        var room = await GetRoomAsync(roomId, cancellationToken);
        var normalizedPlayerId = ValidatePlayer(room, playerId, "A valid player identifier is required to confirm a guess.");

        if (roomEngine.AdvanceState(room))
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        ValidateActiveExplainer(room, normalizedPlayerId);

        try
        {
            roomEngine.RecordCorrectGuess(room);
        }
        catch (InvalidOperationException exception)
        {
            throw CreateGameplayValidationException(exception.Message);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return room;
    }

    public async Task<RoomState> PauseGameAsync(
        string roomId,
        string hostPlayerId,
        CancellationToken cancellationToken = default)
    {
        var room = await GetRoomAsync(roomId, cancellationToken);
        ValidateHost(room, hostPlayerId, "Only the host can pause the game.");

        if (roomEngine.AdvanceState(room))
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        try
        {
            roomEngine.PauseGame(room);
        }
        catch (InvalidOperationException exception)
        {
            throw CreateGameplayValidationException(exception.Message);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return room;
    }

    public async Task<RoomState> ResumeGameAsync(
        string roomId,
        string hostPlayerId,
        CancellationToken cancellationToken = default)
    {
        var room = await GetRoomAsync(roomId, cancellationToken);
        ValidateHost(room, hostPlayerId, "Only the host can resume the game.");

        try
        {
            roomEngine.ResumeGame(room);
        }
        catch (InvalidOperationException exception)
        {
            throw CreateGameplayValidationException(exception.Message);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return room;
    }

    public async Task<RoomState> ContinueToNextRoundAsync(
        string roomId,
        string hostPlayerId,
        CancellationToken cancellationToken = default)
    {
        var room = await GetRoomAsync(roomId, cancellationToken);
        ValidateHost(room, hostPlayerId, "Only the host can continue to the next round.");

        try
        {
            roomEngine.ContinueToNextRound(room);
        }
        catch (InvalidOperationException exception)
        {
            throw CreateGameplayValidationException(exception.Message);
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

    private static void ValidateActiveExplainer(RoomState room, string playerId)
    {
        if (room.Phase == RoomPhase.InProgress
            && string.Equals(room.CurrentTurn?.ExplainerPlayerId, playerId, StringComparison.Ordinal))
        {
            return;
        }

        throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [nameof(playerId)] = ["Only the active explainer can confirm a guessed word."],
        });
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

    private static DomainValidationException CreateGameplayValidationException(string message)
        => new(new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["gameplay"] = [message],
        });
}