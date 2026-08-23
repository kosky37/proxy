using System.Security.Cryptography.X509Certificates;
using Proxy.Core.Matching;
using Proxy.Core.Models;

namespace Proxy.Infrastructure.Http;

public static class DestinationTls
{
    public static void Configure(
        SocketsHttpHandler handler,
        LoadedProxy proxy,
        IReadOnlyList<CertificateDefinition> catalog,
        string dataRoot)
    {
        if (proxy.Definition.Destination.AcceptAnyServerCertificate)
        {
            handler.SslOptions.RemoteCertificateValidationCallback = static (_, _, _, _) => true;
        }

        var cert = CertificateResolver.ResolveClient(proxy, catalog);
        var path = CertificateResolver.ResolveFilePath(dataRoot, cert);
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            return;
        }

        var certificate = X509CertificateLoader.LoadPkcs12FromFile(
            path,
            cert?.Password ?? "",
            X509KeyStorageFlags.EphemeralKeySet);
        handler.SslOptions.ClientCertificates ??= new X509CertificateCollection();
        handler.SslOptions.ClientCertificates.Add(certificate);
        handler.SslOptions.EnabledSslProtocols = System.Security.Authentication.SslProtocols.Tls12 |
                                                 System.Security.Authentication.SslProtocols.Tls13;
    }
}
