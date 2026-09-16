namespace ProxyMockTool.Core.Models;

public sealed class ListenConfig
{
    public string Url { get; set; } = "http://127.0.0.1:8081";
    public string? PathPrefix { get; set; }
    public List<string>? Hosts { get; set; }
    public string? ServerCertificateId { get; set; }
    public CertificateConfig? ServerCertificate { get; set; }
}
