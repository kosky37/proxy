using Microsoft.AspNetCore.Mvc;
using ProxyMockTool.Api.Contracts;

namespace ProxyMockTool.Api.Controllers;

[ApiController]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(HealthDto), StatusCodes.Status200OK)]
    public ActionResult<HealthDto> Get() => Ok(new HealthDto { Status = "ok" });
}
