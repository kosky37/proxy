using Microsoft.AspNetCore.Mvc;
using ProxyMockTool.Api.Contracts;
using ProxyMockTool.Core.Contracts;

namespace ProxyMockTool.Api.Controllers;

[ApiController]
[Route("api/proxies/{proxyId}/mock-sets")]
public sealed class MockSetsController : ControllerBase
{
    private readonly IProxyConfigStore _store;

    public MockSetsController(IProxyConfigStore store)
    {
        _store = store;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<MockSetDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<IReadOnlyList<MockSetDto>> List(string proxyId)
    {
        var proxy = _store.Get(proxyId);
        return proxy is null ? NotFound() : Ok(proxy.MockSets.Select(DtoMapper.ToDto).ToList());
    }

    [HttpPost]
    [ProducesResponseType(typeof(MockSetDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public ActionResult<MockSetDto> Create(string proxyId, [FromBody] MockSetDto request)
    {
        try
        {
            var created = _store.CreateMockSet(proxyId, DtoMapper.ToModel(request));
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
    [ProducesResponseType(typeof(MockSetDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<MockSetDto> Update(string proxyId, string name, [FromBody] MockSetDto request)
    {
        try
        {
            return Ok(DtoMapper.ToDto(_store.UpdateMockSet(proxyId, name, DtoMapper.ToModel(request))));
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
            _store.DeleteMockSet(proxyId, name);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("{name}/apply")]
    [ProducesResponseType(typeof(IReadOnlyList<MockDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<IReadOnlyList<MockDto>> Apply(string proxyId, string name)
    {
        try
        {
            return Ok(_store.ApplyMockSet(proxyId, name).Select(DtoMapper.ToDto).ToList());
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
