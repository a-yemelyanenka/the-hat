using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TheHat.Backend.Domain;
using TheHat.Backend.Persistence;

var builder = WebApplication.CreateBuilder(args);

var sqliteConnectionString = ResolveSqliteConnectionString(builder.Configuration, builder.Environment);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSingleton<RoomEngine>();
builder.Services.AddDbContext<TheHatDbContext>(options => options.UseSqlite(sqliteConnectionString));
builder.Services.AddScoped<IRoomStore, SqliteRoomStore>();
builder.Services.AddHealthChecks().AddDbContextCheck<TheHatDbContext>(name: "sqlite");

var app = builder.Build();

await EnsureDatabaseCreatedAsync(app.Services);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();

static string ResolveSqliteConnectionString(IConfiguration configuration, IWebHostEnvironment environment)
{
    var configuredConnectionString = configuration.GetConnectionString("TheHat")
        ?? "Data Source=App_Data/thehat.db";

    var connectionStringBuilder = new SqliteConnectionStringBuilder(configuredConnectionString);
    if (string.IsNullOrWhiteSpace(connectionStringBuilder.DataSource))
    {
        throw new InvalidOperationException("The SQLite connection string must define a data source.");
    }

    if (!Path.IsPathRooted(connectionStringBuilder.DataSource))
    {
        connectionStringBuilder.DataSource = Path.Combine(environment.ContentRootPath, connectionStringBuilder.DataSource);
    }

    var directoryPath = Path.GetDirectoryName(connectionStringBuilder.DataSource);
    if (!string.IsNullOrWhiteSpace(directoryPath))
    {
        Directory.CreateDirectory(directoryPath);
    }

    return connectionStringBuilder.ToString();
}

static async Task EnsureDatabaseCreatedAsync(IServiceProvider services)
{
    await using var scope = services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<TheHatDbContext>();
    await dbContext.Database.EnsureCreatedAsync();
}

public partial class Program;
