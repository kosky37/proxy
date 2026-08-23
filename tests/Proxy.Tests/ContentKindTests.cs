using FluentAssertions;
using Proxy.Core.Matching;
using Proxy.Core.Models;

namespace Proxy.Tests;

public class ContentKindTests
{
    [Fact]
    public void Detects_soap_before_xml()
    {
        var headers = new Dictionary<string, string> { ["Content-Type"] = "text/xml" };
        ContentKind.Detect(headers, """
            <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
              <s:Body><GetAccount/></s:Body>
            </s:Envelope>
            """).Should().Be(RequestProtocol.Soap);
    }

    [Fact]
    public void Detects_json_and_plain_xml()
    {
        ContentKind.Detect(new Dictionary<string, string> { ["Content-Type"] = "application/json" }, """{"id":1}""")
            .Should().Be(RequestProtocol.Json);
        ContentKind.Detect(new Dictionary<string, string> { ["Content-Type"] = "application/xml" }, "<account id=\"1\"/>")
            .Should().Be(RequestProtocol.Xml);
    }

    [Fact]
    public void Marks_everything_else_as_other()
    {
        ContentKind.Detect(new Dictionary<string, string> { ["Content-Type"] = "text/plain" }, "hello")
            .Should().Be(RequestProtocol.Other);
        ContentKind.Detect(new Dictionary<string, string> { ["Content-Type"] = "text/html" }, "<html><body>ok</body></html>")
            .Should().Be(RequestProtocol.Other);
    }
}
