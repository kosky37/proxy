namespace ProxyMockTool.Core.Models;

public sealed class MockResponse
{
    public int StatusCode { get; set; } = 200;
    public string? ContentType { get; set; }
    public Dictionary<string, string>? Headers { get; set; }
    public string? Body { get; set; }
    public string? BodyFile { get; set; }
    public int DelayMs { get; set; }
    public bool Block { get; set; }
}
