using ProxyMockTool.Core.Models;

namespace ProxyMockTool.Core.Matching;

public static class IgnoreMatcher
{
    public static bool IsIgnored(LoadedProxy proxy, HttpRequestSnapshot snapshot) =>
        proxy.Ignores.Any(ignore => Matches(ignore, snapshot));

    public static bool Matches(IgnoredPath ignore, HttpRequestSnapshot snapshot)
    {
        if (!PathMatcher.Matches(snapshot.Path, ignore.Path, ignore.PathMode))
        {
            return false;
        }

        if (ignore.Methods is not { Count: > 0 })
        {
            return true;
        }

        return ignore.Methods.Any(method => method.Equals(snapshot.Method, StringComparison.OrdinalIgnoreCase));
    }
}
