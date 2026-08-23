using Proxy.Core.Models;

namespace Proxy.Core.Matching;

public static class CertificateResolver
{
    public static CertificateDefinition? ResolveClient(LoadedProxy proxy, IEnumerable<CertificateDefinition> catalog) =>
        Resolve(catalog, proxy.Definition.Destination.ClientCertificateId, CertificateUsage.Client)
        ?? FromLegacy(proxy.Definition.Destination.ClientCertificate, CertificateUsage.Client);

    public static CertificateDefinition? ResolveServer(LoadedProxy proxy, IEnumerable<CertificateDefinition> catalog) =>
        Resolve(catalog, proxy.Definition.Listen.ServerCertificateId, CertificateUsage.Server)
        ?? FromLegacy(proxy.Definition.Listen.ServerCertificate, CertificateUsage.Server);

    public static string? ResolveFilePath(string dataRoot, CertificateDefinition? certificate)
    {
        if (string.IsNullOrWhiteSpace(certificate?.PfxPath))
        {
            return null;
        }

        return Path.IsPathRooted(certificate.PfxPath)
            ? certificate.PfxPath
            : Path.GetFullPath(Path.Combine(dataRoot, certificate.PfxPath));
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
