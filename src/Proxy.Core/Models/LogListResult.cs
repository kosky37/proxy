namespace Proxy.Core.Models;

public sealed class LogListResult
{
    public required IReadOnlyList<RequestLogEntry> Items { get; init; }
    public required int Total { get; init; }
}
