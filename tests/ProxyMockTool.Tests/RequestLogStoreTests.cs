using AwesomeAssertions;
using Microsoft.Data.Sqlite;
using ProxyMockTool.Core.Models;
using ProxyMockTool.Infrastructure.Logging;

namespace ProxyMockTool.Tests;

public class RequestLogStoreTests
{
    [Fact]
    public async Task Queries_storage_timeline_range_and_deletes_logs()
    {
        var folder = Directory.CreateTempSubdirectory("proxy-logs-").FullName;
        var store = new SqliteRequestLogStore();
        try
        {
            await store.WriteAsync("demo", folder, Entry(DateTimeOffset.UtcNow.AddHours(-3), "/old"));
            await store.WriteAsync("demo", folder, Entry(DateTimeOffset.UtcNow.AddMinutes(-10), "/recent"));
            await store.WriteAsync("demo", folder, Entry(DateTimeOffset.UtcNow, "/latest", body: "ok", original: 2));

            var storage = await store.GetStorageAsync("demo", folder);
            storage.EntryCount.Should().Be(3);
            storage.TotalBytes.Should().BeGreaterThan(0);

            var latest = await store.QueryAsync("demo", folder, new LogQuery { Take = 1 });
            latest.Total.Should().Be(3);
            latest.Items.Should().ContainSingle(item => item.Path == "/latest");

            var historical = await store.QueryAsync("demo", folder, new LogQuery
            {
                FromUtc = DateTimeOffset.UtcNow.AddHours(-4),
                ToUtc = DateTimeOffset.UtcNow.AddHours(-1),
                Take = 50
            });
            historical.Total.Should().Be(1);
            historical.Items[0].Path.Should().Be("/old");

            var timeline = await store.GetTimelineAsync("demo", folder, DateTimeOffset.UtcNow.AddHours(-4), DateTimeOffset.UtcNow, 20);
            timeline.Buckets.Sum(item => item.Count).Should().Be(3);
            timeline.Buckets.Sum(item => item.Status2xx).Should().Be(3);

            var removed = await store.DeleteBeforeAsync("demo", folder, DateTimeOffset.UtcNow.AddHours(-1));
            removed.Should().Be(1);
            (await store.GetStorageAsync("demo", folder)).EntryCount.Should().Be(2);

            var cleared = await store.DeleteAsync("demo", folder);
            cleared.Should().Be(2);
            (await store.GetStorageAsync("demo", folder)).EntryCount.Should().Be(0);
        }
        finally
        {
            DeleteFolder(folder);
        }
    }

    [Fact]
    public async Task Concurrent_first_access_creates_the_request_logs_table()
    {
        var folder = Directory.CreateTempSubdirectory("proxy-logs-init-").FullName;
        var store = new SqliteRequestLogStore();
        try
        {
            var from = DateTimeOffset.UtcNow.AddHours(-1);
            var to = DateTimeOffset.UtcNow;
            var query = store.QueryAsync("fresh", folder, new LogQuery { FromUtc = from, ToUtc = to, Take = 50 });
            var timeline = store.GetTimelineAsync("fresh", folder, from, to, 20);
            var storage = store.GetStorageAsync("fresh", folder);

            await FluentActions.Invoking(() => Task.WhenAll(query, timeline, storage)).Should().NotThrowAsync();
            (await query).Total.Should().Be(0);
            (await storage).EntryCount.Should().Be(0);
        }
        finally
        {
            DeleteFolder(folder);
        }
    }

    [Fact]
    public async Task Stores_exceeded_body_size_without_the_body()
    {
        var folder = Directory.CreateTempSubdirectory("proxy-logs-").FullName;
        var store = new SqliteRequestLogStore();
        try
        {
            var written = await store.WriteAsync("demo", folder, new RequestLogEntry
            {
                TimestampUtc = DateTimeOffset.UtcNow,
                Method = "POST",
                Path = "/big",
                RequestBody = null,
                RequestBodyTruncated = true,
                RequestBodyOriginalBytes = 4096,
                ResponseBody = null,
                ResponseBodyTruncated = true,
                ResponseBodyOriginalBytes = 8192
            });

            var loaded = await store.GetAsync("demo", folder, written.Id);
            loaded.Should().NotBeNull();
            loaded!.RequestBody.Should().BeNull();
            loaded.RequestBodyTruncated.Should().BeTrue();
            loaded.RequestBodyOriginalBytes.Should().Be(4096);
            loaded.ResponseBodyOriginalBytes.Should().Be(8192);
        }
        finally
        {
            DeleteFolder(folder);
        }
    }

    [Fact]
    public async Task Filters_logs_by_classified_protocol()
    {
        var folder = Directory.CreateTempSubdirectory("proxy-logs-").FullName;
        var store = new SqliteRequestLogStore();
        try
        {
            await store.WriteAsync("demo", folder, Entry(DateTimeOffset.UtcNow, "/plain", "hello world"));
            await store.WriteAsync("demo", folder, new RequestLogEntry
            {
                TimestampUtc = DateTimeOffset.UtcNow,
                Method = "POST",
                Path = "/json",
                RequestBody = """{"user":{"id":42}}""",
                RequestHeaders = """{"Content-Type":"application/json"}""",
                Protocol = RequestProtocol.Json
            });

            var json = await store.QueryAsync("demo", folder, new LogQuery { Protocol = RequestProtocol.Json, Take = 50 });
            json.Items.Should().ContainSingle(item => item.Path == "/json");
        }
        finally
        {
            DeleteFolder(folder);
        }
    }

    [Fact]
    public async Task Filters_logs_by_soap_action_and_body()
    {
        var folder = Directory.CreateTempSubdirectory("proxy-logs-").FullName;
        var store = new SqliteRequestLogStore();
        try
        {
            await store.WriteAsync("demo", folder, new RequestLogEntry
            {
                TimestampUtc = DateTimeOffset.UtcNow,
                Method = "POST",
                Path = "/service",
                Protocol = RequestProtocol.Soap,
                RequestHeaders = """{"SOAPAction":"\"GetAccount\""}""",
                RequestBody = "<AccountId>999</AccountId>",
                ResponseBody = "<Balance>10</Balance>"
            });
            await store.WriteAsync("demo", folder, new RequestLogEntry
            {
                TimestampUtc = DateTimeOffset.UtcNow,
                Method = "POST",
                Path = "/service",
                Protocol = RequestProtocol.Soap,
                RequestHeaders = """{"SOAPAction":"\"Ping\""}""",
                RequestBody = "<Ping/>"
            });
            await store.WriteAsync("demo", folder, Entry(DateTimeOffset.UtcNow, "/plain", "hello world"));

            var byAction = await store.QueryAsync("demo", folder, new LogQuery { SoapAction = "GetAccount", Take = 50 });
            byAction.Items.Should().ContainSingle(item => item.RequestBody!.Contains("999"));

            var byRequestBody = await store.QueryAsync("demo", folder, new LogQuery { Body = "AccountId", Take = 50 });
            byRequestBody.Items.Should().ContainSingle(item => item.Path == "/service" && item.RequestBody!.Contains("999"));

            var byResponseBody = await store.QueryAsync("demo", folder, new LogQuery { Body = "Balance", Take = 50 });
            byResponseBody.Items.Should().ContainSingle(item => item.ResponseBody!.Contains("Balance"));
        }
        finally
        {
            DeleteFolder(folder);
        }
    }

    [Fact]
    public async Task Timeline_splits_buckets_by_mode_and_status()
    {
        var folder = Directory.CreateTempSubdirectory("proxy-logs-").FullName;
        var store = new SqliteRequestLogStore();
        try
        {
            var now = DateTimeOffset.UtcNow;
            await store.WriteAsync("demo", folder, Entry(now, "/ok", status: 200));
            await store.WriteAsync("demo", folder, Entry(now, "/moved", status: 301));
            await store.WriteAsync("demo", folder, Entry(now, "/missing", status: 404));
            await store.WriteAsync("demo", folder, Entry(now, "/boom", status: 500));
            await store.WriteAsync("demo", folder, Entry(now, "/mock", status: 200, mode: RequestMode.Mock));
            await store.WriteAsync("demo", folder, Entry(now, "/manual", status: 200, mode: RequestMode.Manual));

            var timeline = await store.GetTimelineAsync("demo", folder, now.AddMinutes(-1), now.AddMinutes(1), 10);
            timeline.Buckets.Sum(item => item.Count).Should().Be(6);
            timeline.Buckets.Sum(item => item.Status2xx).Should().Be(1);
            timeline.Buckets.Sum(item => item.Status3xx).Should().Be(1);
            timeline.Buckets.Sum(item => item.Status4xx).Should().Be(1);
            timeline.Buckets.Sum(item => item.Status5xx).Should().Be(1);
            timeline.Buckets.Sum(item => item.MockCount).Should().Be(1);
            timeline.Buckets.Sum(item => item.ManualCount).Should().Be(1);
        }
        finally
        {
            DeleteFolder(folder);
        }
    }

    [Fact]
    public async Task Release_closes_the_database_so_the_folder_can_be_deleted()
    {
        var folder = Directory.CreateTempSubdirectory("proxy-logs-").FullName;
        var store = new SqliteRequestLogStore();
        await store.WriteAsync("demo", folder, Entry(DateTimeOffset.UtcNow, "/hello", "ok", 2));
        File.Exists(Path.Combine(folder, "logs.db")).Should().BeTrue();

        store.Release("demo", folder);

        var act = () => Directory.Delete(folder, true);
        act.Should().NotThrow();
        Directory.Exists(folder).Should().BeFalse();
    }

    private static void DeleteFolder(string folder)
    {
        SqliteConnection.ClearAllPools();
        try
        {
            Directory.Delete(folder, true);
        }
        catch (IOException)
        {
        }
    }

    private static RequestLogEntry Entry(
        DateTimeOffset timestamp,
        string path,
        string? body = null,
        int original = 0,
        int status = 200,
        RequestMode mode = RequestMode.Passthrough) => new()
    {
        TimestampUtc = timestamp,
        Method = "GET",
        Path = path,
        RequestBody = body,
        RequestBodyOriginalBytes = original,
        StatusCode = status,
        Mode = mode
    };
}
