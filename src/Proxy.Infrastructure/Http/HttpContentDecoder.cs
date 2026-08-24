using System.IO.Compression;
using System.Text;

namespace Proxy.Infrastructure.Http;

public static class HttpContentDecoder
{
    public static string ToText(ReadOnlySpan<byte> bytes, string? contentEncoding, string? contentType = null)
    {
        if (bytes.IsEmpty)
        {
            return "";
        }

        var decoded = Decode(bytes.ToArray(), contentEncoding);
        return EncodingFor(contentType).GetString(decoded);
    }

    public static byte[] Decode(byte[] bytes, string? contentEncoding)
    {
        if (bytes.Length == 0)
        {
            return bytes;
        }

        var encodings = ParseEncodings(contentEncoding);
        if (encodings.Count == 0 && LooksLikeGzip(bytes))
        {
            encodings.Add("gzip");
        }

        var current = bytes;
        try
        {
            for (var i = encodings.Count - 1; i >= 0; i--)
            {
                current = encodings[i] switch
                {
                    "gzip" => Inflate(current, stream => new GZipStream(stream, CompressionMode.Decompress)),
                    "deflate" => InflateDeflate(current),
                    "br" => Inflate(current, stream => new BrotliStream(stream, CompressionMode.Decompress)),
                    "identity" => current,
                    _ => current
                };
            }
        }
        catch (InvalidDataException)
        {
            return bytes;
        }
        catch (InvalidOperationException)
        {
            return bytes;
        }

        return current;
    }

    private static List<string> ParseEncodings(string? contentEncoding)
    {
        if (string.IsNullOrWhiteSpace(contentEncoding))
        {
            return [];
        }

        return contentEncoding
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(value => value.Split(';', 2)[0].Trim().ToLowerInvariant())
            .Where(value => value is not "*" and not "")
            .ToList();
    }

    private static byte[] InflateDeflate(byte[] bytes)
    {
        try
        {
            return Inflate(bytes, stream => new ZLibStream(stream, CompressionMode.Decompress));
        }
        catch (InvalidDataException)
        {
            return Inflate(bytes, stream => new DeflateStream(stream, CompressionMode.Decompress));
        }
    }

    private static byte[] Inflate(byte[] bytes, Func<Stream, Stream> create)
    {
        using var input = new MemoryStream(bytes);
        using var decoder = create(input);
        using var output = new MemoryStream();
        decoder.CopyTo(output);
        return output.ToArray();
    }

    private static bool LooksLikeGzip(ReadOnlySpan<byte> bytes) =>
        bytes.Length >= 2 && bytes[0] == 0x1F && bytes[1] == 0x8B;

    private static Encoding EncodingFor(string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType))
        {
            return new UTF8Encoding(false, false);
        }

        const string marker = "charset=";
        var index = contentType.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            return new UTF8Encoding(false, false);
        }

        var charset = contentType[(index + marker.Length)..].Trim().Trim('"', '\'').Split(';', 2)[0].Trim();
        try
        {
            return Encoding.GetEncoding(charset);
        }
        catch (ArgumentException)
        {
            return new UTF8Encoding(false, false);
        }
    }
}
