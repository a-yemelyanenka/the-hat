using Microsoft.Extensions.DependencyInjection;

namespace TheHat.Backend.Domain;

public static class DependencyInjection
{
    public static IServiceCollection AddDomainServices(this IServiceCollection services)
    {
        services.AddSingleton<IDisplayNameNormalizer, DisplayNameNormalizer>();
        services.AddSingleton<IRoomEngine, RoomEngine>();
        services.AddSingleton<IRoomFactory, RoomFactory>();
        services.AddScoped<IRoomCreationService, RoomCreationService>();

        return services;
    }
}
