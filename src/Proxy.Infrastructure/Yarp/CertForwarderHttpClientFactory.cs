using System.Collections.Concurrent;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using Yarp.ReverseProxy.Forwarder;

namespace Proxy.Infrastructure.Yarp;

public sealed class CertForwarderHttpClientFactory : ForwarderHttpClientFactory
{
    private readonly ConcurrentDictionary<string, X509Certificate2> _certificates = new(StringComparer.OrdinalIgnoreCase);

    protected override void ConfigureHandler(ForwarderHttpClientContext context, SocketsHttpHandler handler)
    {
        base.ConfigureHandler(context, handler);
        var metadata = context.NewMetadata;
        if (metadata is null)
        {
            return;
        }

        if (metadata.TryGetValue("acceptAnyServerCertificate", out var accept) &&
            accept.Equals("true", StringComparison.OrdinalIgnoreCase))
        {
            handler.SslOptions.RemoteCertificateValidationCallback = static (_, _, _, _) => true;
        }

        if (metadata.TryGetValue("clientCertPath", out var path) && !string.IsNullOrWhiteSpace(path) && File.Exists(path))
        {
            metadata.TryGetValue("clientCertPassword", out var password);
            var cacheKey = $"{path}|{password}";
            var certificate = _certificates.GetOrAdd(cacheKey, _ => LoadCertificate(path, password));
            handler.SslOptions.ClientCertificates ??= new X509CertificateCollection();
            handler.SslOptions.ClientCertificates.Add(certificate);
            handler.SslOptions.EnabledSslProtocols = System.Security.Authentication.SslProtocols.Tls12 |
                                                     System.Security.Authentication.SslProtocols.Tls13;
        }
    }

    private static X509Certificate2 LoadCertificate(string path, string? password)
    {
        return X509CertificateLoader.LoadPkcs12FromFile(
            path,
            password ?? "",
            X509KeyStorageFlags.EphemeralKeySet);
    }
}
