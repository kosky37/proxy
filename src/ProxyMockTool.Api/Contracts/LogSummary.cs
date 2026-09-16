using System.Text;
using System.Text.Json;
using ProxyMockTool.Core.Matching;
using ProxyMockTool.Core.Models;

namespace ProxyMockTool.Api.Contracts;

public static class LogSummary
{
    public static string? ContentType(RequestLogEntry entry) =>
        MediaType(Header(entry.RequestHeaders, "Content-Type"))
        ?? MediaType(Header(entry.ResponseHeaders, "Content-Type"));

    public static string? SoapAction(RequestLogEntry entry)
    {
        if (entry.Protocol != RequestProtocol.Soap)
        {
            return null;
        }

        return SoapEnvelope.GetSoapAction(ParseHeaders(entry.RequestHeaders));
    }

    public static int RequestBytes(RequestLogEntry entry) =>
        entry.RequestBodyOriginalBytes > 0 ? entry.RequestBodyOriginalBytes : ByteCount(entry.RequestBody);

    public static int ResponseBytes(RequestLogEntry entry) =>
        entry.ResponseBodyOriginalBytes > 0 ? entry.ResponseBodyOriginalBytes : ByteCount(entry.ResponseBody);

    private static int ByteCount(string? text) =>
        string.IsNullOrEmpty(text) ? 0 : Encoding.UTF8.GetByteCount(text);

    private static string? MediaType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var separator = value.IndexOf(';');
        return (separator < 0 ? value : value[..separator]).Trim();
    }

    private static string? Header(string? json, string name)
    {
        var headers = ParseHeaders(json);
        foreach (var (key, value) in headers)
        {
            if (key.Equals(name, StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
    }

    private static Dictionary<string, string> ParseHeaders(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
            return parsed is null
                ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, string>(parsed, StringComparer.OrdinalIgnoreCase);
        }
        catch (JsonException)
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
    }
}
