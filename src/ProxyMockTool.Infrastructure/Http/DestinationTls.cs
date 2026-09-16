using System.Security.Cryptography.X509Certificates;
using ProxyMockTool.Core.Matching;
using ProxyMockTool.Core.Models;

namespace ProxyMockTool.Infrastructure.Http;

public static class DestinationTls
{
    public static void Configure(
        SocketsHttpHandler handler,
        LoadedProxy proxy,
        IReadOnlyList<CertificateDefinition> catalog,
        string certificatesRoot)
    {
        if (proxy.Definition.Destination.AcceptAnyServerCertificate)
        {
            handler.SslOptions.RemoteCertificateValidationCallback = static (_, _, _, _) => true;
        }

        var cert = CertificateResolver.ResolveClient(proxy, catalog);
        var path = CertificateResolver.ResolveFilePath(certificatesRoot, cert);
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            return;
        }

        var certificate = X509CertificateLoader.LoadPkcs12FromFile(
            path,
            cert?.Password ?? "");
        handler.SslOptions.ClientCertificates ??= new X509CertificateCollection();
        handler.SslOptions.ClientCertificates.Add(certificate);
        handler.SslOptions.EnabledSslProtocols = System.Security.Authentication.SslProtocols.Tls12 |
                                                 System.Security.Authentication.SslProtocols.Tls13;
    }
}
