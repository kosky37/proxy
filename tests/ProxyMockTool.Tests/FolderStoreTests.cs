using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using ProxyMockTool.Core.Matching;
using ProxyMockTool.Core.Models;
using ProxyMockTool.Core.Options;
using ProxyMockTool.Infrastructure.Store;

namespace ProxyMockTool.Tests;

public class FolderStoreTests
{
    [Fact]
    public void Create_update_toggle_and_reload_from_disk()
    {
        var workspace = Directory.CreateTempSubdirectory("proxy-store-").FullName;
        var root = Path.Combine(workspace, "proxies");
        var certificatesRoot = Path.Combine(workspace, "certificates");
        Directory.CreateDirectory(root);
        try
        {
            var options = Options.Create(new AppOptions
            {
                DataRoot = root,
                CertificatesRoot = certificatesRoot,
                MockDisablePrefix = "_"
            });
            var store = new ProxyFolderStore(options, NullLogger<ProxyFolderStore>.Instance);

            var created = store.Create("demo", new ProxyDefinition
            {
                Name = "Demo",
                Listen = new ListenConfig { Url = "http://127.0.0.1:18081" },
                Destination = new DestinationConfig { Address = "http://127.0.0.1:18090" }
            });

            created.Id.Should().Be("demo");
            File.Exists(Path.Combine(root, "demo", "proxy.json")).Should().BeTrue();

            var mock = store.CreateMock("demo", new MockDefinition
            {
                Name = "hello",
                Enabled = true,
                Type = MockType.Rest,
                Match = new MockMatch { Path = "/hello" },
                Response = new MockResponse { Body = "ok" }
            });
            mock.Enabled.Should().BeTrue();
            mock.FileName.Should().Be("hello.json");

            var toggled = store.ToggleMock("demo", "hello");
            toggled.Enabled.Should().BeFalse();
            toggled.FileName.Should().Be("_hello.json");

            File.WriteAllText(Path.Combine(root, "demo", "proxy.json"), """
                {
                  "name": "Demo edited",
                  "enabled": true,
                  "listen": { "url": "http://127.0.0.1:18081" },
                  "destination": { "address": "http://127.0.0.1:18090" },
                  "mocksEnabled": false,
                  "passthroughDelayMs": 25
                }
                """);

            store.Reload();
            store.Get("demo")!.Definition.Name.Should().Be("Demo edited");
            store.Get("demo")!.Definition.MocksEnabled.Should().BeFalse();
            store.Get("demo")!.Definition.PassthroughDelayMs.Should().Be(25);

            var certificate = store.CreateCertificate(new CertificateDefinition
            {
                Name = "gateway-client",
                Type = CertificateUsage.Client,
                PfxPath = "certs/client.pfx",
                Password = "secret"
            });
            certificate.Name.Should().Be("gateway-client");
            certificate.PfxPath.Should().Be("client.pfx");
            File.Exists(Path.Combine(certificatesRoot, "gateway-client.json")).Should().BeTrue();
            File.Exists(Path.Combine(root, "certificates", "gateway-client.json")).Should().BeFalse();

            store.Update("demo", new ProxyDefinition
            {
                Name = "Demo edited",
                Listen = new ListenConfig { Url = "http://127.0.0.1:18081" },
                Destination = new DestinationConfig
                {
                    Address = "http://127.0.0.1:18090",
                    ClientCertificateId = "gateway-client"
                }
            });
            store.Get("demo")!.Definition.Destination.ClientCertificateId.Should().Be("gateway-client");
            CertificateResolver.ResolveClient(store.Get("demo")!, store.GetCertificates())!.Password.Should().Be("secret");

            var ignore = store.CreateIgnore("demo", new IgnoredPath
            {
                Name = "health",
                Path = "/health",
                PathMode = PathMatchMode.Exact
            });
            ignore.Name.Should().Be("health");
            File.Exists(Path.Combine(root, "demo", "ignores", "health.json")).Should().BeTrue();
            IgnoreMatcher.IsIgnored(
                store.Get("demo")!,
                new HttpRequestSnapshot
                {
                    Method = "GET",
                    Path = "/health",
                    Query = new Dictionary<string, string>(),
                    Headers = new Dictionary<string, string>()
                }).Should().BeTrue();
        }
        finally
        {
            Directory.Delete(workspace, recursive: true);
        }
    }

    [Fact]
    public void Apply_mock_set_enables_named_mocks_and_disables_the_rest()
    {
        var workspace = Directory.CreateTempSubdirectory("proxy-mock-sets-").FullName;
        var root = Path.Combine(workspace, "proxies");
        var certificatesRoot = Path.Combine(workspace, "certificates");
        Directory.CreateDirectory(root);
        try
        {
            var store = new ProxyFolderStore(Options.Create(new AppOptions
            {
                DataRoot = root,
                CertificatesRoot = certificatesRoot,
                MockDisablePrefix = "_"
            }), NullLogger<ProxyFolderStore>.Instance);

            store.Create("demo", new ProxyDefinition
            {
                Name = "Demo",
                Listen = new ListenConfig { Url = "http://127.0.0.1:18081" },
                Destination = new DestinationConfig { Address = "http://127.0.0.1:18090" }
            });
            store.CreateMock("demo", new MockDefinition
            {
                Name = "alpha",
                Enabled = true,
                Type = MockType.Rest,
                Match = new MockMatch { Path = "/alpha" },
                Response = new MockResponse { Body = "a" }
            });
            store.CreateMock("demo", new MockDefinition
            {
                Name = "beta",
                Enabled = true,
                Type = MockType.Rest,
                Match = new MockMatch { Path = "/beta" },
                Response = new MockResponse { Body = "b" }
            });
            store.CreateMock("demo", new MockDefinition
            {
                Name = "gamma",
                Enabled = false,
                Type = MockType.Rest,
                Match = new MockMatch { Path = "/gamma" },
                Response = new MockResponse { Body = "c" }
            });

            var created = store.CreateMockSet("demo", new MockSet
            {
                Name = "happy-path",
                MockNames = ["gamma", "alpha"]
            });
            created.Name.Should().Be("happy-path");
            File.Exists(Path.Combine(root, "demo", "mock-sets", "happy-path.json")).Should().BeTrue();

            var applied = store.ApplyMockSet("demo", "happy-path");
            applied.Single(item => item.Name == "alpha").Enabled.Should().BeTrue();
            applied.Single(item => item.Name == "alpha").FileName.Should().Be("alpha.json");
            applied.Single(item => item.Name == "beta").Enabled.Should().BeFalse();
            applied.Single(item => item.Name == "beta").FileName.Should().Be("_beta.json");
            applied.Single(item => item.Name == "gamma").Enabled.Should().BeTrue();
            applied.Single(item => item.Name == "gamma").FileName.Should().Be("gamma.json");
        }
        finally
        {
            Directory.Delete(workspace, recursive: true);
        }
    }
[Fact]
    public void DeleteMock_can_remove_the_last_remaining_mock()
    {
        var workspace = Directory.CreateTempSubdirectory("proxy-store-").FullName;
        var root = Path.Combine(workspace, "proxies");
        var certificatesRoot = Path.Combine(workspace, "certificates");
        Directory.CreateDirectory(root);
        try
        {
            var options = Options.Create(new AppOptions
            {
                DataRoot = root,
                CertificatesRoot = certificatesRoot,
                MockDisablePrefix = "_"
            });
            var store = new ProxyFolderStore(options, NullLogger<ProxyFolderStore>.Instance);

            store.Create("demo", new ProxyDefinition
            {
                Name = "Demo",
                Listen = new ListenConfig { Url = "http://127.0.0.1:18081" },
                Destination = new DestinationConfig { Address = "http://127.0.0.1:18090" }
            });

            store.CreateMock("demo", new MockDefinition
            {
                Name = "only",
                Enabled = true,
                Type = MockType.Rest,
                Match = new MockMatch { Path = "/only" },
                Response = new MockResponse { Body = "ok" }
            });

            store.Get("demo")!.Mocks.Should().ContainSingle(mock => mock.Name == "only");

            store.DeleteMock("demo", "only");

            store.Get("demo")!.Mocks.Should().BeEmpty();
            Directory.GetFiles(Path.Combine(root, "demo", "mocks"), "*.json").Should().BeEmpty();
        }
        finally
        {
            Directory.Delete(workspace, recursive: true);
        }
    }
}
