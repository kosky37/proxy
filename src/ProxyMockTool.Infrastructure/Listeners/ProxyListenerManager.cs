using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ProxyMockTool.Core.Contracts;
using ProxyMockTool.Core.Matching;
using ProxyMockTool.Infrastructure.Certificates;
using ProxyMockTool.Core.Models;
using ProxyMockTool.Core.Options;
using ProxyMockTool.Infrastructure.Yarp;
using Yarp.ReverseProxy;
using Yarp.ReverseProxy.Configuration;
using Yarp.ReverseProxy.Forwarder;

namespace ProxyMockTool.Infrastructure.Listeners;

public sealed class ProxyListenerManager : IHostedService, IDisposable
{
    private readonly IProxyConfigStore _store;
    private readonly IRequestLogStore _logs;
    private readonly MockEngine _engine;
    private readonly IOptions<AppOptions> _options;
    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger<ProxyListenerManager> _logger;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly ConcurrentDictionary<string, ListenerHost> _hosts = new(StringComparer.OrdinalIgnoreCase);

    public ProxyListenerManager(
        IProxyConfigStore store,
        IRequestLogStore logs,
        MockEngine engine,
        IOptions<AppOptions> options,
        ILoggerFactory loggerFactory,
        ILogger<ProxyListenerManager> logger)
    {
        _store = store;
        _logs = logs;
        _engine = engine;
        _options = options;
        _loggerFactory = loggerFactory;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _store.Changed += OnChanged;
        return ReconcileAsync(cancellationToken);
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _store.Changed -= OnChanged;
        foreach (var key in _hosts.Keys)
        {
            await StopHostAsync(key, cancellationToken);
        }
    }

    public void Dispose() => _gate.Dispose();

    private async void OnChanged(object? sender, EventArgs e)
    {
        try
        {
            await ReconcileAsync(CancellationToken.None);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Failed to reconcile proxy listeners");
        }
    }

    private async Task ReconcileAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var desired = _store.GetAll()
                .Where(proxy => proxy.Definition.Enabled)
                .GroupBy(proxy => ProxyResolver.NormalizeListenUrl(proxy.Definition.Listen.Url), StringComparer.OrdinalIgnoreCase)
                .Where(group => Uri.TryCreate(group.First().Definition.Listen.Url, UriKind.Absolute, out _))
                .ToDictionary(group => group.Key, group => group.ToList(), StringComparer.OrdinalIgnoreCase);

            foreach (var existing in _hosts.Keys.Except(desired.Keys, StringComparer.OrdinalIgnoreCase).ToList())
            {
                await StopHostAsync(existing, cancellationToken);
            }

            foreach (var (listenUrl, proxies) in desired)
            {
                var certKey = ServerCertKey(proxies, _store.GetCertificates(), _store.CertificatesRoot);
                if (_hosts.TryGetValue(listenUrl, out var host))
                {
                    if (host.ServerCertKey == certKey)
                    {
                        continue;
                    }

                    await StopHostAsync(listenUrl, cancellationToken);
                }

                await StartHostAsync(listenUrl, proxies, certKey, cancellationToken);
            }
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task StartHostAsync(string listenUrl, List<LoadedProxy> proxies, string certKey, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(proxies[0].Definition.Listen.Url, UriKind.Absolute, out var uri))
        {
            _logger.LogWarning("Skipping invalid listen URL {Url}", listenUrl);
            return;
        }

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            ApplicationName = typeof(ProxyListenerManager).Assembly.GetName().Name,
            ContentRootPath = AppContext.BaseDirectory
        });
        builder.Logging.ClearProviders();
        builder.Logging.AddProvider(new ForwardingLoggerProvider(_loggerFactory));
        builder.WebHost.SuppressStatusMessages(true);
        builder.WebHost.UseSetting(WebHostDefaults.PreventHostingStartupKey, "true");
        builder.WebHost.ConfigureKestrel(options => ConfigureKestrel(options, uri, LoadServerCertificate(proxies, _store.GetCertificates(), _store.CertificatesRoot)));

        builder.Services.AddSingleton(_store);
        builder.Services.AddSingleton(_logs);
        builder.Services.AddSingleton(_engine);
        builder.Services.AddSingleton(_options);
        builder.Services.AddSingleton<IForwarderHttpClientFactory, CertForwarderHttpClientFactory>();
        builder.Services.AddSingleton<IProxyConfigProvider>(new FileProxyConfigProvider(_store, listenUrl));
        builder.Services.AddReverseProxy();

        var app = builder.Build();
        app.Use(async (context, next) =>
        {
            context.Items[ProxyPipelineMiddleware.ListenUrlItem] = listenUrl;
            await next();
        });
        app.UseMiddleware<ProxyPipelineMiddleware>();
        app.MapReverseProxy(proxy =>
        {
            proxy.Use((context, next) =>
            {
                if (context.Items.TryGetValue(ProxyPipelineMiddleware.ResolvedProxyIdItem, out var value) &&
                    value is string proxyId)
                {
                    var lookup = context.RequestServices.GetRequiredService<IProxyStateLookup>();
                    if (lookup.TryGetCluster($"cluster-{proxyId}", out var cluster) &&
                        lookup.TryGetRoute($"route-{proxyId}", out var route))
                    {
                        context.ReassignProxyRequest(route, cluster);
                    }
                }

                return next();
            });
        });

        try
        {
            await app.StartAsync(cancellationToken);
            _hosts[listenUrl] = new ListenerHost(app, certKey);
            _logger.LogInformation("Started proxy listener {ListenUrl} for {Count} configuration(s)", listenUrl, proxies.Count);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Failed to start proxy listener {ListenUrl}", listenUrl);
            await app.DisposeAsync();
        }
    }

    private async Task StopHostAsync(string listenUrl, CancellationToken cancellationToken)
    {
        if (!_hosts.TryRemove(listenUrl, out var host))
        {
            return;
        }

        try
        {
            await host.App.StopAsync(cancellationToken);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Error stopping listener {ListenUrl}", listenUrl);
        }
        finally
        {
            await host.App.DisposeAsync();
            _logger.LogInformation("Stopped proxy listener {ListenUrl}", listenUrl);
        }
    }

    private static void ConfigureKestrel(KestrelServerOptions options, Uri uri, X509Certificate2? certificate)
    {
        var address = uri.Host switch
        {
            "localhost" or "127.0.0.1" => IPAddress.Loopback,
            "::1" => IPAddress.IPv6Loopback,
            "*" or "+" or "0.0.0.0" => IPAddress.Any,
            _ => IPAddress.TryParse(uri.Host, out var parsed) ? parsed : IPAddress.Loopback
        };

        options.Listen(address, uri.Port, listen =>
        {
            if (!uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (certificate is not null)
            {
                listen.UseHttps(certificate);
            }
            else
            {
                listen.UseHttps();
            }
        });
    }

    private static X509Certificate2? LoadServerCertificate(
        IEnumerable<LoadedProxy> proxies,
        IReadOnlyList<CertificateDefinition> catalog,
        string dataRoot)
    {
        foreach (var proxy in proxies)
        {
            var cert = CertificateResolver.ResolveServer(proxy, catalog);
            var loaded = CertificateLoader.Load(cert, dataRoot);
            if (loaded is not null)
            {
                return loaded;
            }
        }

        return null;
    }

    private static string ServerCertKey(
        IEnumerable<LoadedProxy> proxies,
        IReadOnlyList<CertificateDefinition> catalog,
        string dataRoot)
    {
        foreach (var proxy in proxies)
        {
            var cert = CertificateResolver.ResolveServer(proxy, catalog);
            var key = CertificateLoader.CacheKey(cert, dataRoot);
            if (!string.IsNullOrWhiteSpace(key))
            {
                return key;
            }
        }

        return "";
    }

    private sealed record ListenerHost(WebApplication App, string ServerCertKey);

    private sealed class ForwardingLoggerProvider(ILoggerFactory factory) : ILoggerProvider
    {
        public ILogger CreateLogger(string categoryName) => factory.CreateLogger(categoryName);
        public void Dispose()
        {
        }
    }
}
