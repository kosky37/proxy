using Microsoft.AspNetCore.Mvc;
using Proxy.Api.Contracts;
using Proxy.Core.Contracts;
using Proxy.Core.Matching;
using Proxy.Core.Models;

namespace Proxy.Api.Controllers;

[ApiController]
[Route("api/logs")]
public sealed class GlobalLogsController : ControllerBase
{
    private readonly IProxyConfigStore _store;
    private readonly IRequestLogStore _logs;

    public GlobalLogsController(IProxyConfigStore store, IRequestLogStore logs)
    {
        _store = store;
        _logs = logs;
    }

    [HttpGet]
    [ProducesResponseType(typeof(LogListDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<LogListDto>> List(
        [FromQuery] string[]? proxyIds,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] string? path,
        [FromQuery] string? mode,
        [FromQuery] int? statusCode,
        [FromQuery] string? protocol,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken cancellationToken = default)
    {
        var proxies = ResolveProxies(proxyIds);
        if (proxies.Count == 0)
        {
            return Ok(new LogListDto { Items = [], Total = 0 });
        }

        var pageSkip = Math.Max(skip, 0);
        var pageTake = take <= 0 ? 50 : Math.Min(take, 200);
        var perProxyTake = Math.Min(pageSkip + pageTake, 2000);
        var query = new LogQuery
        {
            FromUtc = from,
            ToUtc = to,
            Path = path,
            Mode = Enum.TryParse<RequestMode>(mode, true, out var parsedMode) ? parsedMode : null,
            StatusCode = statusCode,
            Protocol = ParseProtocol(protocol),
            Skip = 0,
            Take = perProxyTake
        };

        var parts = await Task.WhenAll(proxies.Select(async proxy =>
        {
            var result = await _logs.QueryAsync(proxy.Id, proxy.FolderPath, query, cancellationToken);
            return (proxy, result);
        }));

        var items = parts
            .SelectMany(part => part.result.Items.Select(entry =>
                DtoMapper.ToListItem(entry, part.proxy.Id, part.proxy.Definition.Name)))
            .OrderByDescending(item => item.TimestampUtc)
            .ThenByDescending(item => item.Id)
            .Skip(pageSkip)
            .Take(pageTake)
            .ToList();

        return Ok(new LogListDto
        {
            Items = items,
            Total = parts.Sum(part => part.result.Total)
        });
    }

    [HttpGet("timeline")]
    [ProducesResponseType(typeof(LogTimelineDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<LogTimelineDto>> Timeline(
        [FromQuery] string[]? proxyIds,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int buckets = 80,
        CancellationToken cancellationToken = default)
    {
        var proxies = ResolveProxies(proxyIds);
        if (proxies.Count == 0)
        {
            var emptyFrom = from ?? DateTimeOffset.UtcNow.AddDays(-1);
            var emptyTo = to ?? DateTimeOffset.UtcNow;
            return Ok(DtoMapper.ToDto(EmptyTimeline(emptyFrom, emptyTo, buckets)));
        }

        var timelines = await Task.WhenAll(proxies.Select(proxy =>
            _logs.GetTimelineAsync(proxy.Id, proxy.FolderPath, from, to, buckets, cancellationToken)));

        return Ok(DtoMapper.ToDto(MergeTimelines(timelines, from, to, buckets)));
    }

    private IReadOnlyList<LoadedProxy> ResolveProxies(string[]? proxyIds)
    {
        var ids = (proxyIds ?? [])
            .SelectMany(value => value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (ids.Count == 0)
        {
            return [];
        }

        return _store.GetAll().Where(proxy => ids.Contains(proxy.Id)).ToList();
    }

    private static LogTimeline MergeTimelines(
        IReadOnlyList<LogTimeline> timelines,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int buckets)
    {
        var present = timelines.Where(item => item.Buckets.Count > 0).ToList();
        if (present.Count == 0)
        {
            return EmptyTimeline(from ?? DateTimeOffset.UtcNow.AddDays(-1), to ?? DateTimeOffset.UtcNow, buckets);
        }

        var windowFrom = from ?? present.Min(item => item.FromUtc);
        var windowTo = to ?? present.Max(item => item.ToUtc);
        var aligned = present.FirstOrDefault(item => item.FromUtc == windowFrom && item.ToUtc == windowTo) ?? present[0];
        var merged = aligned.Buckets.Select(CloneBucket).ToArray();
        foreach (var timeline in present.Where(item => !ReferenceEquals(item, aligned)))
        {
            if (timeline.Buckets.Count != merged.Length || timeline.FromUtc != aligned.FromUtc)
            {
                continue;
            }

            for (var index = 0; index < merged.Length; index++)
            {
                var source = timeline.Buckets[index];
                merged[index].Count += source.Count;
                merged[index].MockCount += source.MockCount;
                merged[index].ManualCount += source.ManualCount;
                merged[index].Status2xx += source.Status2xx;
                merged[index].Status3xx += source.Status3xx;
                merged[index].Status4xx += source.Status4xx;
                merged[index].Status5xx += source.Status5xx;
                merged[index].OtherCount += source.OtherCount;
            }
        }

        return new LogTimeline
        {
            FromUtc = aligned.FromUtc,
            ToUtc = aligned.ToUtc,
            BucketSeconds = aligned.BucketSeconds,
            Buckets = merged
        };
    }

    private static LogTimeline EmptyTimeline(DateTimeOffset from, DateTimeOffset to, int buckets)
    {
        var count = Math.Clamp(buckets <= 0 ? 80 : buckets, 10, 200);
        if (to <= from)
        {
            to = from.AddMinutes(1);
        }

        var bucketTicks = Math.Max((to - from).Ticks / count, TimeSpan.TicksPerSecond);
        return new LogTimeline
        {
            FromUtc = from,
            ToUtc = to,
            BucketSeconds = (int)Math.Max(1, bucketTicks / TimeSpan.TicksPerSecond),
            Buckets = Enumerable.Range(0, count)
                .Select(index => new LogTimelineBucket
                {
                    StartUtc = from.AddTicks(index * bucketTicks)
                })
                .ToList()
        };
    }

    private static LogTimelineBucket CloneBucket(LogTimelineBucket bucket) => new()
    {
        StartUtc = bucket.StartUtc,
        Count = bucket.Count,
        MockCount = bucket.MockCount,
        ManualCount = bucket.ManualCount,
        Status2xx = bucket.Status2xx,
        Status3xx = bucket.Status3xx,
        Status4xx = bucket.Status4xx,
        Status5xx = bucket.Status5xx,
        OtherCount = bucket.OtherCount
    };

    private static RequestProtocol? ParseProtocol(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (value.Equals("rest", StringComparison.OrdinalIgnoreCase))
        {
            return RequestProtocol.Other;
        }

        return Enum.TryParse<RequestProtocol>(value, true, out var parsed) ? ContentKind.Normalize(parsed) : null;
    }
}
