using Proxy.Core.Contracts;
using Proxy.Core.Matching;
using Proxy.Core.Models;
using Yarp.ReverseProxy.Configuration;
using YarpDestination = Yarp.ReverseProxy.Configuration.DestinationConfig;

namespace Proxy.Infrastructure.Yarp;

public sealed class FileProxyConfigProvider : IProxyConfigProvider, IDisposable
{
    private readonly IProxyConfigStore _store;
    private readonly string? _listenUrl;
    private volatile InMemoryProxyConfig _config;

    public FileProxyConfigProvider(IProxyConfigStore store, string? listenUrl = null)
    {
        _store = store;
        _listenUrl = listenUrl;
        _config = Build(_store.GetAll(), _listenUrl, _store.GetCertificates(), _store.CertificatesRoot);
        _store.Changed += OnStoreChanged;
    }

    public void Dispose() => _store.Changed -= OnStoreChanged;

    private void OnStoreChanged(object? sender, EventArgs e) => Update();

    public IProxyConfig GetConfig() => _config;

    public void Update()
    {
        var next = Build(_store.GetAll(), _listenUrl, _store.GetCertificates(), _store.CertificatesRoot);
        var previous = _config;
        _config = next;
        previous.SignalChange();
    }

    public static InMemoryProxyConfig Build(
        IReadOnlyList<LoadedProxy> proxies,
        string? listenUrl,
        IReadOnlyList<CertificateDefinition> certificates,
        string certificatesRoot)
    {
        var routes = new List<RouteConfig>();
        var clusters = new List<ClusterConfig>();

        foreach (var proxy in proxies.Where(item => item.Definition.Enabled))
        {
            if (listenUrl is not null && !ProxyResolver.ListenUrlsEqual(proxy.Definition.Listen.Url, listenUrl))
            {
                continue;
            }

            var clusterId = $"cluster-{proxy.Id}";
            var metadata = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["proxyId"] = proxy.Id,
                ["acceptAnyServerCertificate"] = proxy.Definition.Destination.AcceptAnyServerCertificate ? "true" : "false"
            };

            var clientCert = CertificateResolver.ResolveClient(proxy, certificates);
            var clientPath = CertificateResolver.ResolveFilePath(certificatesRoot, clientCert);
            if (!string.IsNullOrWhiteSpace(clientPath) && File.Exists(clientPath))
            {
                metadata["clientCertPath"] = clientPath;
                metadata["clientCertPassword"] = clientCert?.Password ?? "";
            }

            clusters.Add(new ClusterConfig
            {
                ClusterId = clusterId,
                Destinations = new Dictionary<string, YarpDestination>(StringComparer.OrdinalIgnoreCase)
                {
                    ["primary"] = new() { Address = EnsureTrailingSlash(proxy.Definition.Destination.Address) }
                },
                Metadata = metadata,
                HttpClient = new HttpClientConfig
                {
                    DangerousAcceptAnyServerCertificate = proxy.Definition.Destination.AcceptAnyServerCertificate
                }
            });

            var prefix = proxy.Definition.Listen.PathPrefix?.Trim();
            var path = string.IsNullOrWhiteSpace(prefix)
                ? "/{**catch-all}"
                : $"{PathMatcher.Normalize(prefix)}/{{**catch-all}}";

            var transforms = new List<IReadOnlyDictionary<string, string>>();
            if (!string.IsNullOrWhiteSpace(prefix))
            {
                transforms.Add(new Dictionary<string, string>
                {
                    ["PathRemovePrefix"] = PathMatcher.Normalize(prefix)
                });
            }

            routes.Add(new RouteConfig
            {
                RouteId = $"route-{proxy.Id}",
                ClusterId = clusterId,
                Match = new RouteMatch
                {
                    Path = path,
                    Hosts = proxy.Definition.Listen.Hosts is { Count: > 0 } hosts ? hosts : null
                },
                Transforms = transforms.Count == 0 ? null : transforms,
                Metadata = new Dictionary<string, string> { ["proxyId"] = proxy.Id }
            });
        }

        return new InMemoryProxyConfig(routes, clusters);
    }

    private static string EnsureTrailingSlash(string address) =>
        address.EndsWith('/') ? address : address + "/";
}
