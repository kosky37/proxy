using Microsoft.EntityFrameworkCore;
using Proxy.Core.Contracts;
using Proxy.Core.Models;

namespace Proxy.Infrastructure.Logging;

public sealed class SqliteRequestLogStore : IRequestLogStore
{
    private readonly ConcurrentSet _initialized = new();

    public async Task WriteAsync(string proxyId, string folderPath, RequestLogEntry entry, CancellationToken cancellationToken = default)
    {
        await using var db = Create(proxyId, folderPath);
        db.Logs.Add(RequestLogRecord.FromEntry(entry));
        await db.SaveChangesAsync(cancellationToken);
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
        var average = await logs.AverageAsync(item => (double)item.DurationMs, cancellationToken);
        var last = await logs.OrderByDescending(item => item.TimestampUtc).ThenByDescending(item => item.Id).FirstAsync(cancellationToken);

        return new ProxyStats
        {
            TotalRequests = total,
            MockRequests = mockRequests,
            PassthroughRequests = total - mockRequests,
            AverageDurationMs = average,
            LastStatusCode = last.StatusCode,
            LastRequestUtc = last.TimestampUtc
        };
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
        }

        return db;
    }

    private static IQueryable<RequestLogRecord> Filter(IQueryable<RequestLogRecord> logs, LogQuery query)
    {
        if (query.FromUtc is { } from)
        {
            logs = logs.Where(item => item.TimestampUtc >= from);
        }

        if (query.ToUtc is { } to)
        {
            logs = logs.Where(item => item.TimestampUtc <= to);
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
            var value = protocol.ToString();
            logs = logs.Where(item => item.Protocol == value);
        }

        return logs;
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
    }
}
