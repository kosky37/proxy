using Proxy.Core.Models;

namespace Proxy.Core.Matching;

public static class ListenPath
{
    public static string? EffectivePrefix(ListenConfig listen)
    {
        if (string.IsNullOrWhiteSpace(listen.PathPrefix))
        {
            return null;
        }

        var prefix = PathMatcher.Normalize(listen.PathPrefix);
        return prefix == "/" ? null : prefix;
    }

    public static ListenConfig Normalize(ListenConfig listen)
    {
        listen.PathPrefix = EffectivePrefix(listen);
        return listen;
    }
}
