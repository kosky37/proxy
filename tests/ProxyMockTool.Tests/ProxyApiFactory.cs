using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace ProxyMockTool.Tests;

public sealed class ProxyApiFactory : WebApplicationFactory<Program>
{
    public string Workspace { get; } = Directory.CreateTempSubdirectory("proxy-tests-").FullName;

    public string DataRoot => Path.Combine(Workspace, "proxies");

    public string CertificatesRoot => Path.Combine(Workspace, "certificates");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(DataRoot);
        Directory.CreateDirectory(CertificatesRoot);
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["App:DataRoot"] = DataRoot,
                ["App:CertificatesRoot"] = CertificatesRoot
            });
        });
        builder.UseEnvironment("Development");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try
        {
            Directory.Delete(Workspace, recursive: true);
        }
        catch (IOException)
        {
        }
    }
}
