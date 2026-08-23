using Proxy.Core.Options;

namespace Proxy.Core.Models;

public static class LogLimits
{
    public static int BodyLimitBytes(ProxyDefinition definition, AppOptions options) =>
        definition.BodyLogLimitBytes is > 0 ? definition.BodyLogLimitBytes.Value : options.BodyLogLimitBytes;

    public static int RetentionDays(ProxyDefinition definition, AppOptions options) =>
        definition.LogRetentionDays ?? options.LogRetentionDays;

    public static DateTimeOffset? RetentionCutoffUtc(ProxyDefinition definition, AppOptions options)
    {
        var days = RetentionDays(definition, options);
        return days <= 0 ? null : DateTimeOffset.UtcNow.AddDays(-days);
    }
}
