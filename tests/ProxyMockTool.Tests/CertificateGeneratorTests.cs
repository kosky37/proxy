using System.Net;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using AwesomeAssertions;
using ProxyMockTool.Infrastructure.Certificates;

namespace ProxyMockTool.Tests;

public class CertificateGeneratorTests
{
    [Fact]
    public void Root_ca_can_sign_a_server_certificate()
    {
        var password = "test-secret";
        var root = CertificateGenerator.CreateRootCa(
            "ProxyMockTool Test Root",
            DateTimeOffset.UtcNow.AddYears(10),
            password,
            "Test Root");

        using var issuer = X509CertificateLoader.LoadPkcs12(root.Pfx, password);
        issuer.HasPrivateKey.Should().BeTrue();
        using (var rootPublic = X509CertificateLoader.LoadCertificate(root.Cer))
        {
            IsCertificateAuthority(rootPublic).Should().BeTrue();
            rootPublic.Thumbprint.Should().Be(root.Thumbprint);
        }

        var server = CertificateGenerator.CreateServerCertificate(
            issuer,
            "localhost",
            ["localhost", "127.0.0.1"],
            DateTimeOffset.UtcNow.AddYears(2),
            password,
            "Local HTTPS");

        using var serverPublic = X509CertificateLoader.LoadCertificate(server.Cer);
        using var chain = new X509Chain();
        chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
        chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
        chain.ChainPolicy.CustomTrustStore.Add(issuer);
        chain.Build(serverPublic).Should().BeTrue(string.Join("; ", chain.ChainStatus.Select(item => item.StatusInformation)));
        HasServerAuth(serverPublic).Should().BeTrue();
        serverPublic.GetNameInfo(X509NameType.DnsName, false).Should().Be("localhost");
    }

    [Fact]
    public async Task Api_generates_root_and_server_certificates()
    {
        await using var factory = new ProxyApiFactory();
        using var api = factory.CreateClient();

        using var rootResponse = await api.PostAsync(
            "/api/certificates/generate-root",
            Json("{\"name\":\"Dev Root\",\"password\":\"root-secret\",\"validityYears\":10}"));
        var rootJson = await rootResponse.Content.ReadAsStringAsync();
        rootResponse.StatusCode.Should().Be(HttpStatusCode.Created, rootJson);
        using var root = JsonDocument.Parse(rootJson);
        root.RootElement.GetProperty("type").GetString().Should().Be("root");
        root.RootElement.GetProperty("thumbprint").GetString().Should().NotBeNullOrWhiteSpace();
        var rootName = root.RootElement.GetProperty("name").GetString();
        rootName.Should().Be("Dev Root");

        using var publicResponse = await api.GetAsync($"/api/certificates/{Uri.EscapeDataString(rootName!)}/public");
        publicResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        publicResponse.Content.Headers.ContentDisposition?.FileName.Should().Contain(".cer");
        var cer = await publicResponse.Content.ReadAsByteArrayAsync();
        cer.Length.Should().BeGreaterThan(0);
        using (var downloaded = X509CertificateLoader.LoadCertificate(cer))
        {
            downloaded.Thumbprint.Should().Be(root.RootElement.GetProperty("thumbprint").GetString());
        }

        using var statusResponse = await api.GetAsync($"/api/certificates/{Uri.EscapeDataString(rootName!)}/store-status");
        var statusJson = await statusResponse.Content.ReadAsStringAsync();
        statusResponse.StatusCode.Should().Be(HttpStatusCode.OK, statusJson);
        using var status = JsonDocument.Parse(statusJson);
        status.RootElement.GetProperty("installed").ValueKind.Should().Be(JsonValueKind.False);

        using var serverResponse = await api.PostAsync(
            "/api/certificates/generate-server",
            Json($$"""
                {
                  "name": "Local HTTPS",
                  "rootCertificateName": "Dev Root",
                  "password": "server-secret",
                  "hosts": ["localhost", "127.0.0.1"],
                  "validityYears": 2
                }
                """));
        var serverJson = await serverResponse.Content.ReadAsStringAsync();
        serverResponse.StatusCode.Should().Be(HttpStatusCode.Created, serverJson);
        using var server = JsonDocument.Parse(serverJson);
        server.RootElement.GetProperty("type").GetString().Should().Be("server");
        server.RootElement.GetProperty("source").GetString().Should().Be("file");

        var listJson = await api.GetStringAsync("/api/certificates");
        listJson.Should().Contain("Dev Root");
        listJson.Should().Contain("Local HTTPS");
    }

    [Fact]
    public async Task List_tolerates_non_pfx_certificate_files()
    {
        await using var factory = new ProxyApiFactory();
        using var api = factory.CreateClient();
        Directory.CreateDirectory(factory.CertificatesRoot);
        var generated = CertificateGenerator.CreateRootCa(
            "Plain CRT",
            DateTimeOffset.UtcNow.AddYears(1),
            "",
            "Plain CRT");
        await File.WriteAllBytesAsync(Path.Combine(factory.CertificatesRoot, "plain.crt"), generated.Cer);

        using var create = await api.PostAsync(
            "/api/certificates",
            Json("""
                {
                  "name": "plain",
                  "fileName": "plain.crt",
                  "type": "client",
                  "source": "file",
                  "pfxPath": "plain.crt"
                }
                """));
        create.EnsureSuccessStatusCode();

        using var list = await api.GetAsync("/api/certificates");
        var json = await list.Content.ReadAsStringAsync();
        list.StatusCode.Should().Be(HttpStatusCode.OK, json);
        json.Should().Contain("plain");
    }

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    private static bool IsCertificateAuthority(X509Certificate2 certificate)
    {
        var extension = certificate.Extensions.OfType<X509BasicConstraintsExtension>().FirstOrDefault();
        return extension?.CertificateAuthority == true;
    }

    private static bool HasServerAuth(X509Certificate2 certificate)
    {
        var extension = certificate.Extensions.OfType<X509EnhancedKeyUsageExtension>().FirstOrDefault();
        return extension?.EnhancedKeyUsages.OfType<System.Security.Cryptography.Oid>()
            .Any(item => item.Value == "1.3.6.1.5.5.7.3.1") == true;
    }
}
