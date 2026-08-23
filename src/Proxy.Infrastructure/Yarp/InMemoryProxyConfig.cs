using Microsoft.Extensions.Primitives;
using Yarp.ReverseProxy.Configuration;

namespace Proxy.Infrastructure.Yarp;

public sealed class InMemoryProxyConfig : IProxyConfig
{
    private readonly CancellationTokenSource _cts = new();

    public InMemoryProxyConfig(IReadOnlyList<RouteConfig> routes, IReadOnlyList<ClusterConfig> clusters)
    {
        Routes = routes;
        Clusters = clusters;
        ChangeToken = new CancellationChangeToken(_cts.Token);
    }

    public IReadOnlyList<RouteConfig> Routes { get; }
    public IReadOnlyList<ClusterConfig> Clusters { get; }
    public IChangeToken ChangeToken { get; }

    public void SignalChange() => _cts.Cancel();
}
