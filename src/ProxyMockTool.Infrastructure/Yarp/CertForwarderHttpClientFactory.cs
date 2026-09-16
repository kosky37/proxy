using System.Collections.Concurrent;
using System.Security.Cryptography.X509Certificates;
using ProxyMockTool.Core.Models;
using ProxyMockTool.Infrastructure.Certificates;
using Yarp.ReverseProxy.Forwarder;

namespace ProxyMockTool.Infrastructure.Yarp;

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

        var certificate = ResolveClientCertificate(metadata);
        if (certificate is null)
        {
            return;
        }

        handler.SslOptions.ClientCertificates ??= new X509CertificateCollection();
        handler.SslOptions.ClientCertificates.Add(certificate);
        handler.SslOptions.EnabledSslProtocols = System.Security.Authentication.SslProtocols.Tls12 |
                                                 System.Security.Authentication.SslProtocols.Tls13;
    }

    private X509Certificate2? ResolveClientCertificate(IReadOnlyDictionary<string, string> metadata)
    {
        metadata.TryGetValue("clientCertSource", out var source);
        if (string.Equals(source, "windowsStore", StringComparison.OrdinalIgnoreCase))
        {
            metadata.TryGetValue("clientCertThumbprint", out var thumbprint);
            metadata.TryGetValue("clientCertStoreLocation", out var storeLocation);
            metadata.TryGetValue("clientCertStoreName", out var storeName);
            if (string.IsNullOrWhiteSpace(thumbprint))
            {
                return null;
            }

            var key = $"win|{storeLocation}|{storeName}|{thumbprint}";
            return _certificates.GetOrAdd(key, _ =>
                CertificateLoader.LoadFromWindowsStore(new CertificateDefinition
                {
                    Source = CertificateSource.WindowsStore,
                    Thumbprint = thumbprint,
                    StoreLocation = storeLocation,
                    StoreName = storeName
                })!);
        }

        if (metadata.TryGetValue("clientCertPath", out var path) && !string.IsNullOrWhiteSpace(path) && File.Exists(path))
        {
            metadata.TryGetValue("clientCertPassword", out var password);
            var cacheKey = $"file|{path}|{password}";
            return _certificates.GetOrAdd(cacheKey, _ =>
                X509CertificateLoader.LoadPkcs12FromFile(path, password ?? ""));
        }

        return null;
    }
}
