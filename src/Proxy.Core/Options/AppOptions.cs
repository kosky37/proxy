namespace Proxy.Core.Options;

public sealed class AppOptions
{
    public const string SectionName = "App";

    public string DataRoot { get; set; } = "proxies";
    public string MockDisablePrefix { get; set; } = "_";
    public int BodyLogLimitBytes { get; set; } = 1_048_576;
    public string[] CorsOrigins { get; set; } = ["http://localhost:5173"];
}
