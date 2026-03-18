using Microsoft.EntityFrameworkCore;

namespace TheHat.Backend.Domain;

public sealed class RoomWordSubmissionService(IApplicationDbContext dbContext) : IRoomWordSubmissionService
{
    public async Task<PlayerWordSubmission> GetPlayerWordSubmissionAsync(
        string roomId,
        string playerId,
        CancellationToken cancellationToken = default)
    {
        var room = await GetRoomAsync(roomId, cancellationToken);
        var player = ValidatePlayerCanEditWords(room, playerId);

        return room.GetWordSubmission(player.Id);
    }

    public async Task<RoomState> SubmitWordsAsync(
        string roomId,
        string playerId,
        IReadOnlyList<string>? words,
        CancellationToken cancellationToken = default)
    {
        var room = await GetRoomAsync(roomId, cancellationToken);
        var player = ValidatePlayerCanEditWords(room, playerId);
        var normalizedWords = ValidateWords(room, words);

        room.Words.RemoveAll(word => string.Equals(word.SubmittedByPlayerId, player.Id, StringComparison.Ordinal));

        foreach (var word in normalizedWords)
        {
            room.Words.Add(new WordEntry
            {
                Id = Guid.NewGuid().ToString("N"),
                Text = word,
                SubmittedByPlayerId = player.Id,
            });
        }

        room.UpdatedAtUtc = DateTime.UtcNow;
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

    private static PlayerState ValidatePlayerCanEditWords(RoomState room, string playerId)
    {
        if (room.Phase != RoomPhase.Lobby)
        {
            throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                [nameof(RoomState.Phase)] = ["Words can only be viewed or edited before the game starts."],
            });
        }

        var normalizedPlayerId = playerId?.Trim();
        var player = room.Players.SingleOrDefault(existingPlayer => string.Equals(existingPlayer.Id, normalizedPlayerId, StringComparison.Ordinal));
        if (player is null)
        {
            throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                [nameof(playerId)] = ["The player could not be found in this room."],
            });
        }

        if (!player.IsActive)
        {
            throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                [nameof(playerId)] = ["Inactive players cannot submit words."],
            });
        }

        return player;
    }

    private static IReadOnlyList<string> ValidateWords(RoomState room, IReadOnlyList<string>? words)
    {
        if (words is null)
        {
            throw new DomainValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                [nameof(words)] = ["The submitted words are required."],
            });
        }

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        if (words.Count != room.Settings.WordsPerPlayer)
        {
            errors[nameof(words)] = [$"Exactly {room.Settings.WordsPerPlayer} words are required."];
        }

        var normalizedWords = new List<string>(words.Count);

        for (var index = 0; index < words.Count; index++)
        {
            var normalizedWord = words[index]?.Trim() ?? string.Empty;
            normalizedWords.Add(normalizedWord);

            if (normalizedWord.Length == 0)
            {
                errors[$"words[{index}]"] = ["Words cannot be empty or whitespace."];
            }
        }

        if (errors.Count > 0)
        {
            throw new DomainValidationException(errors);
        }

        return normalizedWords;
    }
}