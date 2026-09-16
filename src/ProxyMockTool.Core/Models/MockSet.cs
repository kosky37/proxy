namespace ProxyMockTool.Core.Models;

public sealed class MockSet
{
    public string Name { get; set; } = "";
    public List<string> MockNames { get; set; } = [];
    public string FileName { get; set; } = "";
}
