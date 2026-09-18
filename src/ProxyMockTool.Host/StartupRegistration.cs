using Microsoft.Win32;

namespace ProxyMockTool.Host;

/// <summary>
/// Adds or removes the tray host in the current user's Windows startup list
/// (<c>HKCU\Software\Microsoft\Windows\CurrentVersion\Run</c>), so it needs no elevation.
/// </summary>
internal static class StartupRegistration
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "ProxyMockTool";

    public static bool IsEnabled
    {
        get
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: false);
                return key?.GetValue(ValueName) is string value && !string.IsNullOrWhiteSpace(value);
            }
            catch (Exception)
            {
                return false;
            }
        }
    }

    public static void Enable()
    {
        var executable = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(executable))
        {
            throw new InvalidOperationException("Could not determine the path of the running ProxyMockTool host.");
        }

        using var key = Registry.CurrentUser.CreateSubKey(RunKeyPath, writable: true)
            ?? throw new InvalidOperationException("Could not open the Windows startup registry key.");
        key.SetValue(ValueName, $"\"{executable}\"");
    }

    public static void Disable()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true);
        key?.DeleteValue(ValueName, throwOnMissingValue: false);
    }
}
