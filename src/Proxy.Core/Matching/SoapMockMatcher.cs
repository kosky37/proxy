using Proxy.Core.Models;

namespace Proxy.Core.Matching;

public static class SoapMockMatcher
{
    public static bool Matches(MockDefinition mock, HttpRequestSnapshot request)
    {
        if (!SoapEnvelope.LooksLikeSoap(request.Headers, request.Body))
        {
            return false;
        }

        var match = mock.Match;
        if (!PathMatcher.Matches(request.Path, match.Path, match.PathMode))
        {
            return false;
        }

        var actualAction = SoapEnvelope.GetSoapAction(request.Headers);
        if (!SoapEnvelope.ActionsEqual(match.SoapAction, actualAction))
        {
            return false;
        }

        if (!string.IsNullOrEmpty(match.BodyContains) &&
            !request.Body.Contains(match.BodyContains, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var needsXml = !string.IsNullOrWhiteSpace(match.Operation) || !string.IsNullOrWhiteSpace(match.XPath);
        if (!needsXml)
        {
            return true;
        }

        if (!SoapEnvelope.TryParse(request.Body, out var document, out var operation))
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(match.Operation) &&
            !string.Equals(operation, match.Operation, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return string.IsNullOrWhiteSpace(match.XPath) ||
               document is not null && XmlBody.XPathMatches(document, match.XPath);
    }
}
