using Proxy.Core.Models;

namespace Proxy.Api.Contracts;

public sealed class ProxyListItemDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public bool Enabled { get; set; }
    public required string ListenUrl { get; set; }
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
}

public sealed class ListenDto
{
    public required string Url { get; set; }
    public string? PathPrefix { get; set; }
    public List<string>? Hosts { get; set; }
    public CertificateDto? ServerCertificate { get; set; }
}

public sealed class DestinationDto
{
    public required string Address { get; set; }
    public CertificateDto? ClientCertificate { get; set; }
    public bool AcceptAnyServerCertificate { get; set; }
}

public sealed class CertificateDto
{
    public string? PfxPath { get; set; }
    public string? Password { get; set; }
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
}

public sealed class LogListDto
{
    public required IReadOnlyList<LogListItemDto> Items { get; set; }
    public required int Total { get; set; }
}

public class LogListItemDto
{
    public long Id { get; set; }
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
}

public sealed class LogDetailDto : LogListItemDto
{
    public string? RequestHeaders { get; set; }
    public string? RequestBody { get; set; }
    public bool RequestBodyTruncated { get; set; }
    public string? ResponseHeaders { get; set; }
    public string? ResponseBody { get; set; }
    public bool ResponseBodyTruncated { get; set; }
}

public sealed class ProxyStatsDto
{
    public long TotalRequests { get; set; }
    public long MockRequests { get; set; }
    public long PassthroughRequests { get; set; }
    public double AverageDurationMs { get; set; }
    public int? LastStatusCode { get; set; }
    public DateTimeOffset? LastRequestUtc { get; set; }
}

public sealed class HealthDto
{
    public required string Status { get; set; }
}

public static class DtoMapper
{
    public static ProxyListItemDto ToListItem(LoadedProxy proxy) => new()
    {
        Id = proxy.Id,
        Name = proxy.Definition.Name,
        Enabled = proxy.Definition.Enabled,
        ListenUrl = proxy.Definition.Listen.Url,
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
        PassthroughDelayMs = proxy.Definition.PassthroughDelayMs
    };

    public static ProxyDefinition ToDefinition(UpsertProxyRequest request) => new()
    {
        Name = request.Name,
        Enabled = request.Enabled,
        Listen = new ListenConfig
        {
            Url = request.Listen.Url,
            PathPrefix = request.Listen.PathPrefix,
            Hosts = request.Listen.Hosts,
            ServerCertificate = ToModel(request.Listen.ServerCertificate)
        },
        Destination = new DestinationConfig
        {
            Address = request.Destination.Address,
            ClientCertificate = ToModel(request.Destination.ClientCertificate),
            AcceptAnyServerCertificate = request.Destination.AcceptAnyServerCertificate
        },
        MocksEnabled = request.MocksEnabled,
        PassthroughDelayMs = request.PassthroughDelayMs
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

    public static MockDefinition ToModel(MockDto dto) => new()
    {
        Type = Enum.TryParse<MockType>(dto.Type, true, out var type) ? type : MockType.Rest,
        Name = dto.Name,
        FileName = dto.FileName,
        Enabled = dto.Enabled,
        Match = ToModel(dto.Match),
        Response = ToModel(dto.Response)
    };

    public static LogListItemDto ToListItem(RequestLogEntry entry) => new()
    {
        Id = entry.Id,
        TimestampUtc = entry.TimestampUtc,
        Method = entry.Method,
        Path = entry.Path,
        Query = entry.Query,
        Protocol = entry.Protocol.ToString().ToLowerInvariant(),
        StatusCode = entry.StatusCode,
        DurationMs = entry.DurationMs,
        Mode = entry.Mode.ToString().ToLowerInvariant(),
        MockName = entry.MockName,
        Error = entry.Error
    };

    public static LogDetailDto ToDetail(RequestLogEntry entry) => new()
    {
        Id = entry.Id,
        TimestampUtc = entry.TimestampUtc,
        Method = entry.Method,
        Path = entry.Path,
        Query = entry.Query,
        Protocol = entry.Protocol.ToString().ToLowerInvariant(),
        StatusCode = entry.StatusCode,
        DurationMs = entry.DurationMs,
        Mode = entry.Mode.ToString().ToLowerInvariant(),
        MockName = entry.MockName,
        Error = entry.Error,
        RequestHeaders = entry.RequestHeaders,
        RequestBody = entry.RequestBody,
        RequestBodyTruncated = entry.RequestBodyTruncated,
        ResponseHeaders = entry.ResponseHeaders,
        ResponseBody = entry.ResponseBody,
        ResponseBodyTruncated = entry.ResponseBodyTruncated
    };

    public static ProxyStatsDto ToDto(ProxyStats stats) => new()
    {
        TotalRequests = stats.TotalRequests,
        MockRequests = stats.MockRequests,
        PassthroughRequests = stats.PassthroughRequests,
        AverageDurationMs = stats.AverageDurationMs,
        LastStatusCode = stats.LastStatusCode,
        LastRequestUtc = stats.LastRequestUtc
    };

    private static ListenDto ToDto(ListenConfig listen) => new()
    {
        Url = listen.Url,
        PathPrefix = listen.PathPrefix,
        Hosts = listen.Hosts,
        ServerCertificate = ToDto(listen.ServerCertificate)
    };

    private static DestinationDto ToDto(DestinationConfig destination) => new()
    {
        Address = destination.Address,
        ClientCertificate = ToDto(destination.ClientCertificate),
        AcceptAnyServerCertificate = destination.AcceptAnyServerCertificate
    };

    private static CertificateDto? ToDto(CertificateConfig? certificate) =>
        certificate is null ? null : new CertificateDto { PfxPath = certificate.PfxPath, Password = certificate.Password };

    private static CertificateConfig? ToModel(CertificateDto? certificate) =>
        certificate is null ? null : new CertificateConfig { PfxPath = certificate.PfxPath, Password = certificate.Password };

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
        DelayMs = response.DelayMs
    };

    private static MockResponse ToModel(MockResponseDto dto) => new()
    {
        StatusCode = dto.StatusCode,
        ContentType = dto.ContentType,
        Headers = dto.Headers,
        Body = dto.Body,
        BodyFile = dto.BodyFile,
        DelayMs = dto.DelayMs
    };
}
