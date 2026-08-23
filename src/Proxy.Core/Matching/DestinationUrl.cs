namespace Proxy.Core.Matching;

public static class DestinationUrl
{
    public static Uri Build(string address, string path, string? pathPrefix, string? query)
    {
        var dest = address.Trim();
        if (string.IsNullOrWhiteSpace(dest))
        {
            throw new InvalidOperationException("Destination address is empty.");
        }

        if (!Uri.TryCreate(dest, UriKind.Absolute, out _))
        {
            throw new InvalidOperationException($"Destination address '{address}' is not an absolute URL.");
        }

        if (!dest.EndsWith('/'))
        {
            dest += "/";
        }

        var relative = PathMatcher.Normalize(string.IsNullOrWhiteSpace(path) ? "/" : path);
        if (!string.IsNullOrWhiteSpace(pathPrefix))
        {
            var prefix = PathMatcher.Normalize(pathPrefix);
            if (relative.Equals(prefix, StringComparison.OrdinalIgnoreCase))
            {
                relative = "/";
            }
            else if (relative.StartsWith(prefix + "/", StringComparison.OrdinalIgnoreCase))
            {
                relative = relative[prefix.Length..];
                if (string.IsNullOrEmpty(relative))
                {
                    relative = "/";
                }
            }
        }

        var uri = new Uri(new Uri(dest, UriKind.Absolute), relative.TrimStart('/'));
        if (string.IsNullOrWhiteSpace(query))
        {
            return uri;
        }

        var builder = new UriBuilder(uri)
        {
            Query = query.Trim().TrimStart('?')
        };
        return builder.Uri;
    }
}
