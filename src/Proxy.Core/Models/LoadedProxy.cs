namespace Proxy.Core.Models;

public sealed class LoadedProxy
{
    public required string Id { get; init; }
    public required string FolderPath { get; init; }
    public required ProxyDefinition Definition { get; init; }
    public required IReadOnlyList<MockDefinition> Mocks { get; init; }
}
