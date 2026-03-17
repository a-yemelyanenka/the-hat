namespace TheHat.Backend.Domain;

public interface IRoomEngine
{
    PlayerState? FindRejoinCandidate(RoomState room, string displayName);

    void StartGame(RoomState room, int? seed = null, DateTime? nowUtc = null);

    string DrawWord(RoomState room);

    void RecordCorrectGuess(RoomState room, DateTime? nowUtc = null);

    void ExpireTurn(RoomState room, DateTime? nowUtc = null);

    void StartNextTurn(RoomState room, DateTime? nowUtc = null);

    string FindNextActivePlayerId(RoomState room, string currentPlayerId);
}
