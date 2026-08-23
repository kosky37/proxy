using Microsoft.AspNetCore.Mvc;
using Proxy.Api.Contracts;
using Proxy.Core.Contracts;
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
            Mode = Enum.TryParse<RequestMode>(mode, true, out var parsedMode) ? parsedMode : null,
            StatusCode = statusCode,
            Protocol = Enum.TryParse<RequestProtocol>(protocol, true, out var parsedProtocol) ? parsedProtocol : null,
            Skip = skip,
            Take = take
        }, cancellationToken);

        return Ok(new LogListDto
        {
            Items = result.Items.Select(DtoMapper.ToListItem).ToList(),
            Total = result.Total
        });
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

    [HttpGet("stats")]
    [ProducesResponseType(typeof(ProxyStatsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProxyStatsDto>> Stats(string proxyId, CancellationToken cancellationToken)
    {
        var proxy = _store.Get(proxyId);
        if (proxy is null)
        {
            return NotFound();
        }

        var stats = await _logs.GetStatsAsync(proxyId, proxy.FolderPath, cancellationToken);
        return Ok(DtoMapper.ToDto(stats));
    }
}
