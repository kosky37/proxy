namespace ProxyMockTool.Core.Models;

public sealed class CertificateDefinition
{
    public string Name { get; set; } = "";
    public CertificateUsage Type { get; set; } = CertificateUsage.Client;
    public CertificateSource Source { get; set; } = CertificateSource.File;
    public string? PfxPath { get; set; }
    public string? Password { get; set; }
    /// <summary>Windows store name, e.g. My.</summary>
    public string? StoreName { get; set; }
    /// <summary>CurrentUser or LocalMachine.</summary>
    public string? StoreLocation { get; set; }
    public string? Thumbprint { get; set; }
    public string FileName { get; set; } = "";
}
