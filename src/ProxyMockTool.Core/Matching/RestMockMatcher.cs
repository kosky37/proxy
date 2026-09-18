using System.Text.RegularExpressions;
using ProxyMockTool.Core.Models;

namespace ProxyMockTool.Core.Matching;

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

        if (!QueryMatcher.Matches(match.Query, request.Query))
        {
            return false;
        }

        if (!HeaderMatcher.Matches(match.Headers, request.Headers))
        {
            return false;
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
}
