using Proxy.Core.Models;

namespace Proxy.Core.Matching;

public static class ListenPath
{
    public static string? EffectivePrefix(ListenConfig listen)
    {
        if (!string.IsNullOrWhiteSpace(listen.PathPrefix))
        {
            return NullIfRoot(PathMatcher.Normalize(listen.PathPrefix));
        }

        if (Uri.TryCreate(listen.Url, UriKind.Absolute, out var uri))
        {
            return NullIfRoot(PathMatcher.Normalize(uri.AbsolutePath));
        }

        return null;
    }

    public static ListenConfig Normalize(ListenConfig listen)
    {
        var prefix = EffectivePrefix(listen);
        if (Uri.TryCreate(listen.Url, UriKind.Absolute, out var uri))
        {
            listen.Url = $"{uri.Scheme}://{uri.Host}:{uri.Port}";
        }

        listen.PathPrefix = prefix;
        return listen;
    }

    private static string? NullIfRoot(string prefix) => prefix == "/" ? null : prefix;
}
