using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Proxy.Core.Contracts;
using Proxy.Core.Matching;
using Proxy.Core.Options;
using Proxy.Infrastructure.Http;
using Proxy.Infrastructure.Listeners;
using Proxy.Infrastructure.Logging;
using Proxy.Infrastructure.Store;

namespace Proxy.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddProxyPlatform(this IServiceCollection services, IConfiguration configuration, string contentRoot)
    {
        services.AddOptions<AppOptions>()
            .Bind(configuration.GetSection(AppOptions.SectionName))
            .PostConfigure(options =>
            {
                options.DataRoot = DataRootResolver.Resolve(options.DataRoot, contentRoot);
                options.CertificatesRoot = DataRootResolver.ResolveSibling(options.DataRoot, options.CertificatesRoot);
            });

        services.AddSingleton<ProxyFolderStore>();
        services.AddSingleton<IProxyConfigStore>(sp => sp.GetRequiredService<ProxyFolderStore>());
        services.AddSingleton<IRequestLogStore, SqliteRequestLogStore>();
        services.AddSingleton<MockEngine>();
        services.AddSingleton<ManualRequestSender>();
        services.AddHostedService<ProxyConfigWatcher>();
        services.AddHostedService<ProxyListenerManager>();
        return services;
    }
}
