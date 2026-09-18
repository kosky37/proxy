namespace ProxyMockTool.Core.Models;

public sealed class LogQuery
{
    public DateTimeOffset? FromUtc { get; set; }
    public DateTimeOffset? ToUtc { get; set; }
    public string? Path { get; set; }
    public string? SoapAction { get; set; }
    public string? Body { get; set; }
    public RequestMode? Mode { get; set; }
    public int? StatusCode { get; set; }
    public RequestProtocol? Protocol { get; set; }
    /// <summary>Column to sort by, see <see cref="LogSort"/>. Empty means newest first.</summary>
    public string? Sort { get; set; }
    public bool Descending { get; set; }
    public int Skip { get; set; }
    public int Take { get; set; } = 50;
}
