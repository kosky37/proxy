using FluentAssertions;
using Proxy.Api.Contracts;
using Proxy.Core.Models;

namespace Proxy.Tests;

public class LogSummaryTests
{
    [Fact]
    public void Reads_content_type_sizes_and_soap_action()
    {
        var entry = new RequestLogEntry
        {
            Protocol = RequestProtocol.Soap,
            RequestHeaders = """
                {
                  "Content-Type": "text/xml; charset=utf-8",
                  "SOAPAction": "\"GetAccount\""
                }
                """,
            RequestBody = "<ok/>",
            ResponseBody = "<s:Envelope/>",
            ResponseHeaders = """{ "Content-Type": "text/xml" }"""
        };

        LogSummary.ContentType(entry).Should().Be("text/xml");
        LogSummary.SoapAction(entry).Should().Be("GetAccount");
        LogSummary.RequestBytes(entry).Should().BeGreaterThan(0);
        LogSummary.ResponseBytes(entry).Should().BeGreaterThan(0);
    }
}
