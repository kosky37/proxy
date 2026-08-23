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
    public async Task Ignored_path_is_not_logged()
    {
        var listenPort = GetFreePort();
        await using var factory = new ProxyApiFactory();
        var folder = Path.Combine(factory.DataRoot, "ignored");
        Directory.CreateDirectory(Path.Combine(folder, "mocks"));
        Directory.CreateDirectory(Path.Combine(folder, "ignores"));
        await File.WriteAllTextAsync(Path.Combine(folder, "proxy.json"), $$"""
            {
              "name": "Ignored",
              "enabled": true,
              "listen": { "url": "http://127.0.0.1:{{listenPort}}" },
              "destination": { "address": "http://127.0.0.1:9" },
              "mocksEnabled": true
            }
            """);
        await File.WriteAllTextAsync(Path.Combine(folder, "mocks", "any.json"), """
            {
              "type": "rest",
              "name": "any",
              "match": { "methods": ["GET"] },
              "response": { "statusCode": 200, "body": "ok" }
            }
            """);
        await File.WriteAllTextAsync(Path.Combine(folder, "ignores", "metrics.json"), """
            {
              "name": "metrics",
              "path": "/metrics",
              "pathMode": "prefix"
            }
            """);

        using var api = factory.CreateClient();
        (await api.GetStringAsync("/api/proxies")).Should().Contain("ignored");

        using var proxyClient = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{listenPort}") };
        await WaitForListener(proxyClient);

        (await proxyClient.GetStringAsync("/hello")).Should().Be("ok");
        (await proxyClient.GetStringAsync("/metrics")).Should().Be("ok");
        (await proxyClient.GetStringAsync("/metrics/cpu")).Should().Be("ok");

        using var logsResponse = await api.GetAsync("/api/proxies/ignored/logs");
        var logsJson = await logsResponse.Content.ReadAsStringAsync();
        logsResponse.StatusCode.Should().Be(HttpStatusCode.OK, logsJson);
        using var logs = JsonDocument.Parse(logsJson);
        var paths = logs.RootElement.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("path").GetString()).ToList();
        paths.Should().Contain("/hello");
        paths.Should().NotContain("/metrics");
        paths.Should().NotContain("/metrics/cpu");
    }

    [Fact]
    public async Task Blocking_mock_does_not_respond()
    {
        var listenPort = GetFreePort();
        await using var factory = new ProxyApiFactory();
        var folder = Path.Combine(factory.DataRoot, "blocked");
        Directory.CreateDirectory(Path.Combine(folder, "mocks"));
        await File.WriteAllTextAsync(Path.Combine(folder, "proxy.json"), $$"""
            {
              "name": "Blocked",
              "enabled": true,
              "listen": { "url": "http://127.0.0.1:{{listenPort}}" },
              "destination": { "address": "http://127.0.0.1:9" },
              "mocksEnabled": true
            }
            """);
        await File.WriteAllTextAsync(Path.Combine(folder, "mocks", "hang.json"), """
            {
              "type": "rest",
              "name": "hang",
              "match": { "methods": ["GET"], "path": "/hang", "pathMode": "exact" },
              "response": { "block": true }
            }
            """);

        using var api = factory.CreateClient();
        (await api.GetStringAsync("/api/proxies")).Should().Contain("blocked");

        using var proxyClient = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{listenPort}") };
        await WaitForListener(proxyClient);

        using var timeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(400));
        var act = async () => await proxyClient.GetAsync("/hang", timeout.Token);
        await act.Should().ThrowAsync<TaskCanceledException>();
    }

    [Fact]
    public async Task Shared_port_routes_by_path_prefix()
    {
        var apiPort = GetFreePort();
        var testPort = GetFreePort();
        var listenPort = GetFreePort();

        var apiDown = WebApplication.Create();
        apiDown.Urls.Clear();
        apiDown.Urls.Add($"http://127.0.0.1:{apiPort}");
        apiDown.MapGet("/orders", () => "from-api");
        await apiDown.StartAsync();

        var testDown = WebApplication.Create();
        testDown.Urls.Clear();
        testDown.Urls.Add($"http://127.0.0.1:{testPort}");
        testDown.MapGet("/ping", () => "from-test");
        await testDown.StartAsync();

        await using var factory = new ProxyApiFactory();
        await WriteProxy(factory, "api", listenPort, apiPort, pathPrefix: "/api");
        await WriteProxy(factory, "test", listenPort, testPort, pathInUrl: "/test");

        using var admin = factory.CreateClient();
        (await admin.GetStringAsync("/api/proxies")).Should().Contain("api").And.Contain("test");

        using var proxyClient = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{listenPort}") };
        await WaitForListener(proxyClient);

        (await proxyClient.GetStringAsync("/api/orders")).Should().Be("from-api");
        (await proxyClient.GetStringAsync("/test/ping")).Should().Be("from-test");

        using var miss = await proxyClient.GetAsync("/other");
        miss.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var apiPaths = await WaitForLogPaths(admin, "api");
        apiPaths.Should().Contain("/orders").And.NotContain("/api/orders");

        var testPaths = await WaitForLogPaths(admin, "test");
        testPaths.Should().Contain("/ping").And.NotContain("/test/ping");

        await apiDown.StopAsync();
        await testDown.StopAsync();
        await apiDown.DisposeAsync();
        await testDown.DisposeAsync();
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

    private static async Task WriteProxy(
        ProxyApiFactory factory,
        string id,
        int listenPort,
        int destinationPort,
        string? pathPrefix = null,
        string? pathInUrl = null)
    {
        var folder = Path.Combine(factory.DataRoot, id);
        Directory.CreateDirectory(Path.Combine(folder, "mocks"));
        var url = pathInUrl is null
            ? $"http://127.0.0.1:{listenPort}"
            : $"http://127.0.0.1:{listenPort}{pathInUrl}";
        var prefixLine = pathPrefix is null ? "" : $", \"pathPrefix\": \"{pathPrefix}\"";
        await File.WriteAllTextAsync(Path.Combine(folder, "proxy.json"), $$"""
            {
              "name": "{{id}}",
              "enabled": true,
              "listen": { "url": "{{url}}"{{prefixLine}} },
              "destination": { "address": "http://127.0.0.1:{{destinationPort}}" },
              "mocksEnabled": false
            }
            """);
    }

    private static async Task<List<string?>> WaitForLogPaths(HttpClient admin, string proxyId)
    {
        for (var i = 0; i < 40; i++)
        {
            using var response = await admin.GetAsync($"/api/proxies/{proxyId}/logs");
            var json = await response.Content.ReadAsStringAsync();
            response.StatusCode.Should().Be(HttpStatusCode.OK, json);
            using var document = JsonDocument.Parse(json);
            var paths = document.RootElement.GetProperty("items").EnumerateArray()
                .Select(item => item.GetProperty("path").GetString())
                .ToList();
            if (paths.Count > 0)
            {
                return paths;
            }

            await Task.Delay(50);
        }

        throw new TimeoutException($"No logs were written for proxy '{proxyId}'.");
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
