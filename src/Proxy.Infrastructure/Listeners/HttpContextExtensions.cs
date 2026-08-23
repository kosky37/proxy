using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Proxy.Core.Models;

namespace Proxy.Infrastructure.Listeners;

public static class HttpContextExtensions
{
    public static async Task<HttpRequestSnapshot> ToSnapshotAsync(this HttpRequest request, CancellationToken cancellationToken)
    {
        request.EnableBuffering();
        string body;
        using (var reader = new StreamReader(request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true))
        {
            body = await reader.ReadToEndAsync(cancellationToken);
        }

        request.Body.Position = 0;

        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var header in request.Headers)
        {
            headers[header.Key] = header.Value.ToString();
        }

        var query = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in request.Query)
        {
            query[item.Key] = item.Value.ToString();
        }

        return new HttpRequestSnapshot
        {
            Method = request.Method,
            Path = request.Path.HasValue ? request.Path.Value! : "/",
            Query = query,
            Headers = headers,
            Body = body
        };
    }

    public static string HeadersToJson(this IHeaderDictionary headers) =>
        JsonSerializer.Serialize(
            headers.ToDictionary(item => item.Key, item => item.Value.ToString(), StringComparer.OrdinalIgnoreCase),
            new JsonSerializerOptions { WriteIndented = true });

    public static string HeadersToJson(this IReadOnlyDictionary<string, string> headers) =>
        JsonSerializer.Serialize(headers, new JsonSerializerOptions { WriteIndented = true });
}
