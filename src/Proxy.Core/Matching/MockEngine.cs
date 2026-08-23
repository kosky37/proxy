using Proxy.Core.Models;

namespace Proxy.Core.Matching;

public sealed class MockEngine
{
    public MockDefinition? FindMatch(LoadedProxy proxy, HttpRequestSnapshot request)
    {
        if (!proxy.Definition.MocksEnabled)
        {
            return null;
        }

        foreach (var mock in proxy.Mocks
                     .Where(item => item.Enabled)
                     .OrderBy(item => item.FileName, StringComparer.OrdinalIgnoreCase))
        {
            var matched = mock.Type switch
            {
                MockType.Soap => SoapMockMatcher.Matches(mock, request),
                _ => RestMockMatcher.Matches(mock, request)
            };

            if (matched)
            {
                return mock;
            }
        }

        return null;
    }

    public static RequestProtocol DetectProtocol(HttpRequestSnapshot request, MockDefinition? mock)
    {
        if (mock is not null)
        {
            return mock.Type == MockType.Soap ? RequestProtocol.Soap : RequestProtocol.Rest;
        }

        if (SoapEnvelope.GetSoapAction(request.Headers) is not null)
        {
            return RequestProtocol.Soap;
        }

        if (request.Headers.Any(header =>
                header.Key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase) &&
                (header.Value.Contains("xml", StringComparison.OrdinalIgnoreCase) ||
                 header.Value.Contains("soap", StringComparison.OrdinalIgnoreCase))) &&
            request.Body.Contains("Envelope", StringComparison.OrdinalIgnoreCase))
        {
            return RequestProtocol.Soap;
        }

        return RequestProtocol.Rest;
    }
}
