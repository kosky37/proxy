using AwesomeAssertions;
using ProxyMockTool.Core.Matching;
using ProxyMockTool.Core.Models;
using ProxyMockTool.Infrastructure.Yarp;

namespace ProxyMockTool.Tests;

public class ListenPathTests
{
    [Fact]
    public void Uses_path_prefix_when_set()
    {
        ListenPath.EffectivePrefix(new ListenConfig
        {
            Url = "http://127.0.0.1:8083/ignored",
            PathPrefix = "/api"
        }).Should().Be("/api");
    }

    [Fact]
    public void Ignores_a_path_on_the_listen_url()
    {
        ListenPath.EffectivePrefix(new ListenConfig
        {
            Url = "http://127.0.0.1:8083/test"
        }).Should().BeNull();
    }

    [Fact]
    public void Treats_root_as_no_prefix()
    {
        ListenPath.EffectivePrefix(new ListenConfig { Url = "http://127.0.0.1:8083/" }).Should().BeNull();
        ListenPath.EffectivePrefix(new ListenConfig { Url = "http://127.0.0.1:8083", PathPrefix = "/" }).Should().BeNull();
    }

    [Fact]
    public void StripPrefix_removes_the_listen_prefix()
    {
        PathMatcher.StripPrefix("/api/orders", "/api").Should().Be("/orders");
        PathMatcher.StripPrefix("/api", "/api").Should().Be("/");
        PathMatcher.StripPrefix("/other", "/api").Should().Be("/other");
    }

    [Fact]
    public void Normalize_keeps_the_listen_url_and_clears_a_root_prefix()
    {
        var listen = ListenPath.Normalize(new ListenConfig { Url = "http://127.0.0.1:8083/api", PathPrefix = "/" });
        listen.Url.Should().Be("http://127.0.0.1:8083/api");
        listen.PathPrefix.Should().BeNull();
    }

    [Fact]
    public void Resolver_picks_the_longest_matching_prefix_on_a_shared_port()
    {
        var api = Proxy("api", "http://127.0.0.1:8083", "/api");
        var test = Proxy("test", "http://127.0.0.1:8083", "/test");
        var catchAll = Proxy("root", "http://127.0.0.1:8083");

        ProxyResolver.Resolve([api, test, catchAll], "http://127.0.0.1:8083", "127.0.0.1", "/api/orders")!.Id.Should().Be("api");
        ProxyResolver.Resolve([api, test, catchAll], "http://127.0.0.1:8083", "127.0.0.1", "/test")!.Id.Should().Be("test");
        ProxyResolver.Resolve([api, test, catchAll], "http://127.0.0.1:8083", "127.0.0.1", "/other")!.Id.Should().Be("root");
    }

    [Fact]
    public void Resolver_does_not_use_a_path_embedded_in_the_listen_url()
    {
        var api = Proxy("api", "http://127.0.0.1:8083/api");
        var test = Proxy("test", "http://127.0.0.1:8083/test");

        ProxyResolver.Resolve([api, test], "http://127.0.0.1:8083", "127.0.0.1", "/api/orders")!.Id.Should().Be("api");
        ProxyResolver.Resolve([api, test], "http://127.0.0.1:8083", "127.0.0.1", "/test/ping")!.Id.Should().Be("api");
    }

    [Fact]
    public void Yarp_config_exposes_one_public_catch_all_and_host_gated_per_proxy_routes()
    {
        var config = FileProxyConfigProvider.Build(
            [Proxy("api", "http://127.0.0.1:8083", "/api"), Proxy("test", "http://127.0.0.1:8083", "/test")],
            "http://127.0.0.1:8083",
            [],
            Path.GetTempPath());

        config.Routes.Should().ContainSingle(route => route.RouteId == FileProxyConfigProvider.SharedRouteId);
        config.Routes.Count(route => route.Match.Hosts is null).Should().Be(1);
        config.Routes.Should().Contain(route =>
            route.RouteId == "route-api" &&
            route.Match.Hosts!.Single() == FileProxyConfigProvider.InternalHost("api") &&
            route.Transforms!.Single()["PathRemovePrefix"] == "/api");
        config.Routes.Should().Contain(route => route.RouteId == "route-test");
        config.Clusters.Select(item => item.ClusterId).Should().BeEquivalentTo(["cluster-api", "cluster-test"]);
    }

    private static LoadedProxy Proxy(string id, string url, string? prefix = null) => new()
    {
        Id = id,
        FolderPath = "/",
        Definition = new ProxyDefinition
        {
            Name = id,
            Listen = new ListenConfig { Url = url, PathPrefix = prefix },
            Destination = new DestinationConfig { Address = "http://127.0.0.1:9" }
        },
        Mocks = [],
        Ignores = []
    };
}
