namespace Proxy.Core.Models;

public sealed class ProxyStats
{
    public long TotalRequests { get; set; }
    public long MockRequests { get; set; }
    public long PassthroughRequests { get; set; }
    public double AverageDurationMs { get; set; }
    public int? LastStatusCode { get; set; }
    public DateTimeOffset? LastRequestUtc { get; set; }
}
