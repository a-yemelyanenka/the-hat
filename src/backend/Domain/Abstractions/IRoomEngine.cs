namespace TheHat.Backend.Domain;

public interface IRoomEngine
{
    PlayerState? FindRejoinCandidate(RoomState room, string displayName);

    PlayerGameplayState CreateGameplayState(RoomState room, string playerId, DateTime? nowUtc = null);

    bool ReactivatePlayer(RoomState room, string playerId, DateTime? nowUtc = null);

    bool DeactivatePlayer(RoomState room, string playerId, DateTime? nowUtc = null);

    void StartGame(RoomState room, int? seed = null, DateTime? nowUtc = null);

    void StartTurn(RoomState room, DateTime? nowUtc = null);

    bool AdvanceState(RoomState room, DateTime? nowUtc = null);

    string DrawWord(RoomState room);

    void RecordCorrectGuess(RoomState room, DateTime? nowUtc = null);

    void EndTurn(RoomState room, DateTime? nowUtc = null);

    void ExpireTurn(RoomState room, DateTime? nowUtc = null);

    void PauseGame(RoomState room, DateTime? nowUtc = null);

    void ResumeGame(RoomState room, DateTime? nowUtc = null);

    void ContinueToNextRound(RoomState room, int? seed = null, DateTime? nowUtc = null);

    void StartNextTurn(RoomState room, DateTime? nowUtc = null);

    string FindNextActivePlayerId(RoomState room, string currentPlayerId);

    int? GetRemainingTurnSeconds(RoomState room, DateTime? nowUtc = null);
}
