namespace ProxyMockTool.Host;

internal static class Program
{
    private const string MutexName = @"Local\ProxyMockTool.Host";

    [STAThread]
    private static void Main()
    {
        using var mutex = new Mutex(true, MutexName, out var created);
        if (!created)
        {
            TrayApplicationContext.OpenUi();
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.Run(new TrayApplicationContext());
    }
}
