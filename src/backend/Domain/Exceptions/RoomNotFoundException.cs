namespace TheHat.Backend.Domain;

public sealed class RoomNotFoundException(string roomIdentifier)
    : Exception($"The room '{roomIdentifier}' could not be found.")
{
    public string RoomIdentifier { get; } = roomIdentifier;
}