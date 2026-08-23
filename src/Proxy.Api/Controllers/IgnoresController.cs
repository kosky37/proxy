using Microsoft.AspNetCore.Mvc;
using Proxy.Api.Contracts;
using Proxy.Core.Contracts;

namespace Proxy.Api.Controllers;

[ApiController]
[Route("api/proxies/{proxyId}/ignores")]
public sealed class IgnoresController : ControllerBase
{
    private readonly IProxyConfigStore _store;

    public IgnoresController(IProxyConfigStore store)
    {
        _store = store;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<IgnoredPathDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<IReadOnlyList<IgnoredPathDto>> List(string proxyId)
    {
        var proxy = _store.Get(proxyId);
        return proxy is null ? NotFound() : Ok(proxy.Ignores.Select(DtoMapper.ToDto).ToList());
    }

    [HttpPost]
    [ProducesResponseType(typeof(IgnoredPathDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public ActionResult<IgnoredPathDto> Create(string proxyId, [FromBody] IgnoredPathDto request)
    {
        try
        {
            var created = _store.CreateIgnore(proxyId, DtoMapper.ToModel(request));
            return CreatedAtAction(nameof(List), new { proxyId }, DtoMapper.ToDto(created));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }

    [HttpPut("{name}")]
    [ProducesResponseType(typeof(IgnoredPathDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<IgnoredPathDto> Update(string proxyId, string name, [FromBody] IgnoredPathDto request)
    {
        try
        {
            return Ok(DtoMapper.ToDto(_store.UpdateIgnore(proxyId, name, DtoMapper.ToModel(request))));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{name}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult Delete(string proxyId, string name)
    {
        try
        {
            _store.DeleteIgnore(proxyId, name);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
