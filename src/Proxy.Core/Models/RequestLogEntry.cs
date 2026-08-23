namespace Proxy.Core.Models;

public sealed class RequestLogEntry
{
    public long Id { get; set; }
    public DateTimeOffset TimestampUtc { get; set; }
    public string Method { get; set; } = "";
    public string Path { get; set; } = "";
    public string? Query { get; set; }
    public RequestProtocol Protocol { get; set; } = RequestProtocol.Rest;
    public string? RequestHeaders { get; set; }
    public string? RequestBody { get; set; }
    public bool RequestBodyTruncated { get; set; }
    public int? StatusCode { get; set; }
    public string? ResponseHeaders { get; set; }
    public string? ResponseBody { get; set; }
    public bool ResponseBodyTruncated { get; set; }
    public long DurationMs { get; set; }
    public RequestMode Mode { get; set; } = RequestMode.Passthrough;
    public string? MockName { get; set; }
    public string? Error { get; set; }
}
