using System.Text.Json;
using System.Xml;
using System.Xml.Linq;
using Proxy.Core.Models;

namespace Proxy.Core.Matching;

public static class ContentKind
{
    public static RequestProtocol Classify(RequestLogEntry entry) =>
        Detect(
            HeaderJson.Parse(entry.RequestHeaders),
            entry.RequestBody,
            HeaderJson.Parse(entry.ResponseHeaders),
            entry.ResponseBody);

    public static RequestProtocol Detect(
        IReadOnlyDictionary<string, string>? requestHeaders,
        string? requestBody,
        IReadOnlyDictionary<string, string>? responseHeaders = null,
        string? responseBody = null)
    {
        var request = requestHeaders ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var response = responseHeaders ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        if (SoapEnvelope.LooksLikeSoap(request, requestBody) || SoapEnvelope.LooksLikeSoap(response, responseBody))
        {
            return RequestProtocol.Soap;
        }

        if (LooksLikeJson(request, requestBody) || LooksLikeJson(response, responseBody))
        {
            return RequestProtocol.Json;
        }

        if (LooksLikeXml(request, requestBody) || LooksLikeXml(response, responseBody))
        {
            return RequestProtocol.Xml;
        }

        return RequestProtocol.Other;
    }

    public static RequestProtocol Normalize(RequestProtocol protocol) =>
        protocol == RequestProtocol.Rest ? RequestProtocol.Other : protocol;

    private static bool LooksLikeJson(IReadOnlyDictionary<string, string> headers, string? body)
    {
        if (HasMediaType(headers, "json"))
        {
            return true;
        }

        var trimmed = body?.TrimStart();
        if (string.IsNullOrEmpty(trimmed) || (trimmed[0] is not '{' and not '['))
        {
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(trimmed);
            return document.RootElement.ValueKind is JsonValueKind.Object or JsonValueKind.Array;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool LooksLikeXml(IReadOnlyDictionary<string, string> headers, string? body)
    {
        if (HasMediaType(headers, "html"))
        {
            return false;
        }

        if (HasMediaType(headers, "xml"))
        {
            return true;
        }

        var trimmed = body?.TrimStart();
        if (string.IsNullOrEmpty(trimmed) || trimmed[0] != '<')
        {
            return false;
        }

        if (trimmed.StartsWith("<!DOCTYPE html", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("<html", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        try
        {
            XDocument.Parse(trimmed, LoadOptions.None);
            return true;
        }
        catch (XmlException)
        {
            return false;
        }
    }

    private static bool HasMediaType(IReadOnlyDictionary<string, string> headers, string token)
    {
        foreach (var (key, value) in headers)
        {
            if (key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase) &&
                value.Contains(token, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
