using System.Xml;
using System.Xml.Linq;

namespace Proxy.Core.Matching;

public static class SoapEnvelope
{
    public static bool LooksLikeSoap(IReadOnlyDictionary<string, string> headers, string? body)
    {
        if (GetSoapAction(headers) is not null)
        {
            return true;
        }

        if (TryGetHeader(headers, "Content-Type", out var contentType) &&
            contentType.Contains("application/soap+xml", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return TryParse(body, out _, out _);
    }

    public static string? GetSoapAction(IReadOnlyDictionary<string, string> headers)
    {
        if (TryGetHeader(headers, "SOAPAction", out var soapAction) && !string.IsNullOrWhiteSpace(soapAction))
        {
            return NormalizeAction(soapAction);
        }

        if (TryGetHeader(headers, "Content-Type", out var contentType))
        {
            var action = GetMediaTypeParameter(contentType, "action");
            if (!string.IsNullOrWhiteSpace(action))
            {
                return NormalizeAction(action);
            }
        }

        return null;
    }

    public static bool TryParse(string? body, out XDocument? document, out string? operation)
    {
        document = null;
        operation = null;
        if (string.IsNullOrWhiteSpace(body))
        {
            return false;
        }

        try
        {
            document = XDocument.Parse(body, LoadOptions.PreserveWhitespace);
            var envelope = document.Descendants().FirstOrDefault(element => element.Name.LocalName == "Envelope");
            if (envelope is null)
            {
                document = null;
                return false;
            }

            var bodyElement = envelope.Descendants().FirstOrDefault(element => element.Name.LocalName == "Body");
            operation = bodyElement?.Elements().FirstOrDefault()?.Name.LocalName;
            return true;
        }
        catch (XmlException)
        {
            return false;
        }
    }

    public static bool XPathMatches(XDocument document, string xpath) => XmlBody.XPathMatches(document, xpath);

    public static bool ActionsEqual(string? expected, string? actual)
    {
        if (string.IsNullOrWhiteSpace(expected))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(actual))
        {
            return false;
        }

        var left = NormalizeAction(expected);
        var right = NormalizeAction(actual);
        if (left.Equals(right, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return LocalName(right).Equals(LocalName(left), StringComparison.OrdinalIgnoreCase);
    }

    public static string NormalizeAction(string value)
    {
        return value.Trim().Trim('"');
    }

    public static string LocalName(string action)
    {
        var slash = action.LastIndexOf('/');
        var hash = action.LastIndexOf('#');
        var index = Math.Max(slash, hash);
        return index >= 0 && index < action.Length - 1 ? action[(index + 1)..] : action;
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

    private static string? GetMediaTypeParameter(string contentType, string name)
    {
        foreach (var part in contentType.Split(';'))
        {
            var trimmed = part.Trim();
            var equals = trimmed.IndexOf('=');
            if (equals <= 0)
            {
                continue;
            }

            var key = trimmed[..equals].Trim();
            if (key.Equals(name, StringComparison.OrdinalIgnoreCase))
            {
                return trimmed[(equals + 1)..].Trim().Trim('"');
            }
        }

        return null;
    }
}
