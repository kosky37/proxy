namespace Proxy.Core.Matching;

public static class HeaderMatcher
{
    public static bool Matches(IReadOnlyDictionary<string, string>? expected, IReadOnlyDictionary<string, string> actual)
    {
        if (expected is not { Count: > 0 })
        {
            return true;
        }

        foreach (var (key, value) in expected)
        {
            if (!TryGet(actual, key, out var found) ||
                !found.Equals(value, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        return true;
    }

    public static bool TryGet(IReadOnlyDictionary<string, string> headers, string name, out string value)
    {
        foreach (var (key, header) in headers)
        {
            if (key.Equals(name, StringComparison.OrdinalIgnoreCase))
            {
                value = header;
                return true;
            }
        }

        value = "";
        return false;
    }
}
