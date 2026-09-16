using AwesomeAssertions;
using ProxyMockTool.Core.Matching;
using ProxyMockTool.Core.Models;

namespace ProxyMockTool.Tests;

public class RestMockMatcherTests
{
    [Fact]
    public void Matches_method_path_and_json_path()
    {
        var mock = new MockDefinition
        {
            Type = MockType.Rest,
            Match = new MockMatch
            {
                Methods = ["POST"],
                Path = "/api/users/{id}",
                PathMode = PathMatchMode.Template,
                JsonPath = "$.user.id",
                JsonPathEquals = "12"
            }
        };

        var request = Snapshot("POST", "/api/users/9", """{"user":{"id":"12"}}""");
        RestMockMatcher.Matches(mock, request).Should().BeTrue();
    }

    [Fact]
    public void Rejects_method_mismatch()
    {
        var mock = new MockDefinition
        {
            Match = new MockMatch { Methods = ["GET"], Path = "/hello" }
        };

        RestMockMatcher.Matches(mock, Snapshot("POST", "/hello")).Should().BeFalse();
    }

    [Fact]
    public void Matches_prefix_and_header()
    {
        var mock = new MockDefinition
        {
            Match = new MockMatch
            {
                Path = "/api",
                PathMode = PathMatchMode.Prefix,
                Headers = new Dictionary<string, string> { ["X-Test"] = "yes" }
            }
        };

        var request = Snapshot("GET", "/api/items/1", headers: new Dictionary<string, string> { ["x-test"] = "yes" });
        RestMockMatcher.Matches(mock, request).Should().BeTrue();
    }

    [Fact]
    public void Matches_xml_xpath()
    {
        var mock = new MockDefinition
        {
            Match = new MockMatch
            {
                Path = "/accounts",
                XPath = "//*[local-name()='AccountId' and text()='12']"
            }
        };

        RestMockMatcher.Matches(
            mock,
            Snapshot("POST", "/accounts", "<Account><AccountId>12</AccountId></Account>")).Should().BeTrue();
        RestMockMatcher.Matches(
            mock,
            Snapshot("POST", "/accounts", """{"AccountId":"12"}""")).Should().BeFalse();
    }

    [Fact]
    public void Matches_body_contains_and_regex()
    {
        var mock = new MockDefinition
        {
            Match = new MockMatch
            {
                BodyContains = "Ada",
                BodyRegex = "id\":\\s*1"
            }
        };

        RestMockMatcher.Matches(mock, Snapshot("POST", "/", """{"id": 1, "name":"Ada"}""")).Should().BeTrue();
    }

    [Fact]
    public void Engine_skips_disabled_mocks_and_uses_filename_order()
    {
        var proxy = new LoadedProxy
        {
            Id = "p",
            FolderPath = "",
            Definition = new ProxyDefinition { MocksEnabled = true },
            Ignores = [],
            Mocks =
            [
                new MockDefinition
                {
                    Name = "second",
                    FileName = "b.json",
                    Enabled = true,
                    Match = new MockMatch { Path = "/x" },
                    Response = new MockResponse { StatusCode = 201 }
                },
                new MockDefinition
                {
                    Name = "first",
                    FileName = "a.json",
                    Enabled = true,
                    Match = new MockMatch { Path = "/x" },
                    Response = new MockResponse { StatusCode = 200 }
                },
                new MockDefinition
                {
                    Name = "disabled",
                    FileName = "_z.json",
                    Enabled = false,
                    Match = new MockMatch { Path = "/x" },
                    Response = new MockResponse { StatusCode = 500 }
                }
            ]
        };

        var match = new MockEngine().FindMatch(proxy, Snapshot("GET", "/x"));
        match!.Name.Should().Be("first");
    }

    private static HttpRequestSnapshot Snapshot(
        string method,
        string path,
        string body = "",
        Dictionary<string, string>? headers = null) =>
        new()
        {
            Method = method,
            Path = path,
            Query = new Dictionary<string, string>(),
            Headers = headers ?? new Dictionary<string, string>(),
            Body = body
        };
}
