using Microsoft.AspNetCore.Mvc;
using Proxy.Api.Contracts;
using Proxy.Core.Contracts;
using Proxy.Core.Storage;
using Proxy.Infrastructure.Store;

namespace Proxy.Api.Controllers;

[ApiController]
[Route("api/certificates")]
public sealed class CertificatesController : ControllerBase
{
    private readonly IProxyConfigStore _store;

    public CertificatesController(IProxyConfigStore store)
    {
        _store = store;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CertificateDto>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<CertificateDto>> List() =>
        Ok(_store.GetCertificates().Select(DtoMapper.ToDto).ToList());

    [HttpPost("file")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(UploadedCertificateFileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<UploadedCertificateFileDto>> UploadFile(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Select a certificate file." });
        }

        var fileName = MockFileNames.Sanitize(Path.GetFileName(file.FileName));
        if (!Path.HasExtension(fileName))
        {
            fileName += ".pfx";
        }

        var certsFolder = Path.Combine(_store.DataRoot, ProxyFolderStore.CertsFolderName);
        Directory.CreateDirectory(certsFolder);
        var fullPath = Path.Combine(certsFolder, fileName);
        await using (var stream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        return Ok(new UploadedCertificateFileDto { PfxPath = Path.Combine(ProxyFolderStore.CertsFolderName, fileName).Replace('\\', '/') });
    }

    [HttpPost]
    [ProducesResponseType(typeof(CertificateDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public ActionResult<CertificateDto> Create([FromBody] CertificateDto request)
    {
        try
        {
            var created = _store.CreateCertificate(DtoMapper.ToModel(request));
            return CreatedAtAction(nameof(List), DtoMapper.ToDto(created));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }

    [HttpPut("{name}")]
    [ProducesResponseType(typeof(CertificateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<CertificateDto> Update(string name, [FromBody] CertificateDto request)
    {
        try
        {
            return Ok(DtoMapper.ToDto(_store.UpdateCertificate(name, DtoMapper.ToModel(request))));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{name}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult Delete(string name)
    {
        try
        {
            _store.DeleteCertificate(name);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
