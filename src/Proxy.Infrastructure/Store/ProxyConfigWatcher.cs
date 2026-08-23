using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Proxy.Core.Options;

namespace Proxy.Infrastructure.Store;

public sealed class ProxyConfigWatcher : BackgroundService
{
    private readonly ProxyFolderStore _store;
    private readonly IOptions<AppOptions> _options;
    private readonly ILogger<ProxyConfigWatcher> _logger;
    private readonly TimeSpan _debounce = TimeSpan.FromMilliseconds(300);

    public ProxyConfigWatcher(ProxyFolderStore store, IOptions<AppOptions> options, ILogger<ProxyConfigWatcher> logger)
    {
        _store = store;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Directory.CreateDirectory(_options.Value.DataRoot);
        using var watcher = new FileSystemWatcher(_options.Value.DataRoot)
        {
            IncludeSubdirectories = true,
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size,
            EnableRaisingEvents = true
        };

        var reloadRequested = new CancellationTokenSource();
        watcher.Changed += (_, args) => OnChange(args.FullPath, reloadRequested);
        watcher.Created += (_, args) => OnChange(args.FullPath, reloadRequested);
        watcher.Deleted += (_, args) => OnChange(args.FullPath, reloadRequested);
        watcher.Renamed += (_, args) => OnChange(args.FullPath, reloadRequested);

        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(100));
        var pendingUntil = DateTime.MinValue;
        var generationAtRequest = _store.WriteGeneration;

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            if (pendingUntil == DateTime.MinValue || DateTime.UtcNow < pendingUntil)
            {
                continue;
            }

            pendingUntil = DateTime.MinValue;
            if (generationAtRequest != _store.WriteGeneration)
            {
                continue;
            }

            try
            {
                _store.Reload();
                _logger.LogInformation("Reloaded proxy configuration from {DataRoot}", _options.Value.DataRoot);
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Failed to reload proxy configuration");
            }
        }

        return;

        void OnChange(string path, CancellationTokenSource _)
        {
            if (ShouldIgnore(path))
            {
                return;
            }

            generationAtRequest = _store.WriteGeneration;
            pendingUntil = DateTime.UtcNow.Add(_debounce);
        }
    }

    private static bool ShouldIgnore(string path)
    {
        var name = Path.GetFileName(path);
        return name.StartsWith("logs.db", StringComparison.OrdinalIgnoreCase) ||
               name.EndsWith(".db-wal", StringComparison.OrdinalIgnoreCase) ||
               name.EndsWith(".db-shm", StringComparison.OrdinalIgnoreCase);
    }
}
