using Microsoft.AspNetCore.Mvc;
using ProxyMockTool.Api.Contracts;
using ProxyMockTool.Core.Contracts;
using ProxyMockTool.Core.Models;
using ProxyMockTool.Core.Storage;
using ProxyMockTool.Infrastructure.Certificates;

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
        Ok(_store.GetCertificates().Select(Enrich).ToList());

    [HttpGet("windows-store")]
    [ProducesResponseType(typeof(IReadOnlyList<WindowsStoreCertificateDto>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<WindowsStoreCertificateDto>> ListWindowsStore(
        [FromQuery] string location = "CurrentUser",
        [FromQuery] string store = "My")
    {
        var items = CertificateLoader.ListWindowsStore(location, store)
            .Select(item => new WindowsStoreCertificateDto
            {
                Thumbprint = item.Thumbprint,
                Subject = item.Subject,
                FriendlyName = item.FriendlyName,
                NotBeforeUtc = item.NotBeforeUtc,
                NotAfterUtc = item.NotAfterUtc,
                HasPrivateKey = item.HasPrivateKey
            })
            .ToList();
        return Ok(items);
    }

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

    [HttpPost("generate-root")]
    [ProducesResponseType(typeof(CertificateDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public ActionResult<CertificateDto> GenerateRoot([FromBody] GenerateRootCertificateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        var name = request.Name.Trim();
        var subject = string.IsNullOrWhiteSpace(request.Subject) ? name : request.Subject.Trim();
        var years = request.ValidityYears <= 0 ? 10 : Math.Clamp(request.ValidityYears, 1, 30);
        var generated = CertificateGenerator.CreateRootCa(
            subject,
            DateTimeOffset.UtcNow.AddYears(years),
            request.Password ?? "",
            name);
        var pfxPath = CertificateGenerator.WritePfxAndCer(_store.CertificatesRoot, name, generated);

        try
        {
            var created = _store.CreateCertificate(new CertificateDefinition
            {
                Name = name,
                Type = CertificateUsage.Root,
                Source = CertificateSource.File,
                PfxPath = pfxPath,
                Password = request.Password,
                Thumbprint = generated.Thumbprint
            });
            return CreatedAtAction(nameof(List), Enrich(created));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }

    [HttpPost("generate-server")]
    [ProducesResponseType(typeof(CertificateDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public ActionResult<CertificateDto> GenerateServer([FromBody] GenerateServerCertificateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        if (string.IsNullOrWhiteSpace(request.RootCertificateName))
        {
            return BadRequest(new { message = "Select a root certificate." });
        }

        var root = _store.GetCertificates().FirstOrDefault(item =>
            item.Type == CertificateUsage.Root &&
            item.Name.Equals(request.RootCertificateName, StringComparison.OrdinalIgnoreCase));
        if (root is null)
        {
            return BadRequest(new { message = "The selected root certificate was not found." });
        }

        using var issuer = CertificateLoader.Load(root, _store.CertificatesRoot);
        if (issuer is null)
        {
            return BadRequest(new { message = "Could not load the root certificate private key." });
        }

        var name = request.Name.Trim();
        var hosts = (request.Hosts ?? [])
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Select(item => item.Trim())
            .ToList();
        var subject = string.IsNullOrWhiteSpace(request.Subject)
            ? hosts.FirstOrDefault(item => !System.Net.IPAddress.TryParse(item, out _)) ?? name
            : request.Subject.Trim();
        var years = request.ValidityYears <= 0 ? 2 : Math.Clamp(request.ValidityYears, 1, 10);

        try
        {
            var generated = CertificateGenerator.CreateServerCertificate(
                issuer,
                subject,
                hosts,
                DateTimeOffset.UtcNow.AddYears(years),
                request.Password ?? "",
                name);
            var pfxPath = CertificateGenerator.WritePfxAndCer(_store.CertificatesRoot, name, generated);
            var created = _store.CreateCertificate(new CertificateDefinition
            {
                Name = name,
                Type = CertificateUsage.Server,
                Source = CertificateSource.File,
                PfxPath = pfxPath,
                Password = request.Password,
                Thumbprint = generated.Thumbprint
            });
            return CreatedAtAction(nameof(List), Enrich(created));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }

    [HttpGet("{name}/public")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult DownloadPublic(string name)
    {
        var certificate = FindCertificate(name);
        if (certificate is null)
        {
            return NotFound();
        }

        var bytes = CertificateLoader.ExportPublicCert(certificate, _store.CertificatesRoot);
        if (bytes is null || bytes.Length == 0)
        {
            return NotFound(new { message = "The public certificate file is not available." });
        }

        var fileName = $"{SafeStem(certificate.Name) ?? "certificate"}.cer";
        return File(bytes, "application/x-x509-ca-cert", fileName);
    }

    [HttpGet("{name}/store-status")]
    [ProducesResponseType(typeof(CertificateStoreStatusDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<CertificateStoreStatusDto> StoreStatus(string name)
    {
        var certificate = FindCertificate(name);
        if (certificate is null)
        {
            return NotFound();
        }

        var info = CertificateLoader.GetPublicInfo(certificate, _store.CertificatesRoot);
        if (info is null)
        {
            return BadRequest(new { message = "Could not read the certificate." });
        }

        var locations = CertificateLoader.FindInRootStore(info.Thumbprint);
        return Ok(new CertificateStoreStatusDto
        {
            Thumbprint = info.Thumbprint,
            Installed = locations.Count > 0,
            Locations = locations
                .Select(item => new CertificateStoreLocationDto
                {
                    StoreLocation = item.StoreLocation,
                    StoreName = item.StoreName
                })
                .ToList()
        });
    }

    [HttpPost]
    [ProducesResponseType(typeof(CertificateDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public ActionResult<CertificateDto> Create([FromBody] CertificateDto request)
    {
        try
        {
            var created = _store.CreateCertificate(DtoMapper.ToModel(request));
            return CreatedAtAction(nameof(List), Enrich(created));
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
            return Ok(Enrich(_store.UpdateCertificate(name, DtoMapper.ToModel(request))));
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

    private CertificateDefinition? FindCertificate(string name) =>
        _store.GetCertificates()
            .FirstOrDefault(item => item.Name.Equals(name, StringComparison.OrdinalIgnoreCase));

    private CertificateDto Enrich(CertificateDefinition certificate)
    {
        var dto = DtoMapper.ToDto(certificate);
        var info = CertificateLoader.GetPublicInfo(certificate, _store.CertificatesRoot);
        if (info is null)
        {
            return dto;
        }

        dto.Thumbprint = info.Thumbprint;
        dto.Subject = info.Subject;
        dto.NotBeforeUtc = info.NotBeforeUtc;
        dto.NotAfterUtc = info.NotAfterUtc;
        if (certificate.Type != CertificateUsage.Root)
        {
            return dto;
        }

        var locations = CertificateLoader.FindInRootStore(info.Thumbprint);
        dto.RootStoreInstalled = locations.Count > 0;
        dto.RootStoreLocations = locations
            .Select(item => new CertificateStoreLocationDto
            {
                StoreLocation = item.StoreLocation,
                StoreName = item.StoreName
            })
            .ToList();
        return dto;
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
