namespace ProxyMockTool.Core.Models;

public sealed class MockDefinition
{
    public MockType Type { get; set; } = MockType.Rest;
    public string Name { get; set; } = "";
    public MockMatch Match { get; set; } = new();
    public MockResponse Response { get; set; } = new();

    public string FileName { get; set; } = "";
    public bool Enabled { get; set; } = true;
}
