using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Options;
using Proxy.Core.Contracts;
using Proxy.Core.Matching;
using Proxy.Core.Models;
using Proxy.Core.Options;
using Proxy.Infrastructure.Listeners;

namespace Proxy.Infrastructure.Http;

public sealed class ManualRequestSender
{
    private static readonly HashSet<string> ContentHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Content-Type",
        "Content-Length",
        "Content-Encoding",
        "Content-Language",
        "Content-Location"
    };

    private static readonly HashSet<string> RestrictedHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Host",
        "Transfer-Encoding",
        "Connection",
        "Keep-Alive",
        "Upgrade",
        "Proxy-Connection"
    };

    private readonly IProxyConfigStore _store;
    private readonly IRequestLogStore _logs;
    private readonly AppOptions _options;

    public ManualRequestSender(IProxyConfigStore store, IRequestLogStore logs, IOptions<AppOptions> options)
    {
        _store = store;
        _logs = logs;
        _options = options.Value;
    }

    public async Task<RequestLogEntry> SendAsync(string proxyId, ManualSendRequest request, CancellationToken cancellationToken)
    {
        var proxy = _store.Get(proxyId) ?? throw new KeyNotFoundException($"Proxy '{proxyId}' was not found.");
        var method = string.IsNullOrWhiteSpace(request.Method) ? "GET" : request.Method.Trim().ToUpperInvariant();
        var path = PathMatcher.StripPrefix(
            string.IsNullOrWhiteSpace(request.Path) ? "/" : request.Path.Trim(),
            ListenPath.EffectivePrefix(proxy.Definition.Listen));
        var headers = new Dictionary<string, string>(request.Headers ?? new Dictionary<string, string>(), StringComparer.OrdinalIgnoreCase);

        var url = DestinationUrl.Build(
            proxy.Definition.Destination.Address,
            path,
            pathPrefix: null,
            request.Query);

        using var handler = new SocketsHttpHandler();
        DestinationTls.Configure(handler, proxy, _store.GetCertificates(), _store.CertificatesRoot);
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromMinutes(2) };

        using var message = new HttpRequestMessage(new HttpMethod(method), url);
        ApplyHeaders(message, headers, request.Body);

        var started = Stopwatch.StartNew();
        string? error = null;
        int? statusCode = null;
        Dictionary<string, string> responseHeaders = new(StringComparer.OrdinalIgnoreCase);
        string? responseBody = null;

        try
        {
            using var response = await client.SendAsync(message, cancellationToken);
            statusCode = (int)response.StatusCode;
            foreach (var header in response.Headers)
            {
                responseHeaders[header.Key] = string.Join(", ", header.Value);
            }

            foreach (var header in response.Content.Headers)
            {
                responseHeaders[header.Key] = string.Join(", ", header.Value);
            }

            responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            error = exception.InnerException?.Message ?? exception.Message;
        }

        var limit = LogLimits.BodyLimitBytes(proxy.Definition, _options);
        var requestLimit = BodyLimiter.Limit(request.Body, limit);
        var responseLimit = BodyLimiter.Limit(responseBody, limit);

        var entry = new RequestLogEntry
        {
            TimestampUtc = DateTimeOffset.UtcNow,
            Method = method,
            Path = PathMatcher.Normalize(path),
            Query = string.IsNullOrWhiteSpace(request.Query) ? null : request.Query.Trim().TrimStart('?'),
            Protocol = ContentKind.Detect(headers, request.Body, responseHeaders, responseBody),
            RequestHeaders = headers.HeadersToJson(),
            RequestBody = requestLimit.Text,
            RequestBodyTruncated = requestLimit.Exceeded,
            RequestBodyOriginalBytes = requestLimit.OriginalBytes,
            StatusCode = statusCode,
            ResponseHeaders = responseHeaders.Count == 0 ? null : responseHeaders.HeadersToJson(),
            ResponseBody = responseLimit.Text,
            ResponseBodyTruncated = responseLimit.Exceeded,
            ResponseBodyOriginalBytes = responseLimit.OriginalBytes,
            DurationMs = started.ElapsedMilliseconds,
            Mode = RequestMode.Manual,
            Error = error
        };

        return await _logs.WriteAsync(proxy.Id, proxy.FolderPath, entry, cancellationToken);
    }

    private static void ApplyHeaders(HttpRequestMessage message, Dictionary<string, string> headers, string? body)
    {
        string? contentType = null;
        foreach (var (key, value) in headers)
        {
            if (RestrictedHeaders.Contains(key))
            {
                continue;
            }

            if (key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase))
            {
                contentType = value;
                continue;
            }

            if (ContentHeaders.Contains(key))
            {
                continue;
            }

            message.Headers.TryAddWithoutValidation(key, value);
        }

        if (body is null)
        {
            return;
        }

        var content = new StringContent(body, Encoding.UTF8);
        if (!string.IsNullOrWhiteSpace(contentType) && MediaTypeHeaderValue.TryParse(contentType, out var mediaType))
        {
            content.Headers.ContentType = mediaType;
        }

        message.Content = content;
    }
}

public sealed class ManualSendRequest
{
    public string Method { get; set; } = "GET";
    public string Path { get; set; } = "/";
    public string? Query { get; set; }
    public Dictionary<string, string>? Headers { get; set; }
    public string? Body { get; set; }
    public RequestProtocol Protocol { get; set; } = RequestProtocol.Rest;
}
