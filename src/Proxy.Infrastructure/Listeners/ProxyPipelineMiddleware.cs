using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Proxy.Core.Contracts;
using Proxy.Core.Matching;
using Proxy.Core.Models;
using Proxy.Core.Options;
using Yarp.ReverseProxy.Forwarder;

namespace Proxy.Infrastructure.Listeners;

public sealed class ProxyPipelineMiddleware
{
    public const string ListenUrlItem = "ProxyListenUrl";

    private readonly RequestDelegate _next;
    private readonly IProxyConfigStore _store;
    private readonly IRequestLogStore _logs;
    private readonly MockEngine _engine;
    private readonly AppOptions _options;
    private readonly ILogger<ProxyPipelineMiddleware> _logger;

    public ProxyPipelineMiddleware(
        RequestDelegate next,
        IProxyConfigStore store,
        IRequestLogStore logs,
        MockEngine engine,
        IOptions<AppOptions> options,
        ILogger<ProxyPipelineMiddleware> logger)
    {
        _next = next;
        _store = store;
        _logs = logs;
        _engine = engine;
        _options = options.Value;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var listenUrl = context.Items[ListenUrlItem] as string ?? "";
        var host = context.Request.Host.Value ?? "";
        var path = context.Request.Path.HasValue ? context.Request.Path.Value! : "/";
        var proxy = ProxyResolver.Resolve(_store.GetAll(), listenUrl, host, path);
        if (proxy is null)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            await context.Response.WriteAsync("No proxy configuration matched this request.");
            return;
        }

        var started = Stopwatch.StartNew();
        var snapshot = await context.Request.ToSnapshotAsync(context.RequestAborted);
        var mock = _engine.FindMatch(proxy, snapshot);
        var delay = mock is not null ? mock.Response.DelayMs : proxy.Definition.PassthroughDelayMs;
        if (delay > 0)
        {
            await Task.Delay(delay, context.RequestAborted);
        }

        var originalFeature = context.Features.Get<IHttpResponseBodyFeature>();
        var capturing = originalFeature is null ? null : new CapturingResponseBodyFeature(originalFeature);
        if (capturing is not null)
        {
            context.Features.Set<IHttpResponseBodyFeature>(capturing);
            context.Response.Body = capturing.Stream;
        }

        string? error = null;
        var mode = mock is null ? RequestMode.Passthrough : RequestMode.Mock;

        try
        {
            if (mock is not null)
            {
                if (mock.Response.Block)
                {
                    error = "blocked";
                }

                await WriteMockAsync(context, proxy, mock, context.RequestAborted);
            }
            else
            {
                await _next(context);
                var forwarderError = context.GetForwarderErrorFeature();
                if (forwarderError is not null)
                {
                    error = forwarderError.Exception?.Message ?? forwarderError.Error.ToString();
                }
            }
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            error = exception.Message;
            _logger.LogError(exception, "Proxy {ProxyId} failed for {Path}", proxy.Id, path);
            if (!context.Response.HasStarted && context.Response.StatusCode < 400)
            {
                context.Response.StatusCode = StatusCodes.Status502BadGateway;
            }
        }
        finally
        {
            if (originalFeature is not null)
            {
                context.Features.Set(originalFeature);
                context.Response.Body = originalFeature.Stream;
            }

            if (!IgnoreMatcher.IsIgnored(proxy, snapshot))
            {
                await WriteLogAsync(
                    proxy,
                    snapshot,
                    mock,
                    mode,
                    context,
                    capturing?.Capture ?? new MemoryStream(),
                    started.ElapsedMilliseconds,
                    error);
            }
        }
    }

    private static async Task WriteMockAsync(HttpContext context, LoadedProxy proxy, MockDefinition mock, CancellationToken cancellationToken)
    {
        if (mock.Response.Block)
        {
            try
            {
                await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            }
            catch (OperationCanceledException)
            {
            }

            return;
        }

        context.Response.StatusCode = mock.Response.StatusCode <= 0 ? StatusCodes.Status200OK : mock.Response.StatusCode;
        if (!string.IsNullOrWhiteSpace(mock.Response.ContentType))
        {
            context.Response.ContentType = mock.Response.ContentType;
        }

        if (mock.Response.Headers is not null)
        {
            foreach (var (key, value) in mock.Response.Headers)
            {
                context.Response.Headers[key] = value;
            }
        }

        var body = mock.Response.Body;
        if (!string.IsNullOrWhiteSpace(mock.Response.BodyFile))
        {
            var filePath = Path.GetFullPath(Path.Combine(proxy.FolderPath, mock.Response.BodyFile));
            if (File.Exists(filePath))
            {
                body = await File.ReadAllTextAsync(filePath, cancellationToken);
            }
        }

        if (body is not null)
        {
            await context.Response.WriteAsync(body, cancellationToken);
        }
    }

    private async Task WriteLogAsync(
        LoadedProxy proxy,
        HttpRequestSnapshot snapshot,
        MockDefinition? mock,
        RequestMode mode,
        HttpContext context,
        MemoryStream responseBuffer,
        long durationMs,
        string? error)
    {
        responseBuffer.Position = 0;
        string responseBody;
        using (var reader = new StreamReader(responseBuffer, leaveOpen: true))
        {
            responseBody = await reader.ReadToEndAsync();
        }

        var limit = LogLimits.BodyLimitBytes(proxy.Definition, _options);
        var requestLimit = BodyLimiter.Limit(snapshot.Body, limit);
        var responseLimit = BodyLimiter.Limit(responseBody, limit);

        var entry = new RequestLogEntry
        {
            TimestampUtc = DateTimeOffset.UtcNow,
            Method = snapshot.Method,
            Path = snapshot.Path,
            Query = snapshot.Query.Count == 0 ? null : string.Join("&", snapshot.Query.Select(item => $"{item.Key}={item.Value}")),
            Protocol = MockEngine.DetectProtocol(snapshot, mock),
            RequestHeaders = snapshot.Headers.HeadersToJson(),
            RequestBody = requestLimit.Text,
            RequestBodyTruncated = requestLimit.Exceeded,
            RequestBodyOriginalBytes = requestLimit.OriginalBytes,
            StatusCode = mock?.Response.Block == true && !context.Response.HasStarted ? null : context.Response.StatusCode,
            ResponseHeaders = context.Response.Headers.HeadersToJson(),
            ResponseBody = responseLimit.Text,
            ResponseBodyTruncated = responseLimit.Exceeded,
            ResponseBodyOriginalBytes = responseLimit.OriginalBytes,
            DurationMs = durationMs,
            Mode = mode,
            MockName = mock?.Name,
            Error = error
        };

        try
        {
            await _logs.WriteAsync(proxy.Id, proxy.FolderPath, entry);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Failed to persist request log for {ProxyId}", proxy.Id);
        }
    }
}
