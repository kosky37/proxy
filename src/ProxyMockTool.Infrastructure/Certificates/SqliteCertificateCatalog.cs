using Microsoft.EntityFrameworkCore;
using ProxyMockTool.Core.Models;
using ProxyMockTool.Core;
using ProxyMockTool.Infrastructure.Store;

namespace ProxyMockTool.Infrastructure.Certificates;

public sealed class SqliteCertificateCatalog
{
    private readonly string _databasePath;
    private readonly object _gate = new();

    public SqliteCertificateCatalog(string databasePath)
    {
        _databasePath = Path.GetFullPath(databasePath);
        Directory.CreateDirectory(Path.GetDirectoryName(_databasePath)!);
        EnsureCreated();
    }

    public string DatabasePath => _databasePath;

    public IReadOnlyList<CertificateDefinition> List()
    {
        lock (_gate)
        {
            using var db = Open();
            return db.Certificates
                .AsNoTracking()
                .OrderBy(item => item.Name)
                .ToList()
                .Select(ToModel)
                .ToList();
        }
    }

    public CertificateDefinition? Find(string name)
    {
        lock (_gate)
        {
            using var db = Open();
            var row = db.Certificates.AsNoTracking()
                .FirstOrDefault(item => item.Name.ToLower() == name.ToLower());
            return row is null ? null : ToModel(row);
        }
    }

    public CertificateDefinition Create(CertificateDefinition certificate)
    {
        lock (_gate)
        {
            using var db = Open();
            if (db.Certificates.AsEnumerable().Any(item => item.Name.Equals(certificate.Name, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException($"Certificate '{certificate.Name}' already exists.");
            }

            db.Certificates.Add(ToRow(certificate));
            db.SaveChanges();
            return certificate;
        }
    }

    public CertificateDefinition Update(string name, CertificateDefinition certificate)
    {
        lock (_gate)
        {
            using var db = Open();
            var row = db.Certificates.AsEnumerable()
                          .FirstOrDefault(item => item.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
                      ?? throw new KeyNotFoundException($"Certificate '{name}' was not found.");

            if (!name.Equals(certificate.Name, StringComparison.OrdinalIgnoreCase) &&
                db.Certificates.AsEnumerable().Any(item => item.Name.Equals(certificate.Name, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException($"Certificate '{certificate.Name}' already exists.");
            }

            if (!name.Equals(certificate.Name, StringComparison.OrdinalIgnoreCase))
            {
                db.Certificates.Remove(row);
                db.SaveChanges();
                var created = ToRow(certificate);
                db.Certificates.Add(created);
                db.SaveChanges();
                return ToModel(created);
            }

            row.Type = certificate.Type.ToString();
            row.Source = certificate.Source.ToString();
            row.PfxPath = certificate.PfxPath;
            row.Password = certificate.Password;
            row.StoreName = certificate.StoreName;
            row.StoreLocation = certificate.StoreLocation;
            row.Thumbprint = NormalizeThumbprint(certificate.Thumbprint);
            row.FileName = DisplayFileName(certificate);
            db.SaveChanges();
            return ToModel(row);
        }
    }

    public void Delete(string name)
    {
        lock (_gate)
        {
            using var db = Open();
            var row = db.Certificates.AsEnumerable().FirstOrDefault(item => item.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
                      ?? throw new KeyNotFoundException($"Certificate '{name}' was not found.");
            db.Certificates.Remove(row);
            db.SaveChanges();
        }
    }

    public void ImportFromJsonFiles(string certificatesRoot)
    {
        if (!Directory.Exists(certificatesRoot))
        {
            return;
        }

        lock (_gate)
        {
            using var db = Open();
            if (db.Certificates.Any())
            {
                return;
            }

            foreach (var path in Directory.GetFiles(certificatesRoot, "*.json"))
            {
                try
                {
                    var json = File.ReadAllText(path);
                    var certificate = System.Text.Json.JsonSerializer.Deserialize<CertificateDefinition>(json, JsonDefaults.Options);
                    if (certificate is null || string.IsNullOrWhiteSpace(certificate.Name))
                    {
                        continue;
                    }

                    certificate.Source = CertificateSource.File;
                    certificate.FileName = DisplayFileName(certificate);
                    if (db.Certificates.AsEnumerable().Any(item => item.Name.Equals(certificate.Name, StringComparison.OrdinalIgnoreCase)))
                    {
                        continue;
                    }

                    db.Certificates.Add(ToRow(certificate));
                }
                catch
                {
                    // skip bad legacy files
                }
            }

            db.SaveChanges();
        }
    }

    private void EnsureCreated()
    {
        lock (_gate)
        {
            using var db = Open();
            db.Database.EnsureCreated();
        }
    }

    private CertificateDbContext Open()
    {
        var options = new DbContextOptionsBuilder<CertificateDbContext>()
            .UseSqlite($"Data Source={_databasePath}")
            .Options;
        return new CertificateDbContext(options);
    }

    private static CertificateRow ToRow(CertificateDefinition certificate) => new()
    {
        Name = certificate.Name,
        Type = certificate.Type.ToString(),
        Source = certificate.Source.ToString(),
        PfxPath = certificate.PfxPath,
        Password = certificate.Password,
        StoreName = certificate.StoreName,
        StoreLocation = certificate.StoreLocation,
        Thumbprint = NormalizeThumbprint(certificate.Thumbprint),
        FileName = DisplayFileName(certificate)
    };

    private static CertificateDefinition ToModel(CertificateRow row) => new()
    {
        Name = row.Name,
        Type = Enum.TryParse<CertificateUsage>(row.Type, true, out var type) ? type : CertificateUsage.Client,
        Source = Enum.TryParse<CertificateSource>(row.Source, true, out var source) ? source : CertificateSource.File,
        PfxPath = row.PfxPath,
        Password = row.Password,
        StoreName = row.StoreName,
        StoreLocation = row.StoreLocation,
        Thumbprint = row.Thumbprint,
        FileName = row.FileName
    };

    private static string DisplayFileName(CertificateDefinition certificate) =>
        certificate.Source == CertificateSource.WindowsStore
            ? $"store:{certificate.StoreLocation ?? "CurrentUser"}/{certificate.StoreName ?? "My"}/{certificate.Thumbprint}"
            : Path.GetFileName(certificate.PfxPath ?? "") ;

    private static string? NormalizeThumbprint(string? thumbprint) =>
        string.IsNullOrWhiteSpace(thumbprint) ? null : thumbprint.Replace(" ", "").ToUpperInvariant();
}

public sealed class CertificateDbContext(DbContextOptions<CertificateDbContext> options) : DbContext(options)
{
    public DbSet<CertificateRow> Certificates => Set<CertificateRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CertificateRow>(entity =>
        {
            entity.ToTable("certificates");
            entity.HasKey(item => item.Name);
            entity.Property(item => item.Name).HasMaxLength(200);
            entity.Property(item => item.Type).HasMaxLength(32);
            entity.Property(item => item.Source).HasMaxLength(32);
        });
    }
}

public sealed class CertificateRow
{
    public string Name { get; set; } = "";
    public string Type { get; set; } = "Client";
    public string Source { get; set; } = "File";
    public string? PfxPath { get; set; }
    public string? Password { get; set; }
    public string? StoreName { get; set; }
    public string? StoreLocation { get; set; }
    public string? Thumbprint { get; set; }
    public string FileName { get; set; } = "";
}
