using System.Text;

namespace Proxy.Infrastructure.Listeners;

public readonly record struct BodyLimitResult(string? Text, int OriginalBytes, bool Exceeded);

public static class BodyLimiter
{
    public static BodyLimitResult Limit(string? body, int limitBytes)
    {
        if (string.IsNullOrEmpty(body))
        {
            return new BodyLimitResult(body, 0, false);
        }

        var bytes = Encoding.UTF8.GetByteCount(body);
        if (limitBytes <= 0 || bytes <= limitBytes)
        {
            return new BodyLimitResult(body, bytes, false);
        }

        return new BodyLimitResult(null, bytes, true);
    }
}
