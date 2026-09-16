namespace ProxyMockTool.Core.Models;

public sealed class MockMatch
{
    public List<string>? Methods { get; set; }
    public string? Path { get; set; }
    public PathMatchMode PathMode { get; set; } = PathMatchMode.Exact;
    public Dictionary<string, string>? Query { get; set; }
    public Dictionary<string, string>? Headers { get; set; }
    public string? BodyContains { get; set; }
    public string? BodyRegex { get; set; }
    public string? JsonPath { get; set; }
    public string? JsonPathEquals { get; set; }
    public string? SoapAction { get; set; }
    public string? Operation { get; set; }
    public string? XPath { get; set; }
}
