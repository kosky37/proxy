namespace Proxy.Core.Models;

public enum MockType
{
    Rest,
    Soap
}

public enum PathMatchMode
{
    Exact,
    Prefix,
    Template
}

public enum RequestMode
{
    Passthrough,
    Mock,
    Manual
}

public enum RequestProtocol
{
    Rest,
    Soap
}

public enum CertificateUsage
{
    Client,
    Server
}
