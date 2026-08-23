using Proxy.Core.Models;

namespace Proxy.Core.Matching;

public static class ProxyResolver
{
    public static LoadedProxy? Resolve(IEnumerable<LoadedProxy> proxies, string listenUrl, string host, string path)
    {
        return proxies
            .Where(proxy => proxy.Definition.Enabled)
            .Where(proxy => ListenUrlsEqual(proxy.Definition.Listen.Url, listenUrl))
            .Where(proxy => HostMatches(proxy.Definition.Listen.Hosts, host))
            .Where(proxy => PathMatches(ListenPath.EffectivePrefix(proxy.Definition.Listen), path))
            .OrderByDescending(proxy => PathMatcher.Normalize(ListenPath.EffectivePrefix(proxy.Definition.Listen) ?? "/").Length)
            .ThenBy(proxy => proxy.Id, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault();
    }

    public static bool ListenUrlsEqual(string? left, string? right)
    {
        if (!Uri.TryCreate(left, UriKind.Absolute, out var leftUri) ||
            !Uri.TryCreate(right, UriKind.Absolute, out var rightUri))
        {
            return string.Equals(left, right, StringComparison.OrdinalIgnoreCase);
        }

        return leftUri.Scheme.Equals(rightUri.Scheme, StringComparison.OrdinalIgnoreCase) &&
               leftUri.Host.Equals(rightUri.Host, StringComparison.OrdinalIgnoreCase) &&
               leftUri.Port == rightUri.Port;
    }

    public static string NormalizeListenUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return url.Trim();
        }

        return $"{uri.Scheme.ToLowerInvariant()}://{uri.Host.ToLowerInvariant()}:{uri.Port}";
    }

    private static bool HostMatches(IReadOnlyList<string>? hosts, string host)
    {
        if (hosts is null || hosts.Count == 0)
        {
            return true;
        }

        var requestHost = host.Split(':')[0];
        return hosts.Any(configured =>
        {
            var value = configured.Split(':')[0];
            return value.Equals(requestHost, StringComparison.OrdinalIgnoreCase) ||
                   configured.Equals(host, StringComparison.OrdinalIgnoreCase);
        });
    }

    private static bool PathMatches(string? pathPrefix, string path)
    {
        if (string.IsNullOrWhiteSpace(pathPrefix))
        {
            return true;
        }

        return PathMatcher.Matches(path, pathPrefix, PathMatchMode.Prefix);
    }
}
