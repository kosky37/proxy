namespace Proxy.Core.Models;

public sealed class DestinationConfig
{
    public string Address { get; set; } = "http://127.0.0.1:9000";
    public string? ClientCertificateId { get; set; }
    public CertificateConfig? ClientCertificate { get; set; }
    public bool AcceptAnyServerCertificate { get; set; }
}
