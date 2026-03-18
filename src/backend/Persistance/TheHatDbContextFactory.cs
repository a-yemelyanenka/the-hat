using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TheHat.Backend.Persistence;

public sealed class TheHatDbContextFactory : IDesignTimeDbContextFactory<TheHatDbContext>
{
    public TheHatDbContext CreateDbContext(string[] args)
    {
        var dataSource = Path.Combine(AppContext.BaseDirectory, "App_Data", "thehat-design.db");
        Directory.CreateDirectory(Path.GetDirectoryName(dataSource)!);

        var connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = dataSource,
        }.ToString();

        var options = new DbContextOptionsBuilder<TheHatDbContext>()
            .UseSqlite(connectionString)
            .Options;

        return new TheHatDbContext(options);
    }
}