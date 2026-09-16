using ProxyMockTool.Core.Models;

namespace ProxyMockTool.Core.Matching;

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

    public static RequestProtocol DetectProtocol(
        HttpRequestSnapshot request,
        MockDefinition? mock,
        string? responseBody = null,
        IReadOnlyDictionary<string, string>? responseHeaders = null)
    {
        if (mock?.Type == MockType.Soap)
        {
            return RequestProtocol.Soap;
        }

        return ContentKind.Detect(request.Headers, request.Body, responseHeaders, responseBody);
    }
}
