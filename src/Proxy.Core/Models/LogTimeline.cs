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
}
