namespace ProxyMockTool.Core.Options;

public sealed class AppOptions
{
    public const string SectionName = "App";

    public string DataRoot { get; set; } = "proxies";
    public string CertificatesRoot { get; set; } = "certificates";
    public string MockDisablePrefix { get; set; } = "_";
    public int BodyLogLimitBytes { get; set; } = 1_048_576;
    public int LogRetentionDays { get; set; } = 7;
    public string[] CorsOrigins { get; set; } = ["http://localhost:5173"];
}
