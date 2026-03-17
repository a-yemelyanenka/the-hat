FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY src/backend/Api/TheHat.Api.csproj src/backend/Api/
COPY src/backend/Contracts/TheHat.Contracts.csproj src/backend/Contracts/
COPY src/backend/Domain/TheHat.Domain.csproj src/backend/Domain/
COPY src/backend/Persistance/TheHat.Persistence.csproj src/backend/Persistance/
COPY src/backend/tests/TheHat.Backend.Tests.csproj src/backend/tests/
RUN dotnet restore src/backend/Api/TheHat.Api.csproj

COPY . .
RUN dotnet publish src/backend/Api/TheHat.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish .
RUN mkdir -p /app/data

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl --fail http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["dotnet", "TheHat.Api.dll"]
