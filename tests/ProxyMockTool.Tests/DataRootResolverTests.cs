using AwesomeAssertions;
using ProxyMockTool.Infrastructure.Store;

namespace ProxyMockTool.Tests;

public class DataRootResolverTests
{
    [Fact]
    public void Certificates_folder_is_sibling_of_proxies()
    {
        var dataRoot = Path.Combine(Path.GetTempPath(), "repo", "proxies");
        var certificates = DataRootResolver.ResolveSibling(dataRoot, "certificates");
        certificates.Should().Be(Path.GetFullPath(Path.Combine(Path.GetTempPath(), "repo", "certificates")));
    }
}
