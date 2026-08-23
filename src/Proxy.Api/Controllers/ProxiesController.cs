using Microsoft.AspNetCore.Mvc;
using Proxy.Api.Contracts;
using Proxy.Core.Contracts;
using Proxy.Core.Storage;

namespace Proxy.Api.Controllers;

[ApiController]
[Route("api/proxies")]
public sealed class ProxiesController : ControllerBase
{
    private readonly IProxyConfigStore _store;

    public ProxiesController(IProxyConfigStore store)
    {
        _store = store;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ProxyListItemDto>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<ProxyListItemDto>> List() =>
        Ok(_store.GetAll().Select(DtoMapper.ToListItem).ToList());

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ProxyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<ProxyDetailDto> Get(string id)
    {
        var proxy = _store.Get(id);
        return proxy is null ? NotFound() : Ok(DtoMapper.ToDetail(proxy));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ProxyDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public ActionResult<ProxyDetailDto> Create([FromBody] UpsertProxyRequest request)
    {
        try
        {
            var id = string.IsNullOrWhiteSpace(request.Id) ? MockFileNames.Sanitize(request.Name) : request.Id;
            var created = _store.Create(id, DtoMapper.ToDefinition(request));
            return CreatedAtAction(nameof(Get), new { id = created.Id }, DtoMapper.ToDetail(created));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }

    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ProxyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<ProxyDetailDto> Update(string id, [FromBody] UpsertProxyRequest request)
    {
        try
        {
            return Ok(DtoMapper.ToDetail(_store.Update(id, DtoMapper.ToDefinition(request))));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult Delete(string id)
    {
        try
        {
            _store.Delete(id);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("{id}/certificates")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(CertificateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CertificateDto>> UploadCertificate(string id, IFormFile file, CancellationToken cancellationToken)
    {
        var proxy = _store.Get(id);
        if (proxy is null)
        {
            return NotFound();
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Select a certificate file." });
        }

        var fileName = MockFileNames.Sanitize(Path.GetFileName(file.FileName));
        if (!Path.HasExtension(fileName))
        {
            fileName += ".pfx";
        }

        var certsFolder = Path.Combine(proxy.FolderPath, "certs");
        Directory.CreateDirectory(certsFolder);
        var fullPath = Path.Combine(certsFolder, fileName);
        await using (var stream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        return Ok(new CertificateDto { PfxPath = Path.Combine("certs", fileName).Replace('\\', '/') });
    }

    [HttpPut("{id}/mocks-enabled")]
    [ProducesResponseType(typeof(ProxyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<ProxyDetailDto> SetMocksEnabled(string id, [FromBody] MocksEnabledRequest request)
    {
        try
        {
            return Ok(DtoMapper.ToDetail(_store.SetMocksEnabled(id, request.MocksEnabled)));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
