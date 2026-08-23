using System.Text;

namespace Proxy.Infrastructure.Listeners;

public static class BodyLimiter
{
    public static (string? Text, bool Truncated) Limit(string? body, int limitBytes)
    {
        if (string.IsNullOrEmpty(body))
        {
            return (body, false);
        }

        var bytes = Encoding.UTF8.GetByteCount(body);
        if (bytes <= limitBytes)
        {
            return (body, false);
        }

        var buffer = Encoding.UTF8.GetBytes(body);
        var text = Encoding.UTF8.GetString(buffer, 0, limitBytes);
        return (text + "\n… [truncated]", true);
    }
}
