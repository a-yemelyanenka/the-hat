using Microsoft.EntityFrameworkCore;

namespace TheHat.Backend.Domain;

public interface IApplicationDbContext
{
    DbSet<RoomState> Rooms { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
