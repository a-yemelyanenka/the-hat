using Microsoft.AspNetCore.Mvc;
using System.Text.Json.Serialization;
using TheHat.Backend.Contracts;

namespace TheHat.Backend.Tests;

internal sealed class LocalizedValidationProblemDetails : ValidationProblemDetails
{
    [JsonPropertyName("messageTitle")]
    public LocalizedMessageDto? MessageTitle { get; init; }

    [JsonPropertyName("messageErrors")]
    public Dictionary<string, LocalizedMessageDto[]>? MessageErrors { get; init; }
}
