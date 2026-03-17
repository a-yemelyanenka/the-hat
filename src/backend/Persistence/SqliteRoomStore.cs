using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using TheHat.Backend.Domain;

namespace TheHat.Backend.Persistence;

public sealed class SqliteRoomStore(TheHatDbContext dbContext) : IRoomStore
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
        Converters = { new JsonStringEnumConverter() },
    };

    public async Task SaveAsync(RoomState room, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(room);

        var document = await dbContext.Rooms
            .SingleOrDefaultAsync(existing => existing.RoomId == room.RoomId, cancellationToken);

        var payloadJson = JsonSerializer.Serialize(room, SerializerOptions);
        if (document is null)
        {
            document = new RoomDocument
            {
                RoomId = room.RoomId,
                InviteCode = room.InviteCode,
                Phase = room.Phase,
                PayloadJson = payloadJson,
                UpdatedAtUtc = room.UpdatedAtUtc,
            };

            dbContext.Rooms.Add(document);
        }
        else
        {
            document.InviteCode = room.InviteCode;
            document.Phase = room.Phase;
            document.PayloadJson = payloadJson;
            document.UpdatedAtUtc = room.UpdatedAtUtc;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<RoomState?> LoadAsync(string roomId, CancellationToken cancellationToken = default)
    {
        var document = await dbContext.Rooms
            .AsNoTracking()
            .SingleOrDefaultAsync(existing => existing.RoomId == roomId, cancellationToken);

        return document is null
            ? null
            : JsonSerializer.Deserialize<RoomState>(document.PayloadJson, SerializerOptions);
    }

    public async Task<RoomState?> LoadByInviteCodeAsync(string inviteCode, CancellationToken cancellationToken = default)
    {
        var document = await dbContext.Rooms
            .AsNoTracking()
            .SingleOrDefaultAsync(existing => existing.InviteCode == inviteCode, cancellationToken);

        return document is null
            ? null
            : JsonSerializer.Deserialize<RoomState>(document.PayloadJson, SerializerOptions);
    }
}
