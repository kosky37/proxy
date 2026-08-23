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

        var parsed = SoapEnvelope.TryParse(request.Body, out var document, out var operation);
        if (!string.IsNullOrWhiteSpace(match.Operation))
        {
            if (!parsed || !string.Equals(operation, match.Operation, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        if (!string.IsNullOrWhiteSpace(match.XPath))
        {
            if (!parsed || document is null || !SoapEnvelope.XPathMatches(document, match.XPath))
            {
                return false;
            }
        }

        return true;
    }
}
