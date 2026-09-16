namespace ProxyMockTool.Core.Models;

public sealed class LogStorageInfo
{
    public long DatabaseBytes { get; set; }
    public long TotalBytes { get; set; }
    public int EntryCount { get; set; }
}
