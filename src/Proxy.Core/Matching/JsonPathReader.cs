using System.Text.Json;

namespace Proxy.Core.Matching;

public static class JsonPathReader
{
    public static bool TryGetString(string json, string path, out string? value)
    {
        value = null;
        try
        {
            using var document = JsonDocument.Parse(json);
            var current = document.RootElement;
            foreach (var segment in Split(path))
            {
                if (current.ValueKind == JsonValueKind.Array && int.TryParse(segment, out var index))
                {
                    if (index < 0 || index >= current.GetArrayLength())
                    {
                        return false;
                    }

                    current = current[index];
                    continue;
                }

                if (current.ValueKind != JsonValueKind.Object || !current.TryGetProperty(segment, out var next))
                {
                    return false;
                }

                current = next;
            }

            value = current.ValueKind switch
            {
                JsonValueKind.String => current.GetString(),
                JsonValueKind.Number => current.GetRawText(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                JsonValueKind.Null => null,
                _ => current.GetRawText()
            };
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static IEnumerable<string> Split(string path)
    {
        var trimmed = path.Trim();
        if (trimmed.StartsWith('$'))
        {
            trimmed = trimmed[1..];
        }

        if (trimmed.StartsWith('.'))
        {
            trimmed = trimmed[1..];
        }

        if (trimmed.StartsWith('/'))
        {
            trimmed = trimmed[1..];
        }

        foreach (var part in trimmed.Split('.', StringSplitOptions.RemoveEmptyEntries))
        {
            var start = 0;
            while (start < part.Length)
            {
                var bracket = part.IndexOf('[', start);
                if (bracket < 0)
                {
                    if (start < part.Length)
                    {
                        yield return part[start..];
                    }

                    break;
                }

                if (bracket > start)
                {
                    yield return part[start..bracket];
                }

                var end = part.IndexOf(']', bracket);
                if (end < 0)
                {
                    yield return part[start..];
                    break;
                }

                yield return part[(bracket + 1)..end];
                start = end + 1;
            }
        }
    }
}
