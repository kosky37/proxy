using Proxy.Core.Models;

namespace Proxy.Core.Matching;

public static class PathMatcher
{
    public static bool Matches(string requestPath, string? pattern, PathMatchMode mode)
    {
        if (string.IsNullOrWhiteSpace(pattern))
        {
            return true;
        }

        var path = Normalize(requestPath);
        var expected = Normalize(pattern);

        return mode switch
        {
            PathMatchMode.Prefix => path.Equals(expected, StringComparison.OrdinalIgnoreCase)
                || path.StartsWith(expected.TrimEnd('/') + "/", StringComparison.OrdinalIgnoreCase),
            PathMatchMode.Template => MatchesTemplate(path, expected),
            _ => path.Equals(expected, StringComparison.OrdinalIgnoreCase)
        };
    }

    public static string Normalize(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return "/";
        }

        var value = path.Trim();
        if (!value.StartsWith('/'))
        {
            value = "/" + value;
        }

        if (value.Length > 1)
        {
            value = value.TrimEnd('/');
        }

        return value;
    }

    public static string StripPrefix(string path, string? prefix)
    {
        var relative = Normalize(string.IsNullOrWhiteSpace(path) ? "/" : path);
        if (string.IsNullOrWhiteSpace(prefix))
        {
            return relative;
        }

        var expected = Normalize(prefix);
        if (relative.Equals(expected, StringComparison.OrdinalIgnoreCase))
        {
            return "/";
        }

        if (relative.StartsWith(expected + "/", StringComparison.OrdinalIgnoreCase))
        {
            var remainder = relative[expected.Length..];
            return string.IsNullOrEmpty(remainder) ? "/" : remainder;
        }

        return relative;
    }

    private static bool MatchesTemplate(string path, string template)
    {
        var pathParts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var templateParts = template.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (pathParts.Length != templateParts.Length)
        {
            return false;
        }

        for (var i = 0; i < pathParts.Length; i++)
        {
            var part = templateParts[i];
            if (part.StartsWith('{') && part.EndsWith('}') && part.Length > 2)
            {
                continue;
            }

            if (!pathParts[i].Equals(part, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        return true;
    }
}
