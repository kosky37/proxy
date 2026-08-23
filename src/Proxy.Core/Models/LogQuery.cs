namespace Proxy.Core.Models;

public sealed class LogQuery
{
    public DateTimeOffset? FromUtc { get; set; }
    public DateTimeOffset? ToUtc { get; set; }
    public string? Path { get; set; }
    public RequestMode? Mode { get; set; }
    public int? StatusCode { get; set; }
    public RequestProtocol? Protocol { get; set; }
    public int Skip { get; set; }
    public int Take { get; set; } = 50;
}
