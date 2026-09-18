namespace ProxyMockTool.Core.Matching;

/// <summary>
/// Compares query parameters one by one, so a mock matches regardless of the order
/// the parameters appear in the URL and regardless of extra parameters the caller adds.
/// </summary>
public static class QueryMatcher
{
    public static bool Matches(IReadOnlyDictionary<string, string>? expected, IReadOnlyDictionary<string, string> actual)
    {
        if (expected is not { Count: > 0 })
        {
            return true;
        }

        foreach (var (key, value) in expected)
        {
            // Names are compared case-insensitively, like every other HTTP name in the app.
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            if (!HeaderMatcher.TryGet(actual, key, out var found))
            {
                return false;
            }

            // An empty expected value only requires the parameter to be present, with any value.
            if (value.Length > 0 && !found.Equals(value, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        return true;
    }
}
