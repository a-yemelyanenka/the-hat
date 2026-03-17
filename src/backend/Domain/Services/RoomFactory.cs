namespace TheHat.Backend.Domain;

public sealed class RoomFactory(IDisplayNameNormalizer displayNameNormalizer) : IRoomFactory
{
    public void ValidateCreateRoom(string hostDisplayName, RoomSettings settings)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [nameof(hostDisplayName)] = string.IsNullOrWhiteSpace(hostDisplayName)
                ? ["The host display name is required."]
                : [],
            [$"{nameof(settings)}.{nameof(RoomSettings.WordsPerPlayer)}"] = settings.WordsPerPlayer <= 0
                ? ["Words per player must be greater than zero."]
                : [],
            [$"{nameof(settings)}.{nameof(RoomSettings.TurnDurationSeconds)}"] = settings.TurnDurationSeconds <= 0
                ? ["Turn duration must be greater than zero."]
                : [],
            [$"{nameof(settings)}.{nameof(RoomSettings.PlayerOrderMode)}"] = !Enum.IsDefined(settings.PlayerOrderMode)
                ? ["A supported player order mode is required."]
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

    public RoomState CreateRoom(
        string hostDisplayName,
        RoomSettings settings,
        DateTime? nowUtc = null,
        string? roomId = null,
        string? hostPlayerId = null,
        string? inviteCode = null)
    {
        ArgumentNullException.ThrowIfNull(settings);
        ValidateCreateRoom(hostDisplayName, settings);

        var timestamp = nowUtc ?? DateTime.UtcNow;
        var trimmedHostDisplayName = hostDisplayName.Trim();
        var resolvedRoomId = string.IsNullOrWhiteSpace(roomId) ? Guid.NewGuid().ToString("N") : roomId;
        var resolvedHostPlayerId = string.IsNullOrWhiteSpace(hostPlayerId) ? Guid.NewGuid().ToString("N") : hostPlayerId;
        var resolvedInviteCode = string.IsNullOrWhiteSpace(inviteCode) ? Guid.NewGuid().ToString("N") : inviteCode;

        return new RoomState
        {
            RoomId = resolvedRoomId,
            InviteCode = resolvedInviteCode,
            HostPlayerId = resolvedHostPlayerId,
            Phase = RoomPhase.Lobby,
            Settings = new RoomSettings
            {
                WordsPerPlayer = settings.WordsPerPlayer,
                TurnDurationSeconds = settings.TurnDurationSeconds,
                PlayerOrderMode = settings.PlayerOrderMode,
            },
            Players =
            [
                new PlayerState
                {
                    Id = resolvedHostPlayerId,
                    DisplayName = trimmedHostDisplayName,
                    NormalizedDisplayName = displayNameNormalizer.Normalize(trimmedHostDisplayName),
                    IsHost = true,
                    IsActive = true,
                    OrderIndex = 0,
                    Score = 0,
                },
            ],
            CreatedAtUtc = timestamp,
            UpdatedAtUtc = timestamp,
        };
    }
}
