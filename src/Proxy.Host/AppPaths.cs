namespace Proxy.Host;

internal sealed class AppPaths
{
    public required string Root { get; init; }
    public required string ApiProject { get; init; }
    public required string ApiDirectory { get; init; }
    public required string Frontend { get; init; }

    public string ApiAssembly => Path.Combine(ApiDirectory, "bin", "Release", "net10.0", "Proxy.Api.dll");
    public string ApiExecutable => Path.Combine(ApiDirectory, "bin", "Release", "net10.0", "Proxy.Api.exe");
    public string ViteEntry => Path.Combine(Frontend, "node_modules", "vite", "bin", "vite.js");
    public string FrontendIndex => Path.Combine(Frontend, "dist", "index.html");
    public string FrontendModules => Path.Combine(Frontend, "node_modules");

    public bool HasApiBuild => File.Exists(ApiAssembly);
    public bool HasFrontendBuild => File.Exists(FrontendIndex);
    public bool HasFrontendPackages => Directory.Exists(FrontendModules);

    public static AppPaths? Find()
    {
        foreach (var start in new[] { Environment.CurrentDirectory, AppContext.BaseDirectory })
        {
            for (var directory = new DirectoryInfo(start); directory is not null; directory = directory.Parent)
            {
                var api = Path.Combine(directory.FullName, "src", "Proxy.Api", "Proxy.Api.csproj");
                var frontend = Path.Combine(directory.FullName, "frontend", "package.json");
                if (File.Exists(api) && File.Exists(frontend))
                {
                    return new AppPaths
                    {
                        Root = directory.FullName,
                        ApiProject = api,
                        ApiDirectory = Path.GetDirectoryName(api)!,
                        Frontend = Path.GetDirectoryName(frontend)!
                    };
                }
            }
        }

        return null;
    }
}
