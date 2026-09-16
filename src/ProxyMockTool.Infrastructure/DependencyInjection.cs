using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ProxyMockTool.Core.Contracts;
using ProxyMockTool.Core.Matching;
using ProxyMockTool.Core.Options;
using ProxyMockTool.Infrastructure.Http;
using ProxyMockTool.Infrastructure.Listeners;
using ProxyMockTool.Infrastructure.Logging;
using ProxyMockTool.Infrastructure.Store;

namespace ProxyMockTool.Infrastructure;

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
        services.AddHostedService<LogRetentionService>();
        return services;
    }
}
