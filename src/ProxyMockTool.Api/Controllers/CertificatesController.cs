using Microsoft.AspNetCore.Mvc;
using ProxyMockTool.Api.Contracts;
using ProxyMockTool.Core.Contracts;
using ProxyMockTool.Core.Storage;

namespace ProxyMockTool.Api.Controllers;

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
    public async Task<ActionResult<UploadedCertificateFileDto>> UploadFile(IFormFile file, [FromForm] string? name, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Select a certificate file." });
        }

        Directory.CreateDirectory(_store.CertificatesRoot);
        var fileName = UniqueFileName(_store.CertificatesRoot, name, file.FileName);
        var fullPath = Path.Combine(_store.CertificatesRoot, fileName);
        await using (var stream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        return Ok(new UploadedCertificateFileDto { PfxPath = fileName });
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

    private static string UniqueFileName(string directory, string? certificateName, string originalFileName)
    {
        var extension = Path.GetExtension(originalFileName);
        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = ".pfx";
        }

        var stem = SafeStem(certificateName) ?? SafeStem(Path.GetFileNameWithoutExtension(originalFileName)) ?? "certificate";

        string fileName;
        do
        {
            fileName = $"{stem}-{Guid.NewGuid().ToString("N")[..8]}{extension}";
        }
        while (System.IO.File.Exists(Path.Combine(directory, fileName)));

        return fileName;
    }

    private static string? SafeStem(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        try
        {
            var stem = MockFileNames.Sanitize(value);
            return string.IsNullOrWhiteSpace(stem) ? null : stem;
        }
        catch (ArgumentException)
        {
            return null;
        }
    }
}
