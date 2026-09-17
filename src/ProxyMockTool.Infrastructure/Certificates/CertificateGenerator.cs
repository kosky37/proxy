using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using ProxyMockTool.Core.Storage;

namespace ProxyMockTool.Infrastructure.Certificates;

public static class CertificateGenerator
{
    public static GeneratedCertificate CreateRootCa(
        string commonName,
        DateTimeOffset notAfter,
        string password,
        string? friendlyName = null)
    {
        using var rsa = RSA.Create(4096);
        var request = new CertificateRequest(
            new X500DistinguishedName($"CN={EscapeDn(commonName)}"),
            rsa,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(
            new X509BasicConstraintsExtension(
                certificateAuthority: true,
                hasPathLengthConstraint: true,
                pathLengthConstraint: 0,
                critical: true));
        request.CertificateExtensions.Add(
            new X509KeyUsageExtension(X509KeyUsageFlags.KeyCertSign | X509KeyUsageFlags.CrlSign, critical: true));
        request.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(request.PublicKey, critical: false));

        using var cert = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), notAfter);
        SetFriendlyName(cert, friendlyName ?? commonName);
        return Export(cert, password);
    }

    public static GeneratedCertificate CreateServerCertificate(
        X509Certificate2 issuer,
        string commonName,
        IReadOnlyList<string> hosts,
        DateTimeOffset notAfter,
        string password,
        string? friendlyName = null)
    {
        if (!issuer.HasPrivateKey)
        {
            throw new InvalidOperationException("The root certificate does not have a private key.");
        }

        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest(
            new X500DistinguishedName($"CN={EscapeDn(commonName)}"),
            rsa,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
        request.CertificateExtensions.Add(
            new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
        request.CertificateExtensions.Add(
            new X509EnhancedKeyUsageExtension(new OidCollection { new Oid("1.3.6.1.5.5.7.3.1") }, true));
        request.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(request.PublicKey, false));
        request.CertificateExtensions.Add(
            X509AuthorityKeyIdentifierExtension.CreateFromCertificate(
                issuer,
                includeKeyIdentifier: true,
                includeIssuerAndSerial: false));
        request.CertificateExtensions.Add(BuildSan(hosts));

        var serial = new byte[16];
        RandomNumberGenerator.Fill(serial);
        serial[0] &= 0x7F;

        using var signed = request.Create(issuer, DateTimeOffset.UtcNow.AddDays(-1), notAfter, serial);
        using var withKey = signed.CopyWithPrivateKey(rsa);
        SetFriendlyName(withKey, friendlyName ?? commonName);
        return Export(withKey, password);
    }

    public static string WritePfxAndCer(string directory, string? certificateName, GeneratedCertificate generated)
    {
        Directory.CreateDirectory(directory);
        var pfxName = UniqueFileName(directory, certificateName);
        File.WriteAllBytes(Path.Combine(directory, pfxName), generated.Pfx);
        File.WriteAllBytes(Path.Combine(directory, Path.ChangeExtension(pfxName, ".cer")!), generated.Cer);
        return pfxName;
    }

    private static X509Extension BuildSan(IReadOnlyList<string> hosts)
    {
        var san = new SubjectAlternativeNameBuilder();
        var added = false;
        foreach (var host in hosts)
        {
            var value = host.Trim();
            if (value.Length == 0)
            {
                continue;
            }

            if (IPAddress.TryParse(value, out var ip))
            {
                san.AddIpAddress(ip);
            }
            else
            {
                san.AddDnsName(value);
            }

            added = true;
        }

        if (!added)
        {
            san.AddDnsName("localhost");
            san.AddIpAddress(IPAddress.Loopback);
        }

        return san.Build();
    }

    private static GeneratedCertificate Export(X509Certificate2 cert, string password) => new()
    {
        Pfx = cert.Export(X509ContentType.Pfx, password ?? ""),
        Cer = cert.Export(X509ContentType.Cert),
        Thumbprint = cert.Thumbprint,
        Subject = cert.Subject,
        NotBeforeUtc = cert.NotBefore.ToUniversalTime(),
        NotAfterUtc = cert.NotAfter.ToUniversalTime()
    };

    private static void SetFriendlyName(X509Certificate2 cert, string name)
    {
        if (OperatingSystem.IsWindows())
        {
            cert.FriendlyName = name;
        }
    }

    private static string EscapeDn(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace(",", "\\,", StringComparison.Ordinal)
            .Replace("+", "\\+", StringComparison.Ordinal)
            .Replace("\"", "\\\"", StringComparison.Ordinal)
            .Replace("<", "\\<", StringComparison.Ordinal)
            .Replace(">", "\\>", StringComparison.Ordinal)
            .Replace(";", "\\;", StringComparison.Ordinal);

    private static string UniqueFileName(string directory, string? certificateName)
    {
        var stem = SafeStem(certificateName) ?? "certificate";
        string fileName;
        do
        {
            fileName = $"{stem}-{Guid.NewGuid().ToString("N")[..8]}.pfx";
        }
        while (File.Exists(Path.Combine(directory, fileName)));

        return fileName;
    }

    private static string? SafeStem(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        try
        {
            var stem = MockFileNames.Sanitize(value);
            return string.IsNullOrWhiteSpace(stem) ? null : stem;
        }
        catch (ArgumentException)
        {
            return null;
        }
    }
}

public sealed class GeneratedCertificate
{
    public required byte[] Pfx { get; init; }
    public required byte[] Cer { get; init; }
    public required string Thumbprint { get; init; }
    public required string Subject { get; init; }
    public required DateTime NotBeforeUtc { get; init; }
    public required DateTime NotAfterUtc { get; init; }
}
