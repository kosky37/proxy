using AwesomeAssertions;
using Proxy.Core.Matching;
using Proxy.Core.Models;

namespace Proxy.Tests;

public class SoapMockMatcherTests
{
    private const string Envelope = """
        <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
          <s:Body>
            <GetAccount>
              <AccountId>999</AccountId>
            </GetAccount>
          </s:Body>
        </s:Envelope>
        """;

    [Fact]
    public void Matches_soap_action_operation_and_xpath()
    {
        var mock = new MockDefinition
        {
            Type = MockType.Soap,
            Match = new MockMatch
            {
                SoapAction = "http://tempuri.org/GetAccount",
                Operation = "GetAccount",
                XPath = "//*[local-name()='AccountId' and text()='999']"
            }
        };

        var request = Snapshot(Envelope, new Dictionary<string, string>
        {
            ["SOAPAction"] = "\"GetAccount\""
        });

        SoapMockMatcher.Matches(mock, request).Should().BeTrue();
    }

    [Fact]
    public void Matches_plain_text_in_the_body_without_xpath_or_operation()
    {
        var mock = new MockDefinition
        {
            Type = MockType.Soap,
            Match = new MockMatch
            {
                SoapAction = "GetAccount",
                BodyContains = "accountid>999"
            }
        };

        SoapMockMatcher.Matches(mock, Snapshot(Envelope, new Dictionary<string, string>
        {
            ["SOAPAction"] = "\"GetAccount\""
        })).Should().BeTrue();
        SoapMockMatcher.Matches(mock, Snapshot(Envelope.Replace("999", "1"), new Dictionary<string, string>
        {
            ["SOAPAction"] = "\"GetAccount\""
        })).Should().BeFalse();
    }

    [Fact]
    public void Matches_request_headers()
    {
        var mock = new MockDefinition
        {
            Type = MockType.Soap,
            Match = new MockMatch
            {
                Headers = new Dictionary<string, string> { ["X-Tenant"] = "acme" }
            }
        };

        SoapMockMatcher.Matches(mock, Snapshot(Envelope, new Dictionary<string, string>
        {
            ["SOAPAction"] = "\"GetAccount\"",
            ["x-tenant"] = "acme"
        })).Should().BeTrue();
        SoapMockMatcher.Matches(mock, Snapshot(Envelope, new Dictionary<string, string>
        {
            ["SOAPAction"] = "\"GetAccount\""
        })).Should().BeFalse();
    }

    [Fact]
    public void Matches_by_soap_action_and_path()
    {
        var mock = new MockDefinition
        {
            Type = MockType.Soap,
            Match = new MockMatch
            {
                Path = "/service",
                SoapAction = "GetAccount"
            }
        };

        // Empty path matches any endpoint.
        var emptyPathMock = new MockDefinition
        {
            Type = MockType.Soap,
            Match = new MockMatch { SoapAction = "GetAccount" }
        };

        SoapMockMatcher.Matches(mock, Snapshot(Envelope, new Dictionary<string, string>
        {
            ["SOAPAction"] = "\"GetAccount\""
        }, "/service")).Should().BeTrue();

        // Different path does not match.
        SoapMockMatcher.Matches(mock, Snapshot(Envelope, new Dictionary<string, string>
        {
            ["SOAPAction"] = "\"GetAccount\""
        }, "/other")).Should().BeFalse();

        // Empty path matches any endpoint.
        SoapMockMatcher.Matches(emptyPathMock, Snapshot(Envelope, new Dictionary<string, string>
        {
            ["SOAPAction"] = "\"GetAccount\""
        }, "/any-path")).Should().BeTrue();
    }

    [Fact]
    public void Matches_soap_action_without_reading_the_body()
    {
        var mock = new MockDefinition
        {
            Type = MockType.Soap,
            Match = new MockMatch { SoapAction = "GetAccount" }
        };

        SoapMockMatcher.Matches(mock, Snapshot("not-xml", new Dictionary<string, string>
        {
            ["SOAPAction"] = "\"GetAccount\""
        })).Should().BeTrue();
    }

    [Fact]
    public void Matches_soap12_action_header()
    {
        var mock = new MockDefinition
        {
            Type = MockType.Soap,
            Match = new MockMatch { SoapAction = "GetAccount" }
        };

        var request = Snapshot(Envelope, new Dictionary<string, string>
        {
            ["Content-Type"] = "application/soap+xml; charset=utf-8; action=\"http://tempuri.org/GetAccount\""
        });

        SoapMockMatcher.Matches(mock, request).Should().BeTrue();
    }

    [Fact]
    public void Rejects_when_xpath_does_not_match()
    {
        var mock = new MockDefinition
        {
            Type = MockType.Soap,
            Match = new MockMatch
            {
                Operation = "GetAccount",
                XPath = "//*[local-name()='AccountId' and text()='1']"
            }
        };

        SoapMockMatcher.Matches(mock, Snapshot(Envelope)).Should().BeFalse();
    }

    [Fact]
    public void Rejects_non_soap_requests_even_when_match_is_empty()
    {
        var mock = new MockDefinition { Type = MockType.Soap, Match = new MockMatch() };

        SoapMockMatcher.Matches(mock, Snapshot("", new Dictionary<string, string>
        {
            ["Content-Type"] = "application/json"
        })).Should().BeFalse();

        SoapMockMatcher.Matches(mock, new HttpRequestSnapshot
        {
            Method = "GET",
            Path = "/hello",
            Query = new Dictionary<string, string>(),
            Headers = new Dictionary<string, string>(),
            Body = ""
        }).Should().BeFalse();
    }

    [Fact]
    public void Rejects_plain_xml_that_is_not_an_envelope()
    {
        var mock = new MockDefinition { Type = MockType.Soap, Match = new MockMatch() };

        SoapMockMatcher.Matches(mock, Snapshot("<root><id>1</id></root>", new Dictionary<string, string>
        {
            ["Content-Type"] = "text/xml"
        })).Should().BeFalse();
    }

    [Fact]
    public void Detects_soap_protocol_from_envelope()
    {
        var snapshot = Snapshot(Envelope, new Dictionary<string, string>
        {
            ["Content-Type"] = "text/xml"
        });

        MockEngine.DetectProtocol(snapshot, null).Should().Be(RequestProtocol.Soap);
    }

    private static HttpRequestSnapshot Snapshot(
        string body,
        Dictionary<string, string>? headers = null,
        string path = "/service") =>
        new()
        {
            Method = "POST",
            Path = path,
            Query = new Dictionary<string, string>(),
            Headers = headers ?? new Dictionary<string, string>(),
            Body = body
        };
}
