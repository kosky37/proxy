using Proxy.Core.Models;

namespace Proxy.Core.Contracts;

public interface IRequestLogStore
{
    Task<RequestLogEntry> WriteAsync(string proxyId, string folderPath, RequestLogEntry entry, CancellationToken cancellationToken = default);
    Task<LogListResult> QueryAsync(string proxyId, string folderPath, LogQuery query, CancellationToken cancellationToken = default);
    Task<RequestLogEntry?> GetAsync(string proxyId, string folderPath, long id, CancellationToken cancellationToken = default);
    Task<ProxyStats> GetStatsAsync(string proxyId, string folderPath, CancellationToken cancellationToken = default);
}
