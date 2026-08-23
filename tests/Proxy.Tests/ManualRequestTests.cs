using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Proxy.Core.Matching;

namespace Proxy.Tests;

public class ManualRequestTests
{
    [Fact]
    public void DestinationUrl_strips_listen_prefix()
    {
        var uri = DestinationUrl.Build("https://dest.example/base", "/api/users/1", "/api", "q=1");
        uri.ToString().Should().Be("https://dest.example/base/users/1?q=1");
    }

    [Fact]
    public async Task Manual_send_is_logged_with_manual_mode()
    {
        var downstreamPort = GetFreePort();
        var downstream = WebApplication.Create();
        downstream.Urls.Clear();
        downstream.Urls.Add($"http://127.0.0.1:{downstreamPort}");
        downstream.MapGet("/echo", (HttpContext context) =>
        {
            context.Request.Headers.Authorization.ToString().Should().Be("Bearer test-token");
            return "from-downstream";
        });
        await downstream.StartAsync();

        await using var factory = new ProxyApiFactory();
        var folder = Path.Combine(factory.DataRoot, "manual");
        Directory.CreateDirectory(folder);
        await File.WriteAllTextAsync(Path.Combine(folder, "proxy.json"), $$"""
            {
              "name": "Manual",
              "enabled": true,
              "listen": { "url": "http://127.0.0.1:18099" },
              "destination": { "address": "http://127.0.0.1:{{downstreamPort}}" },
              "mocksEnabled": true
            }
            """);

        using var api = factory.CreateClient();
        (await api.GetStringAsync("/api/proxies")).Should().Contain("manual");

        var payload = """
            {
              "method": "GET",
              "path": "/echo",
              "headers": { "Authorization": "Bearer test-token" },
              "protocol": "rest"
            }
            """;
        using var send = await api.PostAsync(
            "/api/proxies/manual/send",
            new StringContent(payload, Encoding.UTF8, "application/json"));
        var sendJson = await send.Content.ReadAsStringAsync();
        send.StatusCode.Should().Be(HttpStatusCode.OK, sendJson);
        using var sent = JsonDocument.Parse(sendJson);
        sent.RootElement.GetProperty("mode").GetString().Should().Be("manual");
        sent.RootElement.GetProperty("statusCode").GetInt32().Should().Be(200);
        sent.RootElement.GetProperty("responseBody").GetString().Should().Be("from-downstream");

        using var logsResponse = await api.GetAsync("/api/proxies/manual/logs?mode=manual");
        var logsJson = await logsResponse.Content.ReadAsStringAsync();
        using var logs = JsonDocument.Parse(logsJson);
        logs.RootElement.GetProperty("total").GetInt32().Should().BeGreaterThanOrEqualTo(1);

        using var statsResponse = await api.GetAsync("/api/proxies/manual/stats");
        using var stats = JsonDocument.Parse(await statsResponse.Content.ReadAsStringAsync());
        stats.RootElement.GetProperty("manualRequests").GetInt32().Should().BeGreaterThanOrEqualTo(1);

        await downstream.StopAsync();
        await downstream.DisposeAsync();
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
