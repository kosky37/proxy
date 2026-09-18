using System.Net;
using System.Text;
using System.Text.Json;
using AwesomeAssertions;
using ProxyMockTool.Core.Models;
using ProxyMockTool.Infrastructure.Logging;

namespace ProxyMockTool.Tests;

public class GlobalLogsTests
{
    [Fact]
    public async Task Merges_logs_and_timeline_from_selected_proxies()
    {
        await using var factory = new ProxyApiFactory();
        using var client = factory.CreateClient();
        await CreateProxy(client, "alpha", "Alpha");
        await CreateProxy(client, "beta", "Beta");

        var store = new SqliteRequestLogStore();
        var now = DateTimeOffset.UtcNow;
        await store.WriteAsync("alpha", Path.Combine(factory.DataRoot, "alpha"), Entry(now.AddMinutes(-2), "/from-alpha"));
        await store.WriteAsync("alpha", Path.Combine(factory.DataRoot, "alpha"), Entry(now.AddMinutes(-1), "/alpha-later"));
        await store.WriteAsync("beta", Path.Combine(factory.DataRoot, "beta"), Entry(now.AddMinutes(-90), "/too-old"));
        await store.WriteAsync("beta", Path.Combine(factory.DataRoot, "beta"), Entry(now, "/from-beta"));

        var from = Uri.EscapeDataString(now.AddHours(-1).ToString("O"));
        var to = Uri.EscapeDataString(now.AddMinutes(1).ToString("O"));
        using var all = await client.GetAsync($"/api/logs?proxyIds=alpha&proxyIds=beta&from={from}&to={to}");
        all.StatusCode.Should().Be(HttpStatusCode.OK);
        var merged = ParseList(await all.Content.ReadAsStringAsync());
        merged.GetProperty("total").GetInt32().Should().Be(3);
        var paths = merged.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("path").GetString()).ToList();
        paths.Should().Equal("/from-beta", "/alpha-later", "/from-alpha");
        merged.GetProperty("items")[0].GetProperty("proxyId").GetString().Should().Be("beta");
        merged.GetProperty("items")[0].GetProperty("proxyName").GetString().Should().Be("Beta");

        using var alphaOnly = await client.GetAsync($"/api/logs?proxyIds=alpha&from={from}&to={to}");
        var alpha = ParseList(await alphaOnly.Content.ReadAsStringAsync());
        alpha.GetProperty("total").GetInt32().Should().Be(2);
        alpha.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("path").GetString())
            .Should().NotContain("/from-beta");

        using var none = await client.GetAsync($"/api/logs?from={from}&to={to}");
        ParseList(await none.Content.ReadAsStringAsync()).GetProperty("total").GetInt32().Should().Be(0);

        using var timeline = await client.GetAsync($"/api/logs/timeline?proxyIds=alpha&proxyIds=beta&from={from}&to={to}&buckets=20");
        timeline.StatusCode.Should().Be(HttpStatusCode.OK);
        var graph = JsonDocument.Parse(await timeline.Content.ReadAsStringAsync()).RootElement;
        graph.GetProperty("buckets").EnumerateArray().Sum(item => item.GetProperty("count").GetInt32()).Should().Be(3);
    }

    [Fact]
    public async Task Sorts_merged_logs_by_the_requested_column()
    {
        await using var factory = new ProxyApiFactory();
        using var client = factory.CreateClient();
        await CreateProxy(client, "alpha", "Alpha");
        await CreateProxy(client, "beta", "Beta");

        var store = new SqliteRequestLogStore();
        var now = DateTimeOffset.UtcNow;
        var alphaFolder = Path.Combine(factory.DataRoot, "alpha");
        var betaFolder = Path.Combine(factory.DataRoot, "beta");
        await store.WriteAsync("alpha", alphaFolder, Entry(now.AddMinutes(-3), "/b", "PATCH"));
        await store.WriteAsync("alpha", alphaFolder, Entry(now.AddMinutes(-1), "/a"));
        await store.WriteAsync("beta", betaFolder, Entry(now.AddMinutes(-2), "/d"));
        await store.WriteAsync("beta", betaFolder, Entry(now, "/c", "POST"));

        var from = Uri.EscapeDataString(now.AddHours(-1).ToString("O"));
        var to = Uri.EscapeDataString(now.AddMinutes(1).ToString("O"));

        using var byPathDescending = await client.GetAsync(
            $"/api/logs?proxyIds=alpha&proxyIds=beta&from={from}&to={to}&sort=path&descending=true");
        byPathDescending.StatusCode.Should().Be(HttpStatusCode.OK);
        var paths = ParseList(await byPathDescending.Content.ReadAsStringAsync())
            .GetProperty("items").EnumerateArray()
            .Select(item => item.GetProperty("path").GetString());
        paths.Should().Equal("/d", "/c", "/b", "/a");

        // Sorting applies to the merged result, so a page still holds the right rows.
        using var byMethod = await client.GetAsync(
            $"/api/logs?proxyIds=alpha&proxyIds=beta&from={from}&to={to}&sort=method&take=2");
        var page = ParseList(await byMethod.Content.ReadAsStringAsync());
        page.GetProperty("total").GetInt32().Should().Be(4);
        page.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("method").GetString())
            .Should().Equal("GET", "GET");

        // Sorting by proxy groups the entries per proxy and keeps them newest first inside a group.
        using var byProxy = await client.GetAsync(
            $"/api/logs?proxyIds=alpha&proxyIds=beta&from={from}&to={to}&sort=proxy");
        ParseList(await byProxy.Content.ReadAsStringAsync())
            .GetProperty("items").EnumerateArray()
            .Select(item => item.GetProperty("path").GetString())
            .Should().Equal("/a", "/b", "/c", "/d");
    }

    private static async Task CreateProxy(HttpClient client, string id, string name)
    {
        var payload = $$"""
            {
              "id": "{{id}}",
              "name": "{{name}}",
              "enabled": false,
              "listen": { "url": "http://127.0.0.1:1" },
              "destination": { "address": "http://127.0.0.1:1" },
              "mocksEnabled": true,
              "passthroughDelayMs": 0
            }
            """;
        var create = await client.PostAsync("/api/proxies", new StringContent(payload, Encoding.UTF8, "application/json"));
        create.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    private static JsonElement ParseList(string json) => JsonDocument.Parse(json).RootElement;

    private static RequestLogEntry Entry(DateTimeOffset timestamp, string path, string method = "GET") => new()
    {
        TimestampUtc = timestamp,
        Method = method,
        Path = path,
        StatusCode = 200
    };
}
