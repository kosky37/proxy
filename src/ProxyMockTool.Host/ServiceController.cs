using System.Diagnostics;
using System.Net.Sockets;
using System.Text;

namespace ProxyMockTool.Host;

internal sealed class ServiceController : IDisposable
{
    public const int ApiPort = 9310;
    public const int UiPort = 9311;
    public const string UiUrl = "http://127.0.0.1:9311/";

    private readonly AppPaths _paths;
    private readonly object _gate = new();
    private Process? _api;
    private Process? _frontend;
    private KillOnCloseJob? _apiJob;
    private KillOnCloseJob? _frontendJob;
    private bool _ownsApi;
    private bool _ownsFrontend;

    public ServiceController(AppPaths paths)
    {
        _paths = paths;
    }

    public bool ApiRunning => IsListening(ApiPort);
    public bool UiRunning => IsListening(UiPort);
    public bool OwnsApi => _ownsApi;
    public bool OwnsFrontend => _ownsFrontend;

    /// <summary>Serves the frontend with the Vite dev server instead of <c>vite preview</c>. Development only.</summary>
    public bool UseDevServer { get; set; }

    public void StartApi(Action<string>? status = null)
    {
        if (ApiRunning)
        {
            return;
        }

        EnsureApiBuild(status);
        lock (_gate)
        {
            if (ApiRunning)
            {
                return;
            }

            status?.Invoke("Starting backend…");
            var env = new Dictionary<string, string>
            {
                ["ASPNETCORE_ENVIRONMENT"] = "Production",
                ["ASPNETCORE_URLS"] = $"http://127.0.0.1:{ApiPort}",
                ["ASPNETCORE_CONTENTROOT"] = _paths.ApiDirectory
            };
            var process = File.Exists(_paths.ApiExecutable)
                ? StartProcess(_paths.ApiExecutable, "", _paths.ApiDirectory, env)
                : StartProcess("dotnet", $"exec \"{_paths.ApiAssembly}\"", _paths.ApiDirectory, env);
            var job = new KillOnCloseJob();
            job.Add(process);
            _apiJob = job;
            _api = process;
            _ownsApi = true;
        }

        if (_api is not null && _apiJob is not null)
        {
            CatchUpJob(_apiJob, _api);
        }

        if (!WaitForPort(ApiPort, TimeSpan.FromSeconds(30)))
        {
            StopApi();
            throw new InvalidOperationException($"Backend did not start on port {ApiPort}.");
        }
    }

    public void StopApi()
    {
        lock (_gate)
        {
            StopOwned(ref _api, ref _apiJob, ApiPort, _ownsApi);
            _ownsApi = false;
        }
    }

    public void RebuildApi(Action<string>? status = null)
    {
        var wasOwned = _ownsApi;
        StopApi();
        BuildApi(status);
        if (wasOwned)
        {
            StartApi(status);
        }
    }

    public void StartFrontend(Action<string>? status = null)
    {
        if (UiRunning)
        {
            return;
        }

        EnsureFrontendBuild(status);
        lock (_gate)
        {
            if (UiRunning)
            {
                return;
            }

            status?.Invoke("Starting frontend…");
            var process = StartFrontendProcess();
            var job = new KillOnCloseJob();
            job.Add(process);
            _frontendJob = job;
            _frontend = process;
            _ownsFrontend = true;
        }

        if (_frontend is not null && _frontendJob is not null)
        {
            CatchUpJob(_frontendJob, _frontend);
        }

        if (!WaitForPort(UiPort, TimeSpan.FromSeconds(45)))
        {
            StopFrontend();
            throw new InvalidOperationException($"Frontend did not start on port {UiPort}.");
        }
    }

    public void StopFrontend()
    {
        lock (_gate)
        {
            StopOwned(ref _frontend, ref _frontendJob, UiPort, _ownsFrontend);
            _ownsFrontend = false;
        }
    }

    public void RebuildFrontend(Action<string>? status = null)
    {
        var wasOwned = _ownsFrontend;
        StopFrontend();
        BuildFrontend(status);
        if (wasOwned)
        {
            StartFrontend(status);
        }
    }

    public void RestartFrontend(Action<string>? status = null)
    {
        StopFrontend();
        StartFrontend(status);
    }

    public void RestartApi(Action<string>? status = null)
    {
        StopApi();
        StartApi(status);
    }

    public void RestartAll(Action<string>? status = null)
    {
        StopFrontend();
        StopApi();
        StartApi(status);
        StartFrontend(status);
    }

    public void StartAll(Action<string>? status = null)
    {
        StartApi(status);
        StartFrontend(status);
    }

    public void Dispose()
    {
        StopFrontend();
        StopApi();
    }

    private void EnsureApiBuild(Action<string>? status)
    {
        if (!_paths.HasApiBuild)
        {
            BuildApi(status);
        }
    }

    private void EnsureFrontendBuild(Action<string>? status)
    {
        if (!_paths.HasFrontendPackages)
        {
            status?.Invoke("Installing frontend packages…");
            Run(NpmFile(), "install", _paths.Frontend, TimeSpan.FromMinutes(5));
        }

        // The dev server compiles on the fly, so a production build is only needed for preview.
        if (!UseDevServer && !_paths.HasFrontendBuild)
        {
            BuildFrontend(status);
        }
    }

    private void BuildApi(Action<string>? status)
    {
        status?.Invoke("Building backend (Release)…");
        Run("dotnet", $"build \"{_paths.ApiProject}\" -c Release --nologo", _paths.Root, TimeSpan.FromMinutes(3));
        if (!_paths.HasApiBuild)
        {
            throw new InvalidOperationException("Backend Release build did not produce ProxyMockTool.Api.dll.");
        }
    }

    private void BuildFrontend(Action<string>? status)
    {
        if (!_paths.HasFrontendPackages)
        {
            status?.Invoke("Installing frontend packages…");
            Run(NpmFile(), "install", _paths.Frontend, TimeSpan.FromMinutes(5));
        }

        status?.Invoke("Building frontend…");
        Run(NpmFile(), "run build", _paths.Frontend, TimeSpan.FromMinutes(5));
        if (!_paths.HasFrontendBuild)
        {
            throw new InvalidOperationException("Frontend build did not produce dist/index.html.");
        }
    }

    private Process StartFrontendProcess()
    {
        if (File.Exists(_paths.ViteEntry))
        {
            var command = UseDevServer ? "" : " preview";
            return StartProcess(
                NodeFile(),
                $"\"{_paths.ViteEntry}\"{command} --host 127.0.0.1 --port {UiPort} --strictPort",
                _paths.Frontend);
        }

        var npmCommand = UseDevServer ? "dev" : "preview";
        return StartProcess(
            NpmFile(),
            $"run {npmCommand} -- --host 127.0.0.1 --port {UiPort} --strictPort",
            _paths.Frontend);
    }

    private static void CatchUpJob(KillOnCloseJob job, Process process)
    {
        for (var i = 0; i < 8; i++)
        {
            Thread.Sleep(50);
            job.Add(process);
        }
    }

    private static void StopOwned(ref Process? process, ref KillOnCloseJob? job, int port, bool owns)
    {
        var tree = process is null ? [] : ProcessTree.Descendants(process.Id);
        ProcessTree.Kill(process);
        foreach (var id in tree)
        {
            ProcessTree.Kill(id);
        }

        job?.Dispose();
        job = null;
        process?.Dispose();
        process = null;
        if (owns)
        {
            KillListener(port);
            WaitWhileListening(port, TimeSpan.FromSeconds(3));
        }
    }

    private static string NpmFile() => FindOnPath("npm.cmd") ?? "npm.cmd";

    private static string NodeFile()
    {
        var npm = FindOnPath("npm.cmd");
        if (npm is not null)
        {
            var sibling = Path.Combine(Path.GetDirectoryName(npm)!, "node.exe");
            if (File.Exists(sibling))
            {
                return sibling;
            }
        }

        return FindOnPath("node.exe") ?? "node";
    }

    private static string? FindOnPath(string fileName)
    {
        var path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var directory in path.Split(Path.PathSeparator))
        {
            var candidate = Path.Combine(directory, fileName);
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        return null;
    }

    private static Process StartProcess(
        string fileName,
        string arguments,
        string workingDirectory,
        IReadOnlyDictionary<string, string>? environment = null)
    {
        var start = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        if (environment is not null)
        {
            foreach (var (key, value) in environment)
            {
                start.Environment[key] = value;
            }
        }

        var process = Process.Start(start) ?? throw new InvalidOperationException($"Failed to start {fileName}.");
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        return process;
    }

    private static void Run(string fileName, string arguments, string workingDirectory, TimeSpan timeout)
    {
        var output = new StringBuilder();
        var start = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        using var process = Process.Start(start) ?? throw new InvalidOperationException($"Failed to start {fileName}.");
        process.OutputDataReceived += (_, eventArgs) =>
        {
            if (eventArgs.Data is not null)
            {
                output.AppendLine(eventArgs.Data);
            }
        };
        process.ErrorDataReceived += (_, eventArgs) =>
        {
            if (eventArgs.Data is not null)
            {
                output.AppendLine(eventArgs.Data);
            }
        };
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        if (!process.WaitForExit((int)timeout.TotalMilliseconds))
        {
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch (InvalidOperationException)
            {
            }

            throw new TimeoutException($"{fileName} {arguments} timed out.");
        }

        if (process.ExitCode != 0)
        {
            var text = output.ToString().Trim();
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(text)
                ? $"{fileName} {arguments} failed with exit code {process.ExitCode}."
                : text.Split('\n').TakeLast(8).Aggregate((left, right) => left + Environment.NewLine + right));
        }
    }

    private static bool WaitForPort(int port, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (IsListening(port))
            {
                return true;
            }

            Thread.Sleep(250);
        }

        return IsListening(port);
    }

    private static void WaitWhileListening(int port, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline && IsListening(port))
        {
            Thread.Sleep(50);
        }
    }

    private static bool IsListening(int port)
    {
        try
        {
            using var client = new TcpClient();
            var task = client.ConnectAsync("127.0.0.1", port);
            return task.Wait(TimeSpan.FromMilliseconds(200)) && client.Connected;
        }
        catch (SocketException)
        {
            return false;
        }
    }

    private static void KillListener(int port)
    {
        var pid = PidOnPort(port);
        if (pid is null or 0)
        {
            return;
        }

        try
        {
            using var process = Process.GetProcessById(pid.Value);
            process.Kill(entireProcessTree: true);
        }
        catch (ArgumentException)
        {
        }
        catch (InvalidOperationException)
        {
        }
        catch (System.ComponentModel.Win32Exception)
        {
        }
    }

    private static int? PidOnPort(int port)
    {
        var start = new ProcessStartInfo
        {
            FileName = "netstat",
            Arguments = "-ano",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true
        };
        using var process = Process.Start(start);
        if (process is null)
        {
            return null;
        }

        var output = process.StandardOutput.ReadToEnd();
        process.WaitForExit(3000);
        foreach (var line in output.Split('\n'))
        {
            if (!line.Contains("LISTENING", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 4 || !int.TryParse(parts[^1], out var pid))
            {
                continue;
            }

            var address = parts[1];
            if (address.EndsWith($":{port}", StringComparison.Ordinal)
                || address.EndsWith($"]:{port}", StringComparison.Ordinal))
            {
                return pid;
            }
        }

        return null;
    }
}
