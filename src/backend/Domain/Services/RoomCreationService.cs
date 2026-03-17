using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;

namespace TheHat.Backend.Domain;

public sealed class RoomCreationService(IApplicationDbContext dbContext, IRoomFactory roomFactory) : IRoomCreationService
{
    public async Task<RoomState> CreateRoomAsync(
        string hostDisplayName,
        RoomSettings settings,
        CancellationToken cancellationToken = default)
    {
        var room = roomFactory.CreateRoom(
            hostDisplayName,
            settings,
            nowUtc: DateTime.UtcNow,
            roomId: Guid.NewGuid().ToString("N"),
            hostPlayerId: Guid.NewGuid().ToString("N"),
            inviteCode: await GenerateUniqueInviteCodeAsync(cancellationToken));

        dbContext.Rooms.Add(room);
        await dbContext.SaveChangesAsync(cancellationToken);

        return room;
    }

    private async Task<string> GenerateUniqueInviteCodeAsync(CancellationToken cancellationToken)
    {
        string inviteCode;

        do
        {
            inviteCode = Convert.ToHexString(RandomNumberGenerator.GetBytes(4));
        }
        while (await dbContext.Rooms.AnyAsync(room => room.InviteCode == inviteCode, cancellationToken));

        return inviteCode;
    }
}
