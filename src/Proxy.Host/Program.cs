namespace Proxy.Host;

internal static class Program
{
    private const string MutexName = @"Local\Proxy.Host";

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
