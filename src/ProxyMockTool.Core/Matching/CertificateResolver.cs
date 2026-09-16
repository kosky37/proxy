using ProxyMockTool.Core.Models;

namespace ProxyMockTool.Core.Matching;

public static class CertificateResolver
{
    public static CertificateDefinition? ResolveClient(LoadedProxy proxy, IEnumerable<CertificateDefinition> catalog) =>
        Resolve(catalog, proxy.Definition.Destination.ClientCertificateId, CertificateUsage.Client)
        ?? FromLegacy(proxy.Definition.Destination.ClientCertificate, CertificateUsage.Client);

    public static CertificateDefinition? ResolveServer(LoadedProxy proxy, IEnumerable<CertificateDefinition> catalog) =>
        Resolve(catalog, proxy.Definition.Listen.ServerCertificateId, CertificateUsage.Server)
        ?? FromLegacy(proxy.Definition.Listen.ServerCertificate, CertificateUsage.Server);

    public static string? ResolveFilePath(string certificatesRoot, CertificateDefinition? certificate)
    {
        if (string.IsNullOrWhiteSpace(certificate?.PfxPath))
        {
            return null;
        }

        if (Path.IsPathRooted(certificate.PfxPath))
        {
            return certificate.PfxPath;
        }

        var relative = certificate.PfxPath.Replace('\\', '/');
        if (relative.StartsWith("certs/", StringComparison.OrdinalIgnoreCase))
        {
            relative = relative["certs/".Length..];
        }

        return Path.GetFullPath(Path.Combine(certificatesRoot, relative));
    }

    private static CertificateDefinition? Resolve(IEnumerable<CertificateDefinition> catalog, string? id, CertificateUsage type)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return null;
        }

        return catalog.FirstOrDefault(item =>
            item.Name.Equals(id, StringComparison.OrdinalIgnoreCase) && item.Type == type);
    }

    private static CertificateDefinition? FromLegacy(CertificateConfig? certificate, CertificateUsage type)
    {
        if (string.IsNullOrWhiteSpace(certificate?.PfxPath))
        {
            return null;
        }

        return new CertificateDefinition
        {
            Name = "legacy",
            Type = type,
            PfxPath = certificate.PfxPath,
            Password = certificate.Password
        };
    }
}
