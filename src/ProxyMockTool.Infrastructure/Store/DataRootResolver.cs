using System.Collections.Generic;

namespace ProxyMockTool.Infrastructure.Store;

public static class DataRootResolver
{
    public const string AppFolderName = "ProxyMockTool";

    public static string AppDataRoot() =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            AppFolderName);

    /// <summary>
    /// Resolves DataRoot to %AppData%\ProxyMockTool\{configured} (default proxies).
    /// Absolute configured paths are kept. Migrates once from a legacy repo-local folder when AppData is empty.
    /// </summary>
    public static string Resolve(string configured, string contentRoot)
    {
        if (Path.IsPathRooted(configured))
        {
            var rooted = Path.GetFullPath(configured);
            Directory.CreateDirectory(rooted);
            return rooted;
        }

        var target = Path.GetFullPath(Path.Combine(AppDataRoot(), configured));
        var legacy = FindLegacyRoot(configured, contentRoot);
        if (legacy is not null)
        {
            MigrateDirectory(legacy, target);
        }

        Directory.CreateDirectory(target);
        return target;
    }

    /// <summary>
    /// Resolves CertificatesRoot as a sibling of DataRoot (e.g. %AppData%\ProxyMockTool\certificates).
    /// </summary>
    public static string ResolveSibling(string dataRoot, string configured, string? contentRoot = null)
    {
        if (Path.IsPathRooted(configured))
        {
            var rooted = Path.GetFullPath(configured);
            Directory.CreateDirectory(rooted);
            return rooted;
        }

        var parent = Path.GetDirectoryName(Path.GetFullPath(dataRoot));
        var target = string.IsNullOrEmpty(parent)
            ? Path.GetFullPath(configured)
            : Path.GetFullPath(Path.Combine(parent, configured));

        if (!string.IsNullOrWhiteSpace(contentRoot))
        {
            var legacyProxies = FindLegacyRoot("proxies", contentRoot);
            if (legacyProxies is not null)
            {
                var legacyParent = Path.GetDirectoryName(legacyProxies);
                if (!string.IsNullOrEmpty(legacyParent))
                {
                    var legacyCerts = Path.Combine(legacyParent, configured);
                    MigrateDirectory(legacyCerts, target);
                }
            }
        }

        Directory.CreateDirectory(target);
        return target;
    }

    public static string? FindLegacyRoot(string configured, string contentRoot)
    {
        if (Path.IsPathRooted(configured))
        {
            return null;
        }

        var appData = Path.GetFullPath(AppDataRoot());
        var directory = new DirectoryInfo(contentRoot);
        while (directory is not null)
        {
            // Never treat AppData itself as "legacy"
            if (directory.FullName.StartsWith(appData, StringComparison.OrdinalIgnoreCase))
            {
                directory = directory.Parent;
                continue;
            }

            var candidate = Path.Combine(directory.FullName, configured);
            var isRepo = File.Exists(Path.Combine(directory.FullName, "ProxyMockTool.slnx"))
                         || File.Exists(Path.Combine(directory.FullName, "Proxy.slnx"))
                         || File.Exists(Path.Combine(directory.FullName, "Proxy.sln"));
            if (Directory.Exists(candidate) && (isRepo || HasProxyFolders(candidate)))
            {
                var full = Path.GetFullPath(candidate);
                if (!full.StartsWith(appData, StringComparison.OrdinalIgnoreCase))
                {
                    return full;
                }
            }

            directory = directory.Parent;
        }

        return null;
    }

    private static bool HasProxyFolders(string proxiesRoot)
    {
        try
        {
            return Directory.GetDirectories(proxiesRoot)
                .Any(folder => File.Exists(Path.Combine(folder, "proxy.json")));
        }
        catch
        {
            return false;
        }
    }

    private static void MigrateDirectory(string source, string destination)
    {
        if (!Directory.Exists(source))
        {
            return;
        }

        var sourceFull = Path.GetFullPath(source);
        var destinationFull = Path.GetFullPath(destination);
        if (sourceFull.Equals(destinationFull, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        Directory.CreateDirectory(destinationFull);

        // Only migrate when destination has no proxy.json / cert json yet
        if (Directory.EnumerateFileSystemEntries(destinationFull).Any())
        {
            return;
        }

        foreach (var directory in Directory.GetDirectories(sourceFull, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(sourceFull, directory);
            Directory.CreateDirectory(Path.Combine(destinationFull, relative));
        }

        foreach (var file in Directory.GetFiles(sourceFull, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(sourceFull, file);
            var target = Path.Combine(destinationFull, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            if (!File.Exists(target))
            {
                File.Copy(file, target);
            }
        }
    }
}
