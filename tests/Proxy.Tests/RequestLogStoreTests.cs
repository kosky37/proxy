using FluentAssertions;
using Microsoft.Data.Sqlite;
using Proxy.Core.Models;
using Proxy.Infrastructure.Logging;

namespace Proxy.Tests;

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

    private static RequestLogEntry Entry(DateTimeOffset timestamp, string path, string? body = null, int original = 0) => new()
    {
        TimestampUtc = timestamp,
        Method = "GET",
        Path = path,
        RequestBody = body,
        RequestBodyOriginalBytes = original,
        Mode = RequestMode.Passthrough
    };
}
