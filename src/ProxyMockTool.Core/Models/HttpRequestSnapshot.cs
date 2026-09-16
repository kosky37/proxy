namespace ProxyMockTool.Core.Models;

public sealed class HttpRequestSnapshot
{
    public required string Method { get; init; }
    public required string Path { get; init; }
    public required IReadOnlyDictionary<string, string> Query { get; init; }
    public required IReadOnlyDictionary<string, string> Headers { get; init; }
    public string Body { get; init; } = "";
}
