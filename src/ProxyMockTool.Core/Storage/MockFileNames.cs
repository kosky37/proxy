using System.Text.RegularExpressions;

namespace ProxyMockTool.Core.Storage;

public static class MockFileNames
{
    public static bool IsDisabled(string fileName, string prefix)
    {
        return fileName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase);
    }

    public static string GetLogicalName(string fileName, string prefix)
    {
        var name = Path.GetFileNameWithoutExtension(fileName);
        if (IsDisabled(name, prefix))
        {
            name = name[prefix.Length..];
        }

        return name;
    }

    public static string ToFileName(string name, string prefix, bool enabled)
    {
        var safe = Sanitize(name);
        return enabled ? $"{safe}.json" : $"{prefix}{safe}.json";
    }

    public static string ToggleFileName(string fileName, string prefix)
    {
        var name = Path.GetFileName(fileName);
        if (IsDisabled(name, prefix))
        {
            return name[prefix.Length..];
        }

        return prefix + name;
    }

    public static string Sanitize(string name)
    {
        var trimmed = name.Trim();
        var invalid = Path.GetInvalidFileNameChars();
        var chars = trimmed.Select(ch => invalid.Contains(ch) ? '-' : ch).ToArray();
        var safe = new string(chars);
        if (string.IsNullOrWhiteSpace(safe))
        {
            throw new ArgumentException("Mock name is empty after sanitizing.", nameof(name));
        }

        return Regex.Replace(safe, @"\s+", "-");
    }
}
