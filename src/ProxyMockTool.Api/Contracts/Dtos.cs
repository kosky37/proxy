using ProxyMockTool.Core.Matching;
using ProxyMockTool.Core.Models;

namespace ProxyMockTool.Api.Contracts;

public sealed class ProxyListItemDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public bool Enabled { get; set; }
    public required string ListenUrl { get; set; }
    public string? ListenPathPrefix { get; set; }
    public required string DestinationAddress { get; set; }
    public bool MocksEnabled { get; set; }
    public int MockCount { get; set; }
    public int EnabledMockCount { get; set; }
}

public sealed class ProxyDetailDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public bool Enabled { get; set; }
    public required ListenDto Listen { get; set; }
    public required DestinationDto Destination { get; set; }
    public bool MocksEnabled { get; set; }
    public int PassthroughDelayMs { get; set; }
    public int? LogRetentionDays { get; set; }
    public int? BodyLogLimitBytes { get; set; }
}

public sealed class ListenDto
{
    public required string Url { get; set; }
    public string? PathPrefix { get; set; }
    public List<string>? Hosts { get; set; }
    public string? ServerCertificateId { get; set; }
}

public sealed class DestinationDto
{
    public required string Address { get; set; }
    public string? ClientCertificateId { get; set; }
    public bool AcceptAnyServerCertificate { get; set; }
}

public sealed class CertificateDto
{
    public required string Name { get; set; }
    public required string FileName { get; set; }
    public required string Type { get; set; }
    public string Source { get; set; } = "file";
    public string? PfxPath { get; set; }
    public string? Password { get; set; }
    public string? StoreName { get; set; }
    public string? StoreLocation { get; set; }
    public string? Thumbprint { get; set; }
}

public sealed class WindowsStoreCertificateDto
{
    public required string Thumbprint { get; set; }
    public required string Subject { get; set; }
    public string? FriendlyName { get; set; }
    public DateTime NotBeforeUtc { get; set; }
    public DateTime NotAfterUtc { get; set; }
    public bool HasPrivateKey { get; set; }
}

public sealed class UploadedCertificateFileDto
{
    public string? PfxPath { get; set; }
}

public sealed class UpsertProxyRequest
{
    public string? Id { get; set; }
    public required string Name { get; set; }
    public bool Enabled { get; set; } = true;
    public required ListenDto Listen { get; set; }
    public required DestinationDto Destination { get; set; }
    public bool MocksEnabled { get; set; } = true;
    public int PassthroughDelayMs { get; set; }
    public int? LogRetentionDays { get; set; }
    public int? BodyLogLimitBytes { get; set; }
}

public sealed class MocksEnabledRequest
{
    public bool MocksEnabled { get; set; }
}

public sealed class MockDto
{
    public required string Name { get; set; }
    public required string FileName { get; set; }
    public bool Enabled { get; set; }
    public required string Type { get; set; }
    public MockMatchDto Match { get; set; } = new();
    public MockResponseDto Response { get; set; } = new();
}

public sealed class MockMatchDto
{
    public List<string>? Methods { get; set; }
    public string? Path { get; set; }
    public string PathMode { get; set; } = "exact";
    public Dictionary<string, string>? Query { get; set; }
    public Dictionary<string, string>? Headers { get; set; }
    public string? BodyContains { get; set; }
    public string? BodyRegex { get; set; }
    public string? JsonPath { get; set; }
    public string? JsonPathEquals { get; set; }
    public string? SoapAction { get; set; }
    public string? Operation { get; set; }
    public string? XPath { get; set; }
}

public sealed class MockResponseDto
{
    public int StatusCode { get; set; } = 200;
    public string? ContentType { get; set; }
    public Dictionary<string, string>? Headers { get; set; }
    public string? Body { get; set; }
    public string? BodyFile { get; set; }
    public int DelayMs { get; set; }
    public bool Block { get; set; }
}

public sealed class IgnoredPathDto
{
    public required string Name { get; set; }
    public required string FileName { get; set; }
    public required string Path { get; set; }
    public string PathMode { get; set; } = "exact";
    public List<string>? Methods { get; set; }
}

public sealed class MockSetDto
{
    public required string Name { get; set; }
    public required string FileName { get; set; }
    public List<string> MockNames { get; set; } = [];
}

public sealed class LogListDto
{
    public required IReadOnlyList<LogListItemDto> Items { get; set; }
    public required int Total { get; set; }
}

public class LogListItemDto
{
    public long Id { get; set; }
    public string? ProxyId { get; set; }
    public string? ProxyName { get; set; }
    public DateTimeOffset TimestampUtc { get; set; }
    public required string Method { get; set; }
    public required string Path { get; set; }
    public string? Query { get; set; }
    public required string Protocol { get; set; }
    public int? StatusCode { get; set; }
    public long DurationMs { get; set; }
    public required string Mode { get; set; }
    public string? MockName { get; set; }
    public string? Error { get; set; }
    public string? ContentType { get; set; }
    public string? SoapAction { get; set; }
    public int RequestBytes { get; set; }
    public int ResponseBytes { get; set; }
    public bool RequestBodyTruncated { get; set; }
    public bool ResponseBodyTruncated { get; set; }
}

public sealed class LogDetailDto : LogListItemDto
{
    public string? RequestHeaders { get; set; }
    public string? RequestBody { get; set; }
    public string? ResponseHeaders { get; set; }
    public string? ResponseBody { get; set; }
}

public sealed class LogStorageDto
{
    public long DatabaseBytes { get; set; }
    public long TotalBytes { get; set; }
    public int EntryCount { get; set; }
}

public sealed class LogTimelineDto
{
    public DateTimeOffset FromUtc { get; set; }
    public DateTimeOffset ToUtc { get; set; }
    public int BucketSeconds { get; set; }
    public required IReadOnlyList<LogTimelineBucketDto> Buckets { get; set; }
}

public sealed class LogTimelineBucketDto
{
    public DateTimeOffset StartUtc { get; set; }
    public int Count { get; set; }
    public int MockCount { get; set; }
    public int ManualCount { get; set; }
    public int Status2xx { get; set; }
    public int Status3xx { get; set; }
    public int Status4xx { get; set; }
    public int Status5xx { get; set; }
    public int OtherCount { get; set; }
}

public sealed class LogClearResultDto
{
    public int Deleted { get; set; }
}

public sealed class HealthDto
{
    public required string Status { get; set; }
}

public sealed class ManualSendRequestDto
{
    public required string Method { get; set; }
    public required string Path { get; set; }
    public string? Query { get; set; }
    public Dictionary<string, string>? Headers { get; set; }
    public string? Body { get; set; }
    public string Protocol { get; set; } = "rest";
}

public static class DtoMapper
{
    public static ProxyListItemDto ToListItem(LoadedProxy proxy) => new()
    {
        Id = proxy.Id,
        Name = proxy.Definition.Name,
        Enabled = proxy.Definition.Enabled,
        ListenUrl = proxy.Definition.Listen.Url,
        ListenPathPrefix = ListenPath.EffectivePrefix(proxy.Definition.Listen),
        DestinationAddress = proxy.Definition.Destination.Address,
        MocksEnabled = proxy.Definition.MocksEnabled,
        MockCount = proxy.Mocks.Count,
        EnabledMockCount = proxy.Mocks.Count(item => item.Enabled)
    };

    public static ProxyDetailDto ToDetail(LoadedProxy proxy) => new()
    {
        Id = proxy.Id,
        Name = proxy.Definition.Name,
        Enabled = proxy.Definition.Enabled,
        Listen = ToDto(proxy.Definition.Listen),
        Destination = ToDto(proxy.Definition.Destination),
        MocksEnabled = proxy.Definition.MocksEnabled,
        PassthroughDelayMs = proxy.Definition.PassthroughDelayMs,
        LogRetentionDays = proxy.Definition.LogRetentionDays,
        BodyLogLimitBytes = proxy.Definition.BodyLogLimitBytes
    };

    public static ProxyDefinition ToDefinition(UpsertProxyRequest request) => new()
    {
        Name = request.Name,
        Enabled = request.Enabled,
        Listen = ListenPath.Normalize(new ListenConfig
        {
            Url = request.Listen.Url,
            PathPrefix = request.Listen.PathPrefix,
            Hosts = request.Listen.Hosts,
            ServerCertificateId = request.Listen.ServerCertificateId
        }),
        Destination = new DestinationConfig
        {
            Address = request.Destination.Address,
            ClientCertificateId = request.Destination.ClientCertificateId,
            AcceptAnyServerCertificate = request.Destination.AcceptAnyServerCertificate
        },
        MocksEnabled = request.MocksEnabled,
        PassthroughDelayMs = request.PassthroughDelayMs,
        LogRetentionDays = request.LogRetentionDays,
        BodyLogLimitBytes = request.BodyLogLimitBytes
    };

    public static MockDto ToDto(MockDefinition mock) => new()
    {
        Name = mock.Name,
        FileName = mock.FileName,
        Enabled = mock.Enabled,
        Type = mock.Type.ToString().ToLowerInvariant(),
        Match = ToDto(mock.Match),
        Response = ToDto(mock.Response)
    };

    public static MockDefinition ToModel(MockDto dto)
    {
        var type = Enum.TryParse<MockType>(dto.Type, true, out var parsed) ? parsed : MockType.Rest;
        var match = ToModel(dto.Match);
        if (type == MockType.Soap)
        {
            match.Path = null;
            match.PathMode = PathMatchMode.Exact;
            match.Methods = null;
            match.Query = null;
        }

        return new MockDefinition
        {
            Type = type,
            Name = dto.Name,
            FileName = dto.FileName,
            Enabled = dto.Enabled,
            Match = match,
            Response = ToModel(dto.Response)
        };
    }

    public static LogListItemDto ToListItem(RequestLogEntry entry, string? proxyId = null, string? proxyName = null) => new()
    {
        Id = entry.Id,
        ProxyId = proxyId,
        ProxyName = proxyName,
        TimestampUtc = entry.TimestampUtc,
        Method = entry.Method,
        Path = entry.Path,
        Query = entry.Query,
        Protocol = ContentKind.Normalize(entry.Protocol).ToString().ToLowerInvariant(),
        StatusCode = entry.StatusCode,
        DurationMs = entry.DurationMs,
        Mode = entry.Mode.ToString().ToLowerInvariant(),
        MockName = entry.MockName,
        Error = entry.Error,
        ContentType = LogSummary.ContentType(entry),
        SoapAction = LogSummary.SoapAction(entry),
        RequestBytes = LogSummary.RequestBytes(entry),
        ResponseBytes = LogSummary.ResponseBytes(entry),
        RequestBodyTruncated = entry.RequestBodyTruncated,
        ResponseBodyTruncated = entry.ResponseBodyTruncated
    };

    public static LogDetailDto ToDetail(RequestLogEntry entry, string? proxyId = null, string? proxyName = null) => new()
    {
        Id = entry.Id,
        ProxyId = proxyId,
        ProxyName = proxyName,
        TimestampUtc = entry.TimestampUtc,
        Method = entry.Method,
        Path = entry.Path,
        Query = entry.Query,
        Protocol = ContentKind.Normalize(entry.Protocol).ToString().ToLowerInvariant(),
        StatusCode = entry.StatusCode,
        DurationMs = entry.DurationMs,
        Mode = entry.Mode.ToString().ToLowerInvariant(),
        MockName = entry.MockName,
        Error = entry.Error,
        ContentType = LogSummary.ContentType(entry),
        SoapAction = LogSummary.SoapAction(entry),
        RequestBytes = LogSummary.RequestBytes(entry),
        ResponseBytes = LogSummary.ResponseBytes(entry),
        RequestHeaders = entry.RequestHeaders,
        RequestBody = entry.RequestBody,
        RequestBodyTruncated = entry.RequestBodyTruncated,
        ResponseHeaders = entry.ResponseHeaders,
        ResponseBody = entry.ResponseBody,
        ResponseBodyTruncated = entry.ResponseBodyTruncated
    };

    public static LogStorageDto ToDto(LogStorageInfo storage) => new()
    {
        DatabaseBytes = storage.DatabaseBytes,
        TotalBytes = storage.TotalBytes,
        EntryCount = storage.EntryCount
    };

    public static LogTimelineDto ToDto(LogTimeline timeline) => new()
    {
        FromUtc = timeline.FromUtc,
        ToUtc = timeline.ToUtc,
        BucketSeconds = timeline.BucketSeconds,
        Buckets = timeline.Buckets.Select(item => new LogTimelineBucketDto
        {
            StartUtc = item.StartUtc,
            Count = item.Count,
            MockCount = item.MockCount,
            ManualCount = item.ManualCount,
            Status2xx = item.Status2xx,
            Status3xx = item.Status3xx,
            Status4xx = item.Status4xx,
            Status5xx = item.Status5xx,
            OtherCount = item.OtherCount
        }).ToList()
    };

    private static ListenDto ToDto(ListenConfig listen) => new()
    {
        Url = listen.Url,
        PathPrefix = listen.PathPrefix,
        Hosts = listen.Hosts,
        ServerCertificateId = listen.ServerCertificateId
    };

    private static DestinationDto ToDto(DestinationConfig destination) => new()
    {
        Address = destination.Address,
        ClientCertificateId = destination.ClientCertificateId,
        AcceptAnyServerCertificate = destination.AcceptAnyServerCertificate
    };

    public static CertificateDto ToDto(CertificateDefinition certificate) => new()
    {
        Name = certificate.Name,
        FileName = certificate.FileName,
        Type = certificate.Type.ToString().ToLowerInvariant(),
        Source = certificate.Source == CertificateSource.WindowsStore ? "windowsStore" : "file",
        PfxPath = certificate.PfxPath,
        Password = certificate.Password,
        StoreName = certificate.StoreName,
        StoreLocation = certificate.StoreLocation,
        Thumbprint = certificate.Thumbprint
    };

    public static CertificateDefinition ToModel(CertificateDto dto) => new()
    {
        Name = dto.Name,
        FileName = dto.FileName,
        Type = Enum.TryParse<CertificateUsage>(dto.Type, true, out var type) ? type : CertificateUsage.Client,
        Source = string.Equals(dto.Source, "windowsStore", StringComparison.OrdinalIgnoreCase)
            ? CertificateSource.WindowsStore
            : CertificateSource.File,
        PfxPath = dto.PfxPath,
        Password = dto.Password,
        StoreName = dto.StoreName,
        StoreLocation = dto.StoreLocation,
        Thumbprint = dto.Thumbprint
    };

    private static MockMatchDto ToDto(MockMatch match) => new()
    {
        Methods = match.Methods,
        Path = match.Path,
        PathMode = match.PathMode.ToString().ToLowerInvariant(),
        Query = match.Query,
        Headers = match.Headers,
        BodyContains = match.BodyContains,
        BodyRegex = match.BodyRegex,
        JsonPath = match.JsonPath,
        JsonPathEquals = match.JsonPathEquals,
        SoapAction = match.SoapAction,
        Operation = match.Operation,
        XPath = match.XPath
    };

    private static MockMatch ToModel(MockMatchDto dto) => new()
    {
        Methods = dto.Methods,
        Path = dto.Path,
        PathMode = Enum.TryParse<PathMatchMode>(dto.PathMode, true, out var mode) ? mode : PathMatchMode.Exact,
        Query = dto.Query,
        Headers = dto.Headers,
        BodyContains = dto.BodyContains,
        BodyRegex = dto.BodyRegex,
        JsonPath = dto.JsonPath,
        JsonPathEquals = dto.JsonPathEquals,
        SoapAction = dto.SoapAction,
        Operation = dto.Operation,
        XPath = dto.XPath
    };

    private static MockResponseDto ToDto(MockResponse response) => new()
    {
        StatusCode = response.StatusCode,
        ContentType = response.ContentType,
        Headers = response.Headers,
        Body = response.Body,
        BodyFile = response.BodyFile,
        DelayMs = response.DelayMs,
        Block = response.Block
    };

    private static MockResponse ToModel(MockResponseDto dto) => new()
    {
        StatusCode = dto.StatusCode,
        ContentType = dto.ContentType,
        Headers = dto.Headers,
        Body = dto.Body,
        BodyFile = dto.BodyFile,
        DelayMs = dto.DelayMs,
        Block = dto.Block
    };

    public static IgnoredPathDto ToDto(IgnoredPath ignore) => new()
    {
        Name = ignore.Name,
        FileName = ignore.FileName,
        Path = ignore.Path,
        PathMode = ignore.PathMode.ToString().ToLowerInvariant(),
        Methods = ignore.Methods
    };

    public static IgnoredPath ToModel(IgnoredPathDto dto) => new()
    {
        Name = dto.Name,
        FileName = dto.FileName,
        Path = dto.Path,
        PathMode = Enum.TryParse<PathMatchMode>(dto.PathMode, true, out var mode) ? mode : PathMatchMode.Exact,
        Methods = dto.Methods
    };

    public static MockSetDto ToDto(MockSet set) => new()
    {
        Name = set.Name,
        FileName = set.FileName,
        MockNames = set.MockNames
    };

    public static MockSet ToModel(MockSetDto dto) => new()
    {
        Name = dto.Name,
        FileName = dto.FileName,
        MockNames = dto.MockNames
    };
}
