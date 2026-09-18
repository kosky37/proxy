namespace ProxyMockTool.Core.Models;

/// <summary>
/// Column keys the log list can be sorted by. The names match the keys the admin UI
/// sends, so the API and the UI stay in step.
/// </summary>
public static class LogSort
{
    public const string Time = "time";
    public const string Method = "method";
    public const string Path = "path";
    public const string Protocol = "protocol";
    public const string Mode = "mode";
    public const string Status = "status";
    public const string Duration = "duration";
    /// <summary>Groups entries by proxy; only the merged (all proxies) list understands it.</summary>
    public const string Proxy = "proxy";

    /// <summary>Anything unknown falls back to the default list order: newest first.</summary>
    public static string Normalize(string? sort) => (sort ?? "").Trim().ToLowerInvariant() switch
    {
        Method => Method,
        Path => Path,
        Protocol => Protocol,
        Mode => Mode,
        Status => Status,
        Duration => Duration,
        Proxy => Proxy,
        _ => Time
    };

    /// <summary>Without an explicit sort the list is newest first.</summary>
    public static bool Descending(string? sort, bool descending) =>
        string.IsNullOrWhiteSpace(sort) || descending;
}
