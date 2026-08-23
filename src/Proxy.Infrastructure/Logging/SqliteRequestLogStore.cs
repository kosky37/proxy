using System.Data;
using Microsoft.Data.Sqlite;
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

    public async Task<LogStorageInfo> GetStorageAsync(string proxyId, string folderPath, CancellationToken cancellationToken = default)
    {
        await using var db = Create(proxyId, folderPath);
        var path = Path.Combine(folderPath, "logs.db");
        var count = await db.Logs.CountAsync(cancellationToken);
        var databaseBytes = FileSize(path);
        return new LogStorageInfo
        {
            DatabaseBytes = databaseBytes,
            TotalBytes = databaseBytes,
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
        var rows = await logs
            .Where(item => item.TimestampUtc >= from && item.TimestampUtc <= to)
            .Select(item => new TimelineRow
            {
                TimestampUtc = item.TimestampUtc,
                Mode = item.Mode,
                StatusCode = item.StatusCode
            })
            .ToListAsync(cancellationToken);

        var series = Enumerable.Range(0, bucketCount)
            .Select(index => new LogTimelineBucket
            {
                StartUtc = new DateTimeOffset(DateTime.SpecifyKind(from.AddTicks(index * bucketTicks), DateTimeKind.Utc))
            })
            .ToArray();

        foreach (var row in rows)
        {
            var index = (int)Math.Min((row.TimestampUtc - from).Ticks / bucketTicks, bucketCount - 1);
            if (index < 0)
            {
                index = 0;
            }

            AddToBucket(series[index], row);
        }

        return new LogTimeline
        {
            FromUtc = new DateTimeOffset(DateTime.SpecifyKind(from, DateTimeKind.Utc)),
            ToUtc = new DateTimeOffset(DateTime.SpecifyKind(to, DateTimeKind.Utc)),
            BucketSeconds = (int)Math.Max(1, bucketTicks / TimeSpan.TicksPerSecond),
            Buckets = series
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

    public void Release(string proxyId, string folderPath)
    {
        _initialized.Remove(proxyId);
        var path = Path.Combine(folderPath, "logs.db");
        if (!File.Exists(path))
        {
            return;
        }

        var connectionString = ConnectionString(path);
        using (var db = new RequestLogDbContext(new DbContextOptionsBuilder<RequestLogDbContext>().UseSqlite(connectionString).Options))
        {
            try
            {
                db.Database.ExecuteSqlRaw("PRAGMA wal_checkpoint(TRUNCATE);");
                db.Database.ExecuteSqlRaw("PRAGMA journal_mode=DELETE;");
            }
            catch (Exception)
            {
            }
        }

        using var connection = new SqliteConnection(connectionString);
        SqliteConnection.ClearPool(connection);
        SqliteConnection.ClearAllPools();
    }

    private RequestLogDbContext Create(string proxyId, string folderPath)
    {
        Directory.CreateDirectory(folderPath);
        var path = Path.Combine(folderPath, "logs.db");
        var options = new DbContextOptionsBuilder<RequestLogDbContext>()
            .UseSqlite(ConnectionString(path))
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

    private static long FileSize(string path)
    {
        try
        {
            return new FileInfo(path).Length;
        }
        catch (IOException)
        {
            return 0;
        }
    }

    private static string ConnectionString(string path) =>
        $"Data Source={path};Cache=Shared;Pooling=False;Mode=ReadWriteCreate";

    private static void AddToBucket(LogTimelineBucket bucket, TimelineRow row)
    {
        bucket.Count++;
        if (string.Equals(row.Mode, nameof(RequestMode.Mock), StringComparison.OrdinalIgnoreCase))
        {
            bucket.MockCount++;
            return;
        }

        if (string.Equals(row.Mode, nameof(RequestMode.Manual), StringComparison.OrdinalIgnoreCase))
        {
            bucket.ManualCount++;
            return;
        }

        switch (row.StatusCode)
        {
            case >= 200 and < 300:
                bucket.Status2xx++;
                break;
            case >= 300 and < 400:
                bucket.Status3xx++;
                break;
            case >= 400 and < 500:
                bucket.Status4xx++;
                break;
            case >= 500 and < 600:
                bucket.Status5xx++;
                break;
            default:
                bucket.OtherCount++;
                break;
        }
    }

    private sealed class TimelineRow
    {
        public DateTime TimestampUtc { get; set; }
        public string Mode { get; set; } = "";
        public int? StatusCode { get; set; }
    }

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

        public void Remove(string value)
        {
            lock (_gate)
            {
                _items.Remove(value);
            }
        }
    }
}
