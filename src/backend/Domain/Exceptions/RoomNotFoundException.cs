namespace TheHat.Backend.Domain;

public sealed class RoomNotFoundException(string inviteCode)
    : Exception($"The room with invite code '{inviteCode}' could not be found.")
{
    public string InviteCode { get; } = inviteCode;
}