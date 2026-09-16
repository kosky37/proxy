using ProxyMockTool.Core.Contracts;
using ProxyMockTool.Core.Matching;
using ProxyMockTool.Core.Models;
using Yarp.ReverseProxy.Configuration;
using YarpDestination = Yarp.ReverseProxy.Configuration.DestinationConfig;

namespace ProxyMockTool.Infrastructure.Yarp;

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

            var prefix = ListenPath.EffectivePrefix(proxy.Definition.Listen);
            var transforms = new List<IReadOnlyDictionary<string, string>>();
            if (!string.IsNullOrWhiteSpace(prefix))
            {
                transforms.Add(new Dictionary<string, string>
                {
                    ["PathRemovePrefix"] = PathMatcher.Normalize(prefix)
                });
            }

            // Host-gated so these routes never compete with each other during endpoint matching.
            // ProxyPipelineMiddleware picks the proxy, then MapReverseProxy reassigns to this route.
            routes.Add(new RouteConfig
            {
                RouteId = $"route-{proxy.Id}",
                ClusterId = clusterId,
                Match = new RouteMatch
                {
                    Path = "/{**catch-all}",
                    Hosts = [InternalHost(proxy.Id)]
                },
                Transforms = transforms.Count == 0 ? null : transforms,
                Metadata = new Dictionary<string, string> { ["proxyId"] = proxy.Id }
            });
        }

        if (clusters.Count > 0)
        {
            routes.Insert(0, new RouteConfig
            {
                RouteId = SharedRouteId,
                ClusterId = clusters[0].ClusterId,
                Match = new RouteMatch { Path = "/{**catch-all}" }
            });
        }

        return new InMemoryProxyConfig(routes, clusters);
    }

    public const string SharedRouteId = "route-shared";

    public static string InternalHost(string proxyId) => $"__proxy.{proxyId}.internal";

    private static string EnsureTrailingSlash(string address) =>
        address.EndsWith('/') ? address : address + "/";
}
