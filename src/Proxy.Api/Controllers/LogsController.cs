using Microsoft.AspNetCore.Mvc;
using Proxy.Api.Contracts;
using Proxy.Core.Contracts;
using Proxy.Core.Matching;
using Proxy.Core.Models;

namespace Proxy.Api.Controllers;

[ApiController]
[Route("api/proxies/{proxyId}")]
public sealed class LogsController : ControllerBase
{
    private readonly IProxyConfigStore _store;
    private readonly IRequestLogStore _logs;

    public LogsController(IProxyConfigStore store, IRequestLogStore logs)
    {
        _store = store;
        _logs = logs;
    }

    [HttpGet("logs")]
    [ProducesResponseType(typeof(LogListDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LogListDto>> List(
        string proxyId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] string? path,
        [FromQuery] string? soapAction,
        [FromQuery] string? body,
        [FromQuery] string? mode,
        [FromQuery] int? statusCode,
        [FromQuery] string? protocol,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken cancellationToken = default)
    {
        var proxy = _store.Get(proxyId);
        if (proxy is null)
        {
            return NotFound();
        }

        var result = await _logs.QueryAsync(proxyId, proxy.FolderPath, new LogQuery
        {
            FromUtc = from,
            ToUtc = to,
            Path = path,
            SoapAction = soapAction,
            Body = body,
            Mode = Enum.TryParse<RequestMode>(mode, true, out var parsedMode) ? parsedMode : null,
            StatusCode = statusCode,
            Protocol = ParseProtocol(protocol),
            Skip = skip,
            Take = take
        }, cancellationToken);

        return Ok(new LogListDto
        {
            Items = result.Items.Select(item => DtoMapper.ToListItem(item)).ToList(),
            Total = result.Total
        });
    }

    [HttpGet("logs/storage")]
    [ProducesResponseType(typeof(LogStorageDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LogStorageDto>> Storage(string proxyId, CancellationToken cancellationToken)
    {
        var proxy = _store.Get(proxyId);
        if (proxy is null)
        {
            return NotFound();
        }

        var storage = await _logs.GetStorageAsync(proxyId, proxy.FolderPath, cancellationToken);
        return Ok(DtoMapper.ToDto(storage));
    }

    [HttpGet("logs/timeline")]
    [ProducesResponseType(typeof(LogTimelineDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LogTimelineDto>> Timeline(
        string proxyId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int buckets = 80,
        CancellationToken cancellationToken = default)
    {
        var proxy = _store.Get(proxyId);
        if (proxy is null)
        {
            return NotFound();
        }

        var timeline = await _logs.GetTimelineAsync(proxyId, proxy.FolderPath, from, to, buckets, cancellationToken);
        return Ok(DtoMapper.ToDto(timeline));
    }

    [HttpDelete("logs")]
    [ProducesResponseType(typeof(LogClearResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LogClearResultDto>> Clear(
        string proxyId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken cancellationToken = default)
    {
        var proxy = _store.Get(proxyId);
        if (proxy is null)
        {
            return NotFound();
        }

        var deleted = await _logs.DeleteAsync(proxyId, proxy.FolderPath, from, to, cancellationToken);
        return Ok(new LogClearResultDto { Deleted = deleted });
    }

    [HttpGet("logs/{entryId:long}")]
    [ProducesResponseType(typeof(LogDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LogDetailDto>> Get(string proxyId, long entryId, CancellationToken cancellationToken)
    {
        var proxy = _store.Get(proxyId);
        if (proxy is null)
        {
            return NotFound();
        }

        var entry = await _logs.GetAsync(proxyId, proxy.FolderPath, entryId, cancellationToken);
        return entry is null ? NotFound() : Ok(DtoMapper.ToDetail(entry));
    }

    private static RequestProtocol? ParseProtocol(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (value.Equals("rest", StringComparison.OrdinalIgnoreCase))
        {
            return RequestProtocol.Other;
        }

        return Enum.TryParse<RequestProtocol>(value, true, out var parsed) ? ContentKind.Normalize(parsed) : null;
    }
}
