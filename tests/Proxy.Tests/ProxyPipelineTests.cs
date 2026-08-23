using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Builder;

namespace Proxy.Tests;

public class ProxyPipelineTests
{
    [Fact]
    public async Task Passthrough_mock_and_delay_are_logged()
    {
        var downstreamPort = GetFreePort();
        var listenPort = GetFreePort();
        var hit = 0;

        var downstream = WebApplication.Create();
        downstream.Urls.Clear();
        downstream.Urls.Add($"http://127.0.0.1:{downstreamPort}");
        downstream.MapGet("/echo", () =>
        {
            Interlocked.Increment(ref hit);
            return "from-downstream";
        });
        await downstream.StartAsync();

        await using var factory = new ProxyApiFactory();
        var folder = Path.Combine(factory.DataRoot, "pipe");
        Directory.CreateDirectory(Path.Combine(folder, "mocks"));
        await File.WriteAllTextAsync(Path.Combine(folder, "proxy.json"), $$"""
            {
              "name": "Pipe",
              "enabled": true,
              "listen": { "url": "http://127.0.0.1:{{listenPort}}" },
              "destination": { "address": "http://127.0.0.1:{{downstreamPort}}" },
              "mocksEnabled": true,
              "passthroughDelayMs": 0
            }
            """);
        await File.WriteAllTextAsync(Path.Combine(folder, "mocks", "hello.json"), """
            {
              "type": "rest",
              "name": "hello",
              "match": { "methods": ["GET"], "path": "/hello", "pathMode": "exact" },
              "response": { "statusCode": 200, "contentType": "text/plain", "body": "mocked", "delayMs": 200 }
            }
            """);

        using var api = factory.CreateClient();
        var proxies = await api.GetStringAsync("/api/proxies");
        proxies.Should().Contain("pipe");

        using var proxyClient = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{listenPort}") };
        await WaitForListener(proxyClient);

        var started = DateTime.UtcNow;
        var mockResponse = await proxyClient.GetStringAsync("/hello");
        mockResponse.Should().Be("mocked");
        (DateTime.UtcNow - started).TotalMilliseconds.Should().BeGreaterThanOrEqualTo(150);

        using var passthrough = await proxyClient.GetAsync("/echo");
        var passthroughBody = await passthrough.Content.ReadAsStringAsync();
        passthrough.StatusCode.Should().Be(HttpStatusCode.OK, passthroughBody);
        passthroughBody.Should().Be("from-downstream");
        hit.Should().Be(1);

        using var logsResponse = await api.GetAsync("/api/proxies/pipe/logs");
        var logsJson = await logsResponse.Content.ReadAsStringAsync();
        logsResponse.StatusCode.Should().Be(HttpStatusCode.OK, logsJson);
        using var logs = JsonDocument.Parse(logsJson);
        logs.RootElement.GetProperty("total").GetInt32().Should().BeGreaterThanOrEqualTo(2);
        var modes = logs.RootElement.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("mode").GetString()).ToList();
        modes.Should().Contain("mock");
        modes.Should().Contain("passthrough");

        await downstream.StopAsync();
        await downstream.DisposeAsync();
    }

    [Fact]
    public async Task Api_can_create_proxy_and_toggle_mock()
    {
        await using var factory = new ProxyApiFactory();
        using var client = factory.CreateClient();

        var payload = """
            {
              "id": "created",
              "name": "Created",
              "enabled": true,
              "listen": { "url": "http://127.0.0.1:18083" },
              "destination": { "address": "http://127.0.0.1:18093" },
              "mocksEnabled": true,
              "passthroughDelayMs": 0
            }
            """;
        var create = await client.PostAsync("/api/proxies", new StringContent(payload, Encoding.UTF8, "application/json"));
        create.StatusCode.Should().Be(HttpStatusCode.Created);

        var mockPayload = """
            {
              "name": "ping",
              "fileName": "ping.json",
              "enabled": true,
              "type": "rest",
              "match": { "methods": ["GET"], "path": "/ping", "pathMode": "exact" },
              "response": { "statusCode": 204 }
            }
            """;
        var mockCreate = await client.PostAsync("/api/proxies/created/mocks", new StringContent(mockPayload, Encoding.UTF8, "application/json"));
        mockCreate.StatusCode.Should().Be(HttpStatusCode.Created);

        var toggle = await client.PostAsync("/api/proxies/created/mocks/ping/toggle", null);
        toggle.EnsureSuccessStatusCode();
        var toggled = await toggle.Content.ReadAsStringAsync();
        toggled.Should().Contain("\"enabled\":false");
        File.Exists(Path.Combine(factory.DataRoot, "created", "mocks", "_ping.json")).Should().BeTrue();
    }

    private static async Task WaitForListener(HttpClient client)
    {
        for (var i = 0; i < 40; i++)
        {
            try
            {
                using var response = await client.GetAsync("/does-not-exist");
                return;
            }
            catch (HttpRequestException)
            {
                await Task.Delay(100);
            }
        }

        throw new TimeoutException("Proxy listener did not start.");
    }

    private static int GetFreePort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }
}
