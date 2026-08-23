using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Proxy.Core.Contracts;
using Proxy.Core.Models;
using Proxy.Core.Options;

namespace Proxy.Infrastructure.Logging;

public sealed class LogRetentionService : BackgroundService
{
    private readonly IProxyConfigStore _store;
    private readonly IRequestLogStore _logs;
    private readonly AppOptions _options;
    private readonly ILogger<LogRetentionService> _logger;

    public LogRetentionService(
        IProxyConfigStore store,
        IRequestLogStore logs,
        IOptions<AppOptions> options,
        ILogger<LogRetentionService> logger)
    {
        _store = store;
        _logs = logs;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await PurgeAsync(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await PurgeAsync(stoppingToken);
        }
    }

    private async Task PurgeAsync(CancellationToken cancellationToken)
    {
        foreach (var proxy in _store.GetAll())
        {
            var cutoff = LogLimits.RetentionCutoffUtc(proxy.Definition, _options);
            if (cutoff is null)
            {
                continue;
            }

            try
            {
                var deleted = await _logs.DeleteBeforeAsync(proxy.Id, proxy.FolderPath, cutoff.Value, cancellationToken);
                if (deleted > 0)
                {
                    _logger.LogInformation("Removed {Count} expired log entries for {ProxyId}", deleted, proxy.Id);
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError(exception, "Failed to apply log retention for {ProxyId}", proxy.Id);
            }
        }
    }
}
