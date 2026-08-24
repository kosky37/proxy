using System.IO.Compression;
using System.Text;
using FluentAssertions;
using Proxy.Infrastructure.Http;

namespace Proxy.Tests;

public class HttpContentDecoderTests
{
    [Fact]
    public void Gzip_body_is_decoded_to_text()
    {
        var json = """{"ok":true}""";
        var bytes = Gzip(json);

        HttpContentDecoder.ToText(bytes, "gzip", "application/json").Should().Be(json);
        HttpContentDecoder.ToText(bytes, null).Should().Be(json);
    }

    [Fact]
    public void Brotli_body_is_decoded_to_text()
    {
        var xml = "<ok/>";
        using var input = new MemoryStream(Encoding.UTF8.GetBytes(xml));
        using var output = new MemoryStream();
        using (var brotli = new BrotliStream(output, CompressionLevel.Fastest, leaveOpen: true))
        {
            input.CopyTo(brotli);
        }

        HttpContentDecoder.ToText(output.ToArray(), "br", "application/xml").Should().Be(xml);
    }

    [Fact]
    public void Plain_body_is_unchanged()
    {
        HttpContentDecoder.ToText("hello"u8.ToArray(), "identity").Should().Be("hello");
        HttpContentDecoder.ToText("hello"u8.ToArray(), null).Should().Be("hello");
    }

    private static byte[] Gzip(string text)
    {
        using var output = new MemoryStream();
        using (var gzip = new GZipStream(output, CompressionLevel.Fastest, leaveOpen: true))
        {
            gzip.Write(Encoding.UTF8.GetBytes(text));
        }

        return output.ToArray();
    }
}
