namespace Proxy.Core.Models;

public sealed class IgnoredPath
{
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public PathMatchMode PathMode { get; set; } = PathMatchMode.Exact;
    public List<string>? Methods { get; set; }
    public string FileName { get; set; } = "";
}
