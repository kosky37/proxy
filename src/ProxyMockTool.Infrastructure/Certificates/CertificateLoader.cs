using System.Runtime.InteropServices;
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
