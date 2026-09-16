using Microsoft.AspNetCore.Mvc;
using ProxyMockTool.Api.Contracts;
using ProxyMockTool.Core.Contracts;

namespace ProxyMockTool.Api.Controllers;

[ApiController]
[Route("api/proxies/{proxyId}/mocks")]
public sealed class MocksController : ControllerBase
{
    private readonly IProxyConfigStore _store;

    public MocksController(IProxyConfigStore store)
    {
        _store = store;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<MockDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<IReadOnlyList<MockDto>> List(string proxyId)
    {
        var proxy = _store.Get(proxyId);
        return proxy is null ? NotFound() : Ok(proxy.Mocks.Select(DtoMapper.ToDto).ToList());
    }

    [HttpGet("{name}")]
    [ProducesResponseType(typeof(MockDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<MockDto> Get(string proxyId, string name)
    {
        var proxy = _store.Get(proxyId);
        var mock = proxy?.Mocks.FirstOrDefault(item => item.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        return mock is null ? NotFound() : Ok(DtoMapper.ToDto(mock));
    }

    [HttpPost]
    [ProducesResponseType(typeof(MockDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public ActionResult<MockDto> Create(string proxyId, [FromBody] MockDto request)
    {
        try
        {
            var created = _store.CreateMock(proxyId, DtoMapper.ToModel(request));
            return CreatedAtAction(nameof(Get), new { proxyId, name = created.Name }, DtoMapper.ToDto(created));
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
    [ProducesResponseType(typeof(MockDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<MockDto> Update(string proxyId, string name, [FromBody] MockDto request)
    {
        try
        {
            return Ok(DtoMapper.ToDto(_store.UpdateMock(proxyId, name, DtoMapper.ToModel(request))));
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
            _store.DeleteMock(proxyId, name);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("{name}/toggle")]
    [ProducesResponseType(typeof(MockDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<MockDto> Toggle(string proxyId, string name)
    {
        try
        {
            return Ok(DtoMapper.ToDto(_store.ToggleMock(proxyId, name)));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
