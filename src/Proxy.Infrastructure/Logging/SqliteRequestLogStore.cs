using System.Data;
using Microsoft.EntityFrameworkCore;
using Proxy.Core.Contracts;
using Proxy.Core.Matching;
using Proxy.Core.Models;

namespace Proxy.Infrastructure.Logging;

public sealed class SqliteRequestLogStore : IRequestLogStore
{
    private readonly ConcurrentSet _initialized = new();

    public async Task<RequestLogEntry> WriteAsync(string proxyId, string folderPath, RequestLogEntry entry, CancellationToken cancellationToken = default)
    {
        await using var db = Create(proxyId, folderPath);
        var record = RequestLogRecord.FromEntry(entry);
        db.Logs.Add(record);
        await db.SaveChangesAsync(cancellationToken);
        return record.ToEntry();
    }

    public async Task<LogListResult> QueryAsync(string proxyId, string folderPath, LogQuery query, CancellationToken cancellationToken = default)
    {
        await using var db = Create(proxyId, folderPath);
        var items = Filter(db.Logs.AsNoTracking(), query);
        var total = await items.CountAsync(cancellationToken);
        var take = query.Take <= 0 ? 50 : Math.Min(query.Take, 500);
        var page = await items
            .OrderByDescending(item => item.TimestampUtc)
            .ThenByDescending(item => item.Id)
            .Skip(Math.Max(query.Skip, 0))
            .Take(take)
            .ToListAsync(cancellationToken);

        return new LogListResult
        {
            Items = page.Select(item => item.ToEntry()).ToList(),
            Total = total
        };
    }

    public async Task<RequestLogEntry?> GetAsync(string proxyId, string folderPath, long id, CancellationToken cancellationToken = default)
    {
        await using var db = Create(proxyId, folderPath);
        var record = await db.Logs.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        return record?.ToEntry();
    }

    public async Task<ProxyStats> GetStatsAsync(string proxyId, string folderPath, CancellationToken cancellationToken = default)
    {
        await using var db = Create(proxyId, folderPath);
        var logs = db.Logs.AsNoTracking();
        var total = await logs.CountAsync(cancellationToken);
        if (total == 0)
        {
            return new ProxyStats();
        }

        var mockRequests = await logs.CountAsync(item => item.Mode == nameof(RequestMode.Mock), cancellationToken);
        var manualRequests = await logs.CountAsync(item => item.Mode == nameof(RequestMode.Manual), cancellationToken);
        var average = await logs.AverageAsync(item => (double)item.DurationMs, cancellationToken);
        var last = await logs.OrderByDescending(item => item.TimestampUtc).ThenByDescending(item => item.Id).FirstAsync(cancellationToken);

        return new ProxyStats
        {
            TotalRequests = total,
            MockRequests = mockRequests,
            PassthroughRequests = total - mockRequests - manualRequests,
            ManualRequests = manualRequests,
            AverageDurationMs = average,
            LastStatusCode = last.StatusCode,
            LastRequestUtc = last.TimestampUtc
        };
    }

    public async Task<LogStorageInfo> GetStorageAsync(string proxyId, string folderPath, CancellationToken cancellationToken = default)
    {
        await using var db = Create(proxyId, folderPath);
        var path = Path.Combine(folderPath, "logs.db");
        var count = await db.Logs.CountAsync(cancellationToken);
        var databaseBytes = FileSize(path);
        var walBytes = FileSize(path + "-wal");
        var shmBytes = FileSize(path + "-shm");
        return new LogStorageInfo
        {
            DatabaseBytes = databaseBytes,
            WalBytes = walBytes,
            ShmBytes = shmBytes,
            TotalBytes = databaseBytes + walBytes + shmBytes,
            EntryCount = count
        };
    }

    public async Task<LogTimeline> GetTimelineAsync(
        string proxyId,
        string folderPath,
        DateTimeOffset? fromUtc,
        DateTimeOffset? toUtc,
        int buckets = 80,
        CancellationToken cancellationToken = default)
    {
        await using var db = Create(proxyId, folderPath);
        var logs = db.Logs.AsNoTracking();
        var bucketCount = Math.Clamp(buckets <= 0 ? 80 : buckets, 10, 200);

        DateTime from;
        DateTime to;
        if (fromUtc is { } requestedFrom && toUtc is { } requestedTo)
        {
            from = requestedFrom.UtcDateTime;
            to = requestedTo.UtcDateTime;
        }
        else
        {
            var min = await logs.MinAsync(item => (DateTime?)item.TimestampUtc, cancellationToken);
            var max = await logs.MaxAsync(item => (DateTime?)item.TimestampUtc, cancellationToken);
            from = fromUtc?.UtcDateTime ?? min ?? DateTime.UtcNow.AddDays(-1);
            to = toUtc?.UtcDateTime ?? max ?? DateTime.UtcNow;
        }

        if (to <= from)
        {
            to = from.AddMinutes(1);
        }

        var span = to - from;
        var bucketTicks = Math.Max(span.Ticks / bucketCount, TimeSpan.TicksPerSecond);
        var times = await logs
            .Where(item => item.TimestampUtc >= from && item.TimestampUtc <= to)
            .Select(item => item.TimestampUtc)
            .ToListAsync(cancellationToken);

        var counts = new int[bucketCount];
        foreach (var timestamp in times)
        {
            var index = (int)Math.Min((timestamp - from).Ticks / bucketTicks, bucketCount - 1);
            if (index < 0)
            {
                index = 0;
            }

            counts[index]++;
        }

        return new LogTimeline
        {
            FromUtc = new DateTimeOffset(DateTime.SpecifyKind(from, DateTimeKind.Utc)),
            ToUtc = new DateTimeOffset(DateTime.SpecifyKind(to, DateTimeKind.Utc)),
            BucketSeconds = (int)Math.Max(1, bucketTicks / TimeSpan.TicksPerSecond),
            Buckets = counts.Select((count, index) => new LogTimelineBucket
            {
                StartUtc = new DateTimeOffset(DateTime.SpecifyKind(from.AddTicks(index * bucketTicks), DateTimeKind.Utc)),
                Count = count
            }).ToList()
        };
    }

    public async Task<int> DeleteAsync(
        string proxyId,
        string folderPath,
        DateTimeOffset? fromUtc = null,
        DateTimeOffset? toUtc = null,
        CancellationToken cancellationToken = default)
    {
        await using var db = Create(proxyId, folderPath);
        var items = db.Logs.AsQueryable();
        if (fromUtc is { } from)
        {
            items = items.Where(item => item.TimestampUtc >= from.UtcDateTime);
        }

        if (toUtc is { } to)
        {
            items = items.Where(item => item.TimestampUtc <= to.UtcDateTime);
        }

        var deleted = await items.ExecuteDeleteAsync(cancellationToken);
        if (fromUtc is null && toUtc is null)
        {
            try
            {
                db.Database.ExecuteSqlRaw("VACUUM");
            }
            catch (Exception)
            {
                // VACUUM can fail while another connection still holds the file.
            }
        }

        return deleted;
    }

    public async Task<int> DeleteBeforeAsync(string proxyId, string folderPath, DateTimeOffset cutoffUtc, CancellationToken cancellationToken = default)
    {
        await using var db = Create(proxyId, folderPath);
        return await db.Logs
            .Where(item => item.TimestampUtc < cutoffUtc.UtcDateTime)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private RequestLogDbContext Create(string proxyId, string folderPath)
    {
        Directory.CreateDirectory(folderPath);
        var path = Path.Combine(folderPath, "logs.db");
        var options = new DbContextOptionsBuilder<RequestLogDbContext>()
            .UseSqlite($"Data Source={path};Cache=Shared")
            .Options;
        var db = new RequestLogDbContext(options);
        if (_initialized.TryAdd(proxyId))
        {
            db.Database.EnsureCreated();
            db.Database.ExecuteSqlRaw("PRAGMA journal_mode=WAL;");
            MigrateColumns(db);
        }

        return db;
    }

    private static void MigrateColumns(RequestLogDbContext db)
    {
        var names = ColumnNames(db);
        if (!names.Contains("RequestBodyOriginalBytes"))
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE RequestLogs ADD COLUMN RequestBodyOriginalBytes INTEGER NOT NULL DEFAULT 0");
        }

        if (!names.Contains("ResponseBodyOriginalBytes"))
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE RequestLogs ADD COLUMN ResponseBodyOriginalBytes INTEGER NOT NULL DEFAULT 0");
        }
    }

    private static HashSet<string> ColumnNames(RequestLogDbContext db)
    {
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            connection.Open();
        }

        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA table_info(RequestLogs)";
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                names.Add(reader.GetString(1));
            }
        }
        finally
        {
            if (shouldClose)
            {
                connection.Close();
            }
        }

        return names;
    }

    private static IQueryable<RequestLogRecord> Filter(IQueryable<RequestLogRecord> logs, LogQuery query)
    {
        if (query.FromUtc is { } from)
        {
            logs = logs.Where(item => item.TimestampUtc >= from.UtcDateTime);
        }

        if (query.ToUtc is { } to)
        {
            logs = logs.Where(item => item.TimestampUtc <= to.UtcDateTime);
        }

        if (!string.IsNullOrWhiteSpace(query.Path))
        {
            logs = logs.Where(item => item.Path.Contains(query.Path));
        }

        if (query.Mode is { } mode)
        {
            var value = mode.ToString();
            logs = logs.Where(item => item.Mode == value);
        }

        if (query.StatusCode is { } status)
        {
            logs = logs.Where(item => item.StatusCode == status);
        }

        if (query.Protocol is { } protocol)
        {
            var kind = ContentKind.Normalize(protocol);
            if (kind == RequestProtocol.Other)
            {
                logs = logs.Where(item =>
                    item.Protocol == nameof(RequestProtocol.Other) || item.Protocol == nameof(RequestProtocol.Rest));
            }
            else
            {
                var value = kind.ToString();
                logs = logs.Where(item => item.Protocol == value);
            }
        }

        return logs;
    }

    private static long FileSize(string path) => File.Exists(path) ? new FileInfo(path).Length : 0;

    private sealed class ConcurrentSet
    {
        private readonly HashSet<string> _items = new(StringComparer.OrdinalIgnoreCase);
        private readonly object _gate = new();

        public bool TryAdd(string value)
        {
            lock (_gate)
            {
                return _items.Add(value);
            }
        }
    }
}
