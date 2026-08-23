namespace Proxy.Core.Models;

public sealed class LogTimeline
{
    public DateTimeOffset FromUtc { get; set; }
    public DateTimeOffset ToUtc { get; set; }
    public int BucketSeconds { get; set; }
    public IReadOnlyList<LogTimelineBucket> Buckets { get; set; } = [];
}

public sealed class LogTimelineBucket
{
    public DateTimeOffset StartUtc { get; set; }
    public int Count { get; set; }
    public int MockCount { get; set; }
    public int ManualCount { get; set; }
    public int Status2xx { get; set; }
    public int Status3xx { get; set; }
    public int Status4xx { get; set; }
    public int Status5xx { get; set; }
    public int OtherCount { get; set; }
}
