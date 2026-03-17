namespace TheHat.Backend.Domain;

public sealed class DisplayNameNormalizer : IDisplayNameNormalizer
{
    public string Normalize(string displayName)
    {
        ArgumentNullException.ThrowIfNull(displayName);
        return displayName.Trim().ToUpperInvariant();
    }
}
