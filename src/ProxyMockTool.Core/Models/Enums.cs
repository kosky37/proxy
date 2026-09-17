namespace ProxyMockTool.Core.Models;

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
    Other,
    Soap,
    Json,
    Xml,
    Rest
}

public enum CertificateUsage
{
    Client,
    Server,
    Root
}

public enum CertificateSource
{
    File,
    WindowsStore
}
