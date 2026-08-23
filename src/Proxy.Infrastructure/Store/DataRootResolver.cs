namespace Proxy.Infrastructure.Store;

public static class DataRootResolver
{
    public static string Resolve(string configured, string contentRoot)
    {
        if (Path.IsPathRooted(configured))
        {
            return Path.GetFullPath(configured);
        }

        var directory = new DirectoryInfo(contentRoot);
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, configured);
            if (Directory.Exists(candidate) || File.Exists(Path.Combine(directory.FullName, "Proxy.sln")))
            {
                return Path.GetFullPath(Path.Combine(directory.FullName, configured));
            }

            directory = directory.Parent;
        }

        return Path.GetFullPath(Path.Combine(contentRoot, configured));
    }
}
