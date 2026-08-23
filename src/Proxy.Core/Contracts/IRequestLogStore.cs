using Proxy.Core.Models;

namespace Proxy.Core.Contracts;

public interface IRequestLogStore
{
    Task<RequestLogEntry> WriteAsync(string proxyId, string folderPath, RequestLogEntry entry, CancellationToken cancellationToken = default);
    Task<LogListResult> QueryAsync(string proxyId, string folderPath, LogQuery query, CancellationToken cancellationToken = default);
    Task<RequestLogEntry?> GetAsync(string proxyId, string folderPath, long id, CancellationToken cancellationToken = default);
    Task<LogStorageInfo> GetStorageAsync(string proxyId, string folderPath, CancellationToken cancellationToken = default);
    Task<LogTimeline> GetTimelineAsync(string proxyId, string folderPath, DateTimeOffset? fromUtc, DateTimeOffset? toUtc, int buckets = 80, CancellationToken cancellationToken = default);
    Task<int> DeleteAsync(string proxyId, string folderPath, DateTimeOffset? fromUtc = null, DateTimeOffset? toUtc = null, CancellationToken cancellationToken = default);
    Task<int> DeleteBeforeAsync(string proxyId, string folderPath, DateTimeOffset cutoffUtc, CancellationToken cancellationToken = default);
}
