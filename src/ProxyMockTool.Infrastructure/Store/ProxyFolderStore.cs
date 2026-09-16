using System.Collections.Immutable;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ProxyMockTool.Core;
using ProxyMockTool.Core.Contracts;
using ProxyMockTool.Core.Models;
using ProxyMockTool.Core.Options;
using ProxyMockTool.Core.Storage;
using ProxyMockTool.Infrastructure.Certificates;

namespace ProxyMockTool.Infrastructure.Store;

public sealed class ProxyFolderStore : IProxyConfigStore
{
    private readonly IOptions<AppOptions> _options;
    private readonly ILogger<ProxyFolderStore> _logger;
    private readonly SqliteCertificateCatalog _certificateCatalog;
    private readonly object _gate = new();
    private ImmutableArray<LoadedProxy> _proxies = [];
    private ImmutableArray<CertificateDefinition> _certificates = [];

    public ProxyFolderStore(IOptions<AppOptions> options, ILogger<ProxyFolderStore> logger)
    {
        _options = options;
        _logger = logger;
        var appData = Path.GetDirectoryName(Path.GetFullPath(options.Value.CertificatesRoot))
                      ?? DataRootResolver.AppDataRoot();
        _certificateCatalog = new SqliteCertificateCatalog(Path.Combine(appData, "certificates.db"));
        Directory.CreateDirectory(options.Value.CertificatesRoot);
        _certificateCatalog.ImportFromJsonFiles(options.Value.CertificatesRoot);
        ReloadSilent();
    }

    public event EventHandler? Changed;

    public string DataRoot => _options.Value.DataRoot;
    public string CertificatesRoot => _options.Value.CertificatesRoot;
    public string DisablePrefix => _options.Value.MockDisablePrefix;
    public long WriteGeneration { get; private set; }

    public IReadOnlyList<LoadedProxy> GetAll() => _proxies;

    public IReadOnlyList<CertificateDefinition> GetCertificates() => _certificates;

    public LoadedProxy? Get(string id) =>
        _proxies.FirstOrDefault(proxy => proxy.Id.Equals(id, StringComparison.OrdinalIgnoreCase));

    public LoadedProxy Create(string id, ProxyDefinition definition)
    {
        var safeId = MockFileNames.Sanitize(id);
        lock (_gate)
        {
            if (Get(safeId) is not null)
            {
                throw new InvalidOperationException($"Proxy '{safeId}' already exists.");
            }

            var folder = Path.Combine(DataRoot, safeId);
            Directory.CreateDirectory(folder);
            Directory.CreateDirectory(Path.Combine(folder, "mocks"));
            Directory.CreateDirectory(Path.Combine(folder, "ignores"));
            WriteGeneration++;
            WriteProxyFile(folder, definition);
            ReloadCore();
        }

        NotifyChanged();
        return Get(safeId) ?? throw new InvalidOperationException("Created proxy was not loaded.");
    }

    public LoadedProxy Update(string id, ProxyDefinition definition)
    {
        lock (_gate)
        {
            var existing = Require(id);
            WriteGeneration++;
            WriteProxyFile(existing.FolderPath, definition);
            ReloadCore();
        }

        NotifyChanged();
        return Require(id);
    }

    public void Delete(string id)
    {
        lock (_gate)
        {
            var existing = Require(id);
            WriteGeneration++;
            DeleteFolder(existing.FolderPath);
            ReloadCore();
        }

        NotifyChanged();
    }

    public MockDefinition CreateMock(string proxyId, MockDefinition mock)
    {
        MockDefinition created;
        lock (_gate)
        {
            var proxy = Require(proxyId);
            var fileName = MockFileNames.ToFileName(mock.Name, DisablePrefix, mock.Enabled);
            var path = Path.Combine(proxy.FolderPath, "mocks", fileName);
            if (File.Exists(path) || FindMockFile(proxy, mock.Name) is not null)
            {
                throw new InvalidOperationException($"Mock '{mock.Name}' already exists.");
            }

            WriteGeneration++;
            WriteMockFile(path, mock);
            ReloadCore();
            created = Require(proxyId).Mocks.First(item => item.Name.Equals(mock.Name, StringComparison.OrdinalIgnoreCase));
        }

        NotifyChanged();
        return created;
    }

    public MockDefinition UpdateMock(string proxyId, string name, MockDefinition mock)
    {
        MockDefinition updated;
        lock (_gate)
        {
            var proxy = Require(proxyId);
            var existing = FindMockFile(proxy, name) ?? throw new KeyNotFoundException($"Mock '{name}' was not found.");
            WriteGeneration++;
            WriteMockFile(existing, mock);
            var desiredName = MockFileNames.ToFileName(mock.Name, DisablePrefix, mock.Enabled);
            var desiredPath = Path.Combine(proxy.FolderPath, "mocks", desiredName);
            if (!existing.Equals(desiredPath, StringComparison.OrdinalIgnoreCase))
            {
                if (File.Exists(desiredPath))
                {
                    throw new InvalidOperationException($"Mock '{mock.Name}' already exists.");
                }

                File.Move(existing, desiredPath);
            }

            ReloadCore();
            updated = Require(proxyId).Mocks.First(item => item.Name.Equals(mock.Name, StringComparison.OrdinalIgnoreCase));
        }

        NotifyChanged();
        return updated;
    }

    public void DeleteMock(string proxyId, string name)
    {
        lock (_gate)
        {
            var proxy = Require(proxyId);
            var existing = FindMockFile(proxy, name) ?? throw new KeyNotFoundException($"Mock '{name}' was not found.");
            WriteGeneration++;
            File.Delete(existing);
            ReloadCore();
        }

        NotifyChanged();
    }

    public MockDefinition ToggleMock(string proxyId, string name)
    {
        MockDefinition toggled;
        lock (_gate)
        {
            var proxy = Require(proxyId);
            var existing = FindMockFile(proxy, name) ?? throw new KeyNotFoundException($"Mock '{name}' was not found.");
            var directory = Path.GetDirectoryName(existing) ?? Path.Combine(proxy.FolderPath, "mocks");
            var next = Path.Combine(directory, MockFileNames.ToggleFileName(existing, DisablePrefix));
            WriteGeneration++;
            File.Move(existing, next);
            ReloadCore();
            toggled = Require(proxyId).Mocks.First(item => item.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        }

        NotifyChanged();
        return toggled;
    }

    public IgnoredPath CreateIgnore(string proxyId, IgnoredPath ignore)
    {
        IgnoredPath created;
        lock (_gate)
        {
            var proxy = Require(proxyId);
            var fileName = $"{MockFileNames.Sanitize(ignore.Name)}.json";
            var path = Path.Combine(proxy.FolderPath, "ignores", fileName);
            if (File.Exists(path) || FindIgnoreFile(proxy, ignore.Name) is not null)
            {
                throw new InvalidOperationException($"Ignore '{ignore.Name}' already exists.");
            }

            WriteGeneration++;
            WriteIgnoreFile(path, ignore);
            ReloadCore();
            created = Require(proxyId).Ignores.First(item => item.Name.Equals(ignore.Name, StringComparison.OrdinalIgnoreCase));
        }

        NotifyChanged();
        return created;
    }

    public IgnoredPath UpdateIgnore(string proxyId, string name, IgnoredPath ignore)
    {
        IgnoredPath updated;
        lock (_gate)
        {
            var proxy = Require(proxyId);
            var existing = FindIgnoreFile(proxy, name) ?? throw new KeyNotFoundException($"Ignore '{name}' was not found.");
            WriteGeneration++;
            WriteIgnoreFile(existing, ignore);
            var desiredPath = Path.Combine(proxy.FolderPath, "ignores", $"{MockFileNames.Sanitize(ignore.Name)}.json");
            if (!existing.Equals(desiredPath, StringComparison.OrdinalIgnoreCase))
            {
                if (File.Exists(desiredPath))
                {
                    throw new InvalidOperationException($"Ignore '{ignore.Name}' already exists.");
                }

                File.Move(existing, desiredPath);
            }

            ReloadCore();
            updated = Require(proxyId).Ignores.First(item => item.Name.Equals(ignore.Name, StringComparison.OrdinalIgnoreCase));
        }

        NotifyChanged();
        return updated;
    }

    public void DeleteIgnore(string proxyId, string name)
    {
        lock (_gate)
        {
            var proxy = Require(proxyId);
            var existing = FindIgnoreFile(proxy, name) ?? throw new KeyNotFoundException($"Ignore '{name}' was not found.");
            WriteGeneration++;
            File.Delete(existing);
            ReloadCore();
        }

        NotifyChanged();
    }

    public MockSet CreateMockSet(string proxyId, MockSet set)
    {
        MockSet created;
        lock (_gate)
        {
            var proxy = Require(proxyId);
            var fileName = $"{MockFileNames.Sanitize(set.Name)}.json";
            var path = Path.Combine(proxy.FolderPath, "mock-sets", fileName);
            if (File.Exists(path) || FindMockSetFile(proxy, set.Name) is not null)
            {
                throw new InvalidOperationException($"Mock set '{set.Name}' already exists.");
            }

            WriteGeneration++;
            WriteMockSetFile(path, set);
            ReloadCore();
            created = Require(proxyId).MockSets.First(item => item.Name.Equals(set.Name, StringComparison.OrdinalIgnoreCase));
        }

        NotifyChanged();
        return created;
    }

    public MockSet UpdateMockSet(string proxyId, string name, MockSet set)
    {
        MockSet updated;
        lock (_gate)
        {
            var proxy = Require(proxyId);
            var existing = FindMockSetFile(proxy, name) ?? throw new KeyNotFoundException($"Mock set '{name}' was not found.");
            WriteGeneration++;
            WriteMockSetFile(existing, set);
            var desiredPath = Path.Combine(proxy.FolderPath, "mock-sets", $"{MockFileNames.Sanitize(set.Name)}.json");
            if (!existing.Equals(desiredPath, StringComparison.OrdinalIgnoreCase))
            {
                if (File.Exists(desiredPath))
                {
                    throw new InvalidOperationException($"Mock set '{set.Name}' already exists.");
                }

                File.Move(existing, desiredPath);
            }

            ReloadCore();
            updated = Require(proxyId).MockSets.First(item => item.Name.Equals(set.Name, StringComparison.OrdinalIgnoreCase));
        }

        NotifyChanged();
        return updated;
    }

    public void DeleteMockSet(string proxyId, string name)
    {
        lock (_gate)
        {
            var proxy = Require(proxyId);
            var existing = FindMockSetFile(proxy, name) ?? throw new KeyNotFoundException($"Mock set '{name}' was not found.");
            WriteGeneration++;
            File.Delete(existing);
            ReloadCore();
        }

        NotifyChanged();
    }

    public IReadOnlyList<MockDefinition> ApplyMockSet(string proxyId, string name)
    {
        lock (_gate)
        {
            var proxy = Require(proxyId);
            var set = proxy.MockSets.FirstOrDefault(item => item.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
                      ?? throw new KeyNotFoundException($"Mock set '{name}' was not found.");
            WriteGeneration++;
            foreach (var mock in proxy.Mocks)
            {
                var enable = set.MockNames.Any(item => item.Equals(mock.Name, StringComparison.OrdinalIgnoreCase));
                SetMockEnabledLocked(proxy, mock.Name, enable);
            }

            ReloadCore();
        }

        NotifyChanged();
        return Require(proxyId).Mocks;
    }

    public LoadedProxy SetMocksEnabled(string proxyId, bool enabled)
    {
        lock (_gate)
        {
            var proxy = Require(proxyId);
            proxy.Definition.MocksEnabled = enabled;
            WriteGeneration++;
            WriteProxyFile(proxy.FolderPath, proxy.Definition);
            ReloadCore();
        }

        NotifyChanged();
        return Require(proxyId);
    }

    public CertificateDefinition CreateCertificate(CertificateDefinition certificate)
    {
        CertificateDefinition created;
        lock (_gate)
        {
            WriteGeneration++;
            created = _certificateCatalog.Create(NormalizeCertificate(certificate));
            ReloadCore();
            created = RequireCertificate(created.Name);
        }

        NotifyChanged();
        return created;
    }

    public CertificateDefinition UpdateCertificate(string name, CertificateDefinition certificate)
    {
        CertificateDefinition updated;
        lock (_gate)
        {
            WriteGeneration++;
            updated = _certificateCatalog.Update(name, NormalizeCertificate(certificate));
            if (!name.Equals(updated.Name, StringComparison.OrdinalIgnoreCase))
            {
                RetargetCertificateIds(name, updated.Name);
            }

            ReloadCore();
            updated = RequireCertificate(updated.Name);
        }

        NotifyChanged();
        return updated;
    }

    public void DeleteCertificate(string name)
    {
        lock (_gate)
        {
            WriteGeneration++;
            _certificateCatalog.Delete(name);
            RetargetCertificateIds(name, null);
            ReloadCore();
        }

        NotifyChanged();
    }

    public void Reload()
    {
        lock (_gate)
        {
            ReloadCore();
        }

        NotifyChanged();
    }

    public void ReloadSilent()
    {
        lock (_gate)
        {
            ReloadCore();
        }
    }

    private void ReloadCore()
    {
        Directory.CreateDirectory(DataRoot);
        Directory.CreateDirectory(CertificatesRoot);
        MigrateCertificates();
        var loaded = new List<LoadedProxy>();
        foreach (var folder in Directory.GetDirectories(DataRoot).OrderBy(path => path, StringComparer.OrdinalIgnoreCase))
        {
            var proxyFile = Path.Combine(folder, "proxy.json");
            if (!File.Exists(proxyFile))
            {
                continue;
            }

            try
            {
                loaded.Add(LoadProxy(folder, proxyFile));
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Failed to load proxy from {Folder}", folder);
            }
        }

        _proxies = [.. loaded];
        _certificates = [.. LoadCertificates()];
    }

    private LoadedProxy LoadProxy(string folder, string proxyFile)
    {
        var json = File.ReadAllText(proxyFile);
        var definition = JsonSerializer.Deserialize<ProxyDefinition>(json, JsonDefaults.Options)
                         ?? throw new InvalidOperationException($"Invalid proxy.json in {folder}");
        if (string.IsNullOrWhiteSpace(definition.Name))
        {
            definition.Name = Path.GetFileName(folder);
        }

        var mocksDirectory = Path.Combine(folder, "mocks");
        Directory.CreateDirectory(mocksDirectory);
        Directory.CreateDirectory(Path.Combine(folder, "ignores"));
        Directory.CreateDirectory(Path.Combine(folder, "mock-sets"));
        var mocks = Directory.GetFiles(mocksDirectory, "*.json")
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
            .Select(path => LoadMock(path))
            .Where(mock => mock is not null)
            .Cast<MockDefinition>()
            .ToList();
        var ignores = Directory.GetFiles(Path.Combine(folder, "ignores"), "*.json")
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
            .Select(LoadIgnore)
            .Where(item => item is not null)
            .Cast<IgnoredPath>()
            .ToList();
        var mockSets = Directory.GetFiles(Path.Combine(folder, "mock-sets"), "*.json")
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
            .Select(LoadMockSet)
            .Where(item => item is not null)
            .Cast<MockSet>()
            .ToList();

        return new LoadedProxy
        {
            Id = Path.GetFileName(folder),
            FolderPath = folder,
            Definition = definition,
            Mocks = mocks,
            Ignores = ignores,
            MockSets = mockSets
        };
    }

    private IEnumerable<CertificateDefinition> LoadCertificates() => _certificateCatalog.List();

    private static CertificateDefinition NormalizeCertificate(CertificateDefinition certificate)
    {
        if (certificate.Source == CertificateSource.WindowsStore)
        {
            certificate.StoreName = string.IsNullOrWhiteSpace(certificate.StoreName) ? "My" : certificate.StoreName;
            certificate.StoreLocation = string.IsNullOrWhiteSpace(certificate.StoreLocation) ? "CurrentUser" : certificate.StoreLocation;
            certificate.Thumbprint = certificate.Thumbprint?.Replace(" ", "").ToUpperInvariant();
            certificate.PfxPath = null;
            certificate.Password = null;
            certificate.FileName = $"store:{certificate.StoreLocation}/{certificate.StoreName}/{certificate.Thumbprint}";
        }
        else
        {
            certificate.Source = CertificateSource.File;
            certificate.PfxPath = NormalizePfxPath(certificate.PfxPath);
            certificate.StoreName = null;
            certificate.StoreLocation = null;
            certificate.Thumbprint = null;
            certificate.FileName = Path.GetFileName(certificate.PfxPath ?? "");
        }

        return certificate;
    }

    private MockDefinition? LoadMock(string path)
    {
        try
        {
            var json = File.ReadAllText(path);
            var mock = JsonSerializer.Deserialize<MockDefinition>(json, JsonDefaults.Options)
                       ?? throw new InvalidOperationException("Mock file was empty.");
            var fileName = Path.GetFileName(path);
            mock.FileName = fileName;
            mock.Enabled = !MockFileNames.IsDisabled(fileName, DisablePrefix);
            if (string.IsNullOrWhiteSpace(mock.Name))
            {
                mock.Name = MockFileNames.GetLogicalName(fileName, DisablePrefix);
            }

            return mock;
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Failed to load mock {Path}", path);
            return null;
        }
    }

    private IgnoredPath? LoadIgnore(string path)
    {
        try
        {
            var json = File.ReadAllText(path);
            var ignore = JsonSerializer.Deserialize<IgnoredPath>(json, JsonDefaults.Options)
                         ?? throw new InvalidOperationException("Ignore file was empty.");
            var fileName = Path.GetFileName(path);
            ignore.FileName = fileName;
            if (string.IsNullOrWhiteSpace(ignore.Name))
            {
                ignore.Name = Path.GetFileNameWithoutExtension(fileName);
            }

            return ignore;
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Failed to load ignore {Path}", path);
            return null;
        }
    }

    private MockSet? LoadMockSet(string path)
    {
        try
        {
            var json = File.ReadAllText(path);
            var set = JsonSerializer.Deserialize<MockSet>(json, JsonDefaults.Options)
                      ?? throw new InvalidOperationException("Mock set file was empty.");
            var fileName = Path.GetFileName(path);
            set.FileName = fileName;
            if (string.IsNullOrWhiteSpace(set.Name))
            {
                set.Name = Path.GetFileNameWithoutExtension(fileName);
            }

            set.MockNames = set.MockNames
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Select(name => name.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            return set;
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Failed to load mock set {Path}", path);
            return null;
        }
    }

    private LoadedProxy Require(string id) =>
        Get(id) ?? throw new KeyNotFoundException($"Proxy '{id}' was not found.");

    private CertificateDefinition RequireCertificate(string name) =>
        _certificates.FirstOrDefault(item => item.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
        ?? throw new KeyNotFoundException($"Certificate '{name}' was not found.");

    private string? FindMockFile(LoadedProxy proxy, string name)
    {
        var mocksDirectory = Path.Combine(proxy.FolderPath, "mocks");
        if (!Directory.Exists(mocksDirectory))
        {
            return null;
        }

        return Directory.GetFiles(mocksDirectory, "*.json")
            .FirstOrDefault(path =>
                MockFileNames.GetLogicalName(Path.GetFileName(path), DisablePrefix)
                    .Equals(name, StringComparison.OrdinalIgnoreCase));
    }

    private static string? FindIgnoreFile(LoadedProxy proxy, string name)
    {
        var directory = Path.Combine(proxy.FolderPath, "ignores");
        if (!Directory.Exists(directory))
        {
            return null;
        }

        return Directory.GetFiles(directory, "*.json")
            .FirstOrDefault(path =>
            {
                if (Path.GetFileNameWithoutExtension(path).Equals(name, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                try
                {
                    var ignore = JsonSerializer.Deserialize<IgnoredPath>(File.ReadAllText(path), JsonDefaults.Options);
                    return ignore?.Name.Equals(name, StringComparison.OrdinalIgnoreCase) == true;
                }
                catch (JsonException)
                {
                    return false;
                }
            });
    }

    private static string? FindMockSetFile(LoadedProxy proxy, string name)
    {
        var directory = Path.Combine(proxy.FolderPath, "mock-sets");
        if (!Directory.Exists(directory))
        {
            return null;
        }

        return Directory.GetFiles(directory, "*.json")
            .FirstOrDefault(path =>
            {
                if (Path.GetFileNameWithoutExtension(path).Equals(name, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                try
                {
                    var set = JsonSerializer.Deserialize<MockSet>(File.ReadAllText(path), JsonDefaults.Options);
                    return set?.Name.Equals(name, StringComparison.OrdinalIgnoreCase) == true;
                }
                catch (JsonException)
                {
                    return false;
                }
            });
    }

    private void SetMockEnabledLocked(LoadedProxy proxy, string name, bool enabled)
    {
        var existing = FindMockFile(proxy, name);
        if (existing is null)
        {
            return;
        }

        var currentlyEnabled = !MockFileNames.IsDisabled(Path.GetFileName(existing), DisablePrefix);
        if (currentlyEnabled == enabled)
        {
            return;
        }

        var directory = Path.GetDirectoryName(existing) ?? Path.Combine(proxy.FolderPath, "mocks");
        File.Move(existing, Path.Combine(directory, MockFileNames.ToggleFileName(existing, DisablePrefix)));
    }

    private static void WriteMockSetFile(string path, MockSet set)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var persisted = new MockSet
        {
            Name = set.Name,
            MockNames = set.MockNames
        };
        File.WriteAllText(path, JsonSerializer.Serialize(persisted, JsonDefaults.Options));
    }

    private static void WriteIgnoreFile(string path, IgnoredPath ignore)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var persisted = new IgnoredPath
        {
            Name = ignore.Name,
            Path = ignore.Path,
            PathMode = ignore.PathMode,
            Methods = ignore.Methods
        };
        File.WriteAllText(path, JsonSerializer.Serialize(persisted, JsonDefaults.Options));
    }

    private static void WriteProxyFile(string folder, ProxyDefinition definition)
    {
        var path = Path.Combine(folder, "proxy.json");
        var json = JsonSerializer.Serialize(definition, JsonDefaults.Options);
        File.WriteAllText(path, json);
    }

    private void RetargetCertificateIds(string oldName, string? newName)
    {
        foreach (var proxy in _proxies)
        {
            var changed = false;
            if (proxy.Definition.Listen.ServerCertificateId?.Equals(oldName, StringComparison.OrdinalIgnoreCase) == true)
            {
                proxy.Definition.Listen.ServerCertificateId = newName;
                changed = true;
            }

            if (proxy.Definition.Destination.ClientCertificateId?.Equals(oldName, StringComparison.OrdinalIgnoreCase) == true)
            {
                proxy.Definition.Destination.ClientCertificateId = newName;
                changed = true;
            }

            if (changed)
            {
                WriteProxyFile(proxy.FolderPath, proxy.Definition);
            }
        }
    }

    private void MigrateCertificates()
    {
        MoveLooseFiles(Path.Combine(DataRoot, "certificates"), CertificatesRoot);
        MoveLooseFiles(Path.Combine(DataRoot, "certs"), CertificatesRoot);
        if (Directory.Exists(DataRoot))
        {
            foreach (var folder in Directory.GetDirectories(DataRoot))
            {
                MoveLooseFiles(Path.Combine(folder, "certificates"), CertificatesRoot);
                MoveLooseFiles(Path.Combine(folder, "certs"), CertificatesRoot);
            }
        }

        _certificateCatalog.ImportFromJsonFiles(CertificatesRoot);
    }

    private static void MoveLooseFiles(string sourceDirectory, string destinationDirectory)
    {
        if (!Directory.Exists(sourceDirectory) ||
            Path.GetFullPath(sourceDirectory).Equals(Path.GetFullPath(destinationDirectory), StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        Directory.CreateDirectory(destinationDirectory);
        foreach (var file in Directory.GetFiles(sourceDirectory))
        {
            var destination = Path.Combine(destinationDirectory, Path.GetFileName(file));
            if (!File.Exists(destination))
            {
                File.Move(file, destination);
            }
        }
    }

    private static string? NormalizePfxPath(string? pfxPath)
    {
        if (string.IsNullOrWhiteSpace(pfxPath) || Path.IsPathRooted(pfxPath))
        {
            return pfxPath;
        }

        var relative = pfxPath.Replace('\\', '/');
        if (relative.StartsWith("certs/", StringComparison.OrdinalIgnoreCase))
        {
            relative = relative["certs/".Length..];
        }

        return Path.GetFileName(relative);
    }

    private static void WriteMockFile(string path, MockDefinition mock)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var persisted = new MockDefinition
        {
            Type = mock.Type,
            Name = mock.Name,
            Match = mock.Match,
            Response = mock.Response
        };
        File.WriteAllText(path, JsonSerializer.Serialize(persisted, JsonDefaults.Options));
    }

    private void NotifyChanged() => Changed?.Invoke(this, EventArgs.Empty);

    private static void DeleteFolder(string path)
    {
        for (var attempt = 0; attempt < 8; attempt++)
        {
            try
            {
                if (Directory.Exists(path))
                {
                    Directory.Delete(path, recursive: true);
                }

                return;
            }
            catch (IOException) when (attempt < 7)
            {
                Thread.Sleep(50 * (attempt + 1));
            }
            catch (UnauthorizedAccessException) when (attempt < 7)
            {
                Thread.Sleep(50 * (attempt + 1));
            }
        }
    }
}
