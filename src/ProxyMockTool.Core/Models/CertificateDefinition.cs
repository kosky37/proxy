namespace ProxyMockTool.Core.Models;

public sealed class CertificateDefinition
{
    public string Name { get; set; } = "";
    public CertificateUsage Type { get; set; } = CertificateUsage.Client;
    public string? PfxPath { get; set; }
    public string? Password { get; set; }
    public string FileName { get; set; } = "";
}
