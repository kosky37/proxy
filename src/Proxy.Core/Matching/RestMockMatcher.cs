using System.Text.RegularExpressions;
using Proxy.Core.Models;

namespace Proxy.Core.Matching;

public static class RestMockMatcher
{
    public static bool Matches(MockDefinition mock, HttpRequestSnapshot request)
    {
        var match = mock.Match;
        if (match.Methods is { Count: > 0 } &&
            !match.Methods.Any(method => method.Equals(request.Method, StringComparison.OrdinalIgnoreCase)))
        {
            return false;
        }

        if (!PathMatcher.Matches(request.Path, match.Path, match.PathMode))
        {
            return false;
        }

        if (match.Query is { Count: > 0 })
        {
            foreach (var (key, expected) in match.Query)
            {
                if (!request.Query.TryGetValue(key, out var actual) ||
                    !actual.Equals(expected, StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
            }
        }

        if (match.Headers is { Count: > 0 })
        {
            foreach (var (key, expected) in match.Headers)
            {
                if (!TryGetHeader(request.Headers, key, out var actual) ||
                    !actual.Equals(expected, StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
            }
        }

        if (!string.IsNullOrEmpty(match.BodyContains) &&
            !request.Body.Contains(match.BodyContains, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!string.IsNullOrEmpty(match.BodyRegex) &&
            !Regex.IsMatch(request.Body, match.BodyRegex, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
        {
            return false;
        }

        if (!string.IsNullOrEmpty(match.JsonPath))
        {
            if (!JsonPathReader.TryGetString(request.Body, match.JsonPath, out var jsonValue))
            {
                return false;
            }

            if (match.JsonPathEquals is not null &&
                !string.Equals(jsonValue, match.JsonPathEquals, StringComparison.Ordinal))
            {
                return false;
            }
        }

        if (!string.IsNullOrWhiteSpace(match.XPath))
        {
            if (!XmlBody.TryParse(request.Body, out var document) ||
                document is null ||
                !XmlBody.XPathMatches(document, match.XPath))
            {
                return false;
            }
        }

        return true;
    }

    private static bool TryGetHeader(IReadOnlyDictionary<string, string> headers, string name, out string value)
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
