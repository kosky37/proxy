namespace Proxy.Core.Models;

public sealed class ProxyDefinition
{
    public string Name { get; set; } = "";
    public bool Enabled { get; set; } = true;
    public ListenConfig Listen { get; set; } = new();
    public DestinationConfig Destination { get; set; } = new();
    public bool MocksEnabled { get; set; } = true;
    public int PassthroughDelayMs { get; set; }
    public int? LogRetentionDays { get; set; }
    public int? BodyLogLimitBytes { get; set; }
}
