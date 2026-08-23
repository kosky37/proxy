using Proxy.Core.Models;

namespace Proxy.Infrastructure.Logging;

public sealed class RequestLogRecord
{
    public long Id { get; set; }
    public DateTime TimestampUtc { get; set; }
    public string Method { get; set; } = "";
    public string Path { get; set; } = "";
    public string? Query { get; set; }
    public string Protocol { get; set; } = nameof(RequestProtocol.Rest);
    public string? RequestHeaders { get; set; }
    public string? RequestBody { get; set; }
    public bool RequestBodyTruncated { get; set; }
    public int RequestBodyOriginalBytes { get; set; }
    public int? StatusCode { get; set; }
    public string? ResponseHeaders { get; set; }
    public string? ResponseBody { get; set; }
    public bool ResponseBodyTruncated { get; set; }
    public int ResponseBodyOriginalBytes { get; set; }
    public long DurationMs { get; set; }
    public string Mode { get; set; } = nameof(RequestMode.Passthrough);
    public string? MockName { get; set; }
    public string? Error { get; set; }

    public RequestLogEntry ToEntry() => new()
    {
        Id = Id,
        TimestampUtc = new DateTimeOffset(DateTime.SpecifyKind(TimestampUtc, DateTimeKind.Unspecified), TimeSpan.Zero),
        Method = Method,
        Path = Path,
        Query = Query,
        Protocol = Enum.TryParse<RequestProtocol>(Protocol, true, out var protocol) ? protocol : RequestProtocol.Rest,
        RequestHeaders = RequestHeaders,
        RequestBody = RequestBody,
        RequestBodyTruncated = RequestBodyTruncated,
        RequestBodyOriginalBytes = RequestBodyOriginalBytes,
        StatusCode = StatusCode,
        ResponseHeaders = ResponseHeaders,
        ResponseBody = ResponseBody,
        ResponseBodyTruncated = ResponseBodyTruncated,
        ResponseBodyOriginalBytes = ResponseBodyOriginalBytes,
        DurationMs = DurationMs,
        Mode = Enum.TryParse<RequestMode>(Mode, true, out var mode) ? mode : RequestMode.Passthrough,
        MockName = MockName,
        Error = Error
    };

    public static RequestLogRecord FromEntry(RequestLogEntry entry) => new()
    {
        Id = entry.Id,
        TimestampUtc = DateTime.SpecifyKind(entry.TimestampUtc.UtcDateTime, DateTimeKind.Unspecified),
        Method = entry.Method,
        Path = entry.Path,
        Query = entry.Query,
        Protocol = entry.Protocol.ToString(),
        RequestHeaders = entry.RequestHeaders,
        RequestBody = entry.RequestBody,
        RequestBodyTruncated = entry.RequestBodyTruncated,
        RequestBodyOriginalBytes = entry.RequestBodyOriginalBytes,
        StatusCode = entry.StatusCode,
        ResponseHeaders = entry.ResponseHeaders,
        ResponseBody = entry.ResponseBody,
        ResponseBodyTruncated = entry.ResponseBodyTruncated,
        ResponseBodyOriginalBytes = entry.ResponseBodyOriginalBytes,
        DurationMs = entry.DurationMs,
        Mode = entry.Mode.ToString(),
        MockName = entry.MockName,
        Error = entry.Error
    };
}
