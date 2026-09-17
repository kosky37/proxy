using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using ProxyMockTool.Core.Matching;
using ProxyMockTool.Core.Models;

namespace ProxyMockTool.Infrastructure.Certificates;

public static class CertificateLoader
{
    public static X509Certificate2? Load(CertificateDefinition? certificate, string certificatesRoot)
    {
        if (certificate is null)
        {
            return null;
        }

        if (certificate.Source == CertificateSource.WindowsStore)
        {
            return LoadFromWindowsStore(certificate);
        }

        var path = CertificateResolver.ResolveFilePath(certificatesRoot, certificate);
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            return null;
        }

        return X509CertificateLoader.LoadPkcs12FromFile(path, certificate.Password ?? "");
    }

    public static string CacheKey(CertificateDefinition? certificate, string certificatesRoot)
    {
        if (certificate is null)
        {
            return "";
        }

        if (certificate.Source == CertificateSource.WindowsStore)
        {
            return $"win|{certificate.StoreLocation}|{certificate.StoreName}|{certificate.Thumbprint}";
        }

        var path = CertificateResolver.ResolveFilePath(certificatesRoot, certificate) ?? "";
        return $"file|{path}|{certificate.Password}";
    }

    public static X509Certificate2? LoadFromWindowsStore(CertificateDefinition certificate)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(certificate.Thumbprint))
        {
            return null;
        }

        var storeName = string.IsNullOrWhiteSpace(certificate.StoreName) ? "My" : certificate.StoreName;
        var location = ParseLocation(certificate.StoreLocation);
        using var store = new X509Store(storeName, location);
        store.Open(OpenFlags.ReadOnly | OpenFlags.OpenExistingOnly);
        var matches = store.Certificates.Find(X509FindType.FindByThumbprint, certificate.Thumbprint.Replace(" ", ""), validOnly: false);
        if (matches.Count == 0)
        {
            return null;
        }

        return matches[0];
    }

    public static IReadOnlyList<WindowsStoreCertificateInfo> ListWindowsStore(
        string storeLocation = "CurrentUser",
        string storeName = "My")
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return [];
        }

        var location = ParseLocation(storeLocation);
        using var store = new X509Store(storeName, location);
        store.Open(OpenFlags.ReadOnly | OpenFlags.OpenExistingOnly);
        return store.Certificates
            .Cast<X509Certificate2>()
            .Select(cert => new WindowsStoreCertificateInfo
            {
                Thumbprint = cert.Thumbprint,
                Subject = cert.Subject,
                FriendlyName = string.IsNullOrWhiteSpace(cert.FriendlyName) ? null : cert.FriendlyName,
                NotBeforeUtc = cert.NotBefore.ToUniversalTime(),
                NotAfterUtc = cert.NotAfter.ToUniversalTime(),
                HasPrivateKey = cert.HasPrivateKey
            })
            .OrderBy(item => item.FriendlyName ?? item.Subject, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public static CertificatePublicInfo? GetPublicInfo(CertificateDefinition? certificate, string certificatesRoot)
    {
        if (certificate is null)
        {
            return null;
        }

        if (certificate.Source == CertificateSource.WindowsStore)
        {
            using var loaded = LoadFromWindowsStore(certificate);
            return loaded is null ? null : FromCert(loaded);
        }

        var path = CertificateResolver.ResolveFilePath(certificatesRoot, certificate);
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            return null;
        }

        foreach (var candidate in PublicCertPaths(path))
        {
            if (!File.Exists(candidate))
            {
                continue;
            }

            try
            {
                using var cert = X509CertificateLoader.LoadCertificateFromFile(candidate);
                return FromCert(cert);
            }
            catch (CryptographicException)
            {
            }
        }

        try
        {
            using var loadedPfx = Load(certificate, certificatesRoot);
            return loadedPfx is null ? null : FromCert(loadedPfx);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    public static byte[]? ExportPublicCert(CertificateDefinition certificate, string certificatesRoot)
    {
        var path = CertificateResolver.ResolveFilePath(certificatesRoot, certificate);
        if (!string.IsNullOrWhiteSpace(path))
        {
            foreach (var candidate in PublicCertPaths(path))
            {
                if (File.Exists(candidate))
                {
                    return File.ReadAllBytes(candidate);
                }
            }
        }

        try
        {
            using var loaded = Load(certificate, certificatesRoot);
            return loaded?.Export(X509ContentType.Cert);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    private static IEnumerable<string> PublicCertPaths(string path)
    {
        var extension = Path.GetExtension(path);
        if (extension.Equals(".cer", StringComparison.OrdinalIgnoreCase) ||
            extension.Equals(".crt", StringComparison.OrdinalIgnoreCase) ||
            extension.Equals(".pem", StringComparison.OrdinalIgnoreCase))
        {
            yield return path;
        }

        var cerPath = Path.ChangeExtension(path, ".cer");
        if (!string.IsNullOrWhiteSpace(cerPath) &&
            !cerPath.Equals(path, StringComparison.OrdinalIgnoreCase))
        {
            yield return cerPath;
        }
    }

    public static IReadOnlyList<WindowsStoreLocation> FindInRootStore(string thumbprint)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows) || string.IsNullOrWhiteSpace(thumbprint))
        {
            return [];
        }

        var normalized = thumbprint.Replace(" ", "", StringComparison.Ordinal).ToUpperInvariant();
        var found = new List<WindowsStoreLocation>();
        foreach (var (location, storeName) in new (StoreLocation, string)[]
                 {
                     (StoreLocation.CurrentUser, "Root"),
                     (StoreLocation.LocalMachine, "Root")
                 })
        {
            try
            {
                using var store = new X509Store(storeName, location);
                store.Open(OpenFlags.ReadOnly | OpenFlags.OpenExistingOnly);
                var matches = store.Certificates.Find(X509FindType.FindByThumbprint, normalized, validOnly: false);
                if (matches.Count > 0)
                {
                    found.Add(new WindowsStoreLocation
                    {
                        StoreLocation = location.ToString(),
                        StoreName = storeName
                    });
                }
            }
            catch (Exception)
            {
            }
        }

        return found;
    }

    private static CertificatePublicInfo FromCert(X509Certificate2 cert) => new()
    {
        Thumbprint = cert.Thumbprint,
        Subject = cert.Subject,
        NotBeforeUtc = cert.NotBefore.ToUniversalTime(),
        NotAfterUtc = cert.NotAfter.ToUniversalTime()
    };

    private static StoreLocation ParseLocation(string? value) =>
        value is not null && value.Equals("LocalMachine", StringComparison.OrdinalIgnoreCase)
            ? StoreLocation.LocalMachine
            : StoreLocation.CurrentUser;
}

public sealed class WindowsStoreCertificateInfo
{
    public required string Thumbprint { get; init; }
    public required string Subject { get; init; }
    public string? FriendlyName { get; init; }
    public DateTime NotBeforeUtc { get; init; }
    public DateTime NotAfterUtc { get; init; }
    public bool HasPrivateKey { get; init; }
}

public sealed class CertificatePublicInfo
{
    public required string Thumbprint { get; init; }
    public required string Subject { get; init; }
    public DateTime NotBeforeUtc { get; init; }
    public DateTime NotAfterUtc { get; init; }
}

public sealed class WindowsStoreLocation
{
    public required string StoreLocation { get; init; }
    public required string StoreName { get; init; }
}
