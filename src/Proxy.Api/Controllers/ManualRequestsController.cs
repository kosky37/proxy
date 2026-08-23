using Microsoft.AspNetCore.Mvc;
using Proxy.Api.Contracts;
using Proxy.Core.Contracts;
using Proxy.Core.Models;
using Proxy.Infrastructure.Http;

namespace Proxy.Api.Controllers;

[ApiController]
[Route("api/proxies/{proxyId}/send")]
public sealed class ManualRequestsController : ControllerBase
{
    private readonly IProxyConfigStore _store;
    private readonly ManualRequestSender _sender;

    public ManualRequestsController(IProxyConfigStore store, ManualRequestSender sender)
    {
        _store = store;
        _sender = sender;
    }

    [HttpPost]
    [ProducesResponseType(typeof(LogDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<LogDetailDto>> Send(string proxyId, [FromBody] ManualSendRequestDto request, CancellationToken cancellationToken)
    {
        if (_store.Get(proxyId) is null)
        {
            return NotFound();
        }

        try
        {
            var entry = await _sender.SendAsync(proxyId, new ManualSendRequest
            {
                Method = request.Method,
                Path = request.Path,
                Query = request.Query,
                Headers = request.Headers,
                Body = request.Body,
                Protocol = Enum.TryParse<RequestProtocol>(request.Protocol, true, out var protocol)
                    ? protocol
                    : RequestProtocol.Rest
            }, cancellationToken);
            return Ok(DtoMapper.ToDetail(entry));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }
}
