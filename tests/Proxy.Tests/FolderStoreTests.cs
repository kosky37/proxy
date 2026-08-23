using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Proxy.Core.Matching;
using Proxy.Core.Models;
using Proxy.Core.Options;
using Proxy.Infrastructure.Store;

namespace Proxy.Tests;

public class FolderStoreTests
{
    [Fact]
    public void Create_update_toggle_and_reload_from_disk()
    {
        var root = Directory.CreateTempSubdirectory("proxy-store-").FullName;
        try
        {
            var options = Options.Create(new AppOptions { DataRoot = root, MockDisablePrefix = "_" });
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
            File.Exists(Path.Combine(root, "certificates", "gateway-client.json")).Should().BeTrue();

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
            Directory.Delete(root, recursive: true);
        }
    }
}
