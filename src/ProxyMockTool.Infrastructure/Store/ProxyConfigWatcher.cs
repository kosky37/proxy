using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ProxyMockTool.Core.Options;

namespace ProxyMockTool.Infrastructure.Store;

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
        var roots = new[] { _options.Value.DataRoot, _options.Value.CertificatesRoot }
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Select(Path.GetFullPath)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var watchers = new List<FileSystemWatcher>();
        foreach (var root in roots)
        {
            Directory.CreateDirectory(root);
            var watcher = new FileSystemWatcher(root)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size,
                EnableRaisingEvents = true
            };
            watcher.Changed += (_, args) => OnChange(args.FullPath);
            watcher.Created += (_, args) => OnChange(args.FullPath);
            watcher.Deleted += (_, args) => OnChange(args.FullPath);
            watcher.Renamed += (_, args) => OnChange(args.FullPath);
            watchers.Add(watcher);
        }

        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(100));
        var pendingUntil = DateTime.MinValue;
        var generationAtRequest = _store.WriteGeneration;

        try
        {
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
        }
        finally
        {
            foreach (var watcher in watchers)
            {
                watcher.Dispose();
            }
        }

        return;

        void OnChange(string path)
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
