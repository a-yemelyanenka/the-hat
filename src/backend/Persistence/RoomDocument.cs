using TheHat.Backend.Domain;

namespace TheHat.Backend.Persistence;

public sealed class RoomDocument
{
    public string RoomId { get; set; } = string.Empty;

    public string InviteCode { get; set; } = string.Empty;

    public RoomPhase Phase { get; set; }

    public string PayloadJson { get; set; } = string.Empty;

    public DateTime UpdatedAtUtc { get; set; }
}
