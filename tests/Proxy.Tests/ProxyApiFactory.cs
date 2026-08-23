using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace Proxy.Tests;

public sealed class ProxyApiFactory : WebApplicationFactory<Program>
{
    public string DataRoot { get; } = Directory.CreateTempSubdirectory("proxy-tests-").FullName;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["App:DataRoot"] = DataRoot
            });
        });
        builder.UseEnvironment("Development");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try
        {
            Directory.Delete(DataRoot, recursive: true);
        }
        catch (IOException)
        {
        }
    }
}
