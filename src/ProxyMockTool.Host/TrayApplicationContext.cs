using System.Diagnostics;

namespace ProxyMockTool.Host;

internal sealed class TrayApplicationContext : ApplicationContext
{
    private readonly NotifyIcon _icon;
    private readonly ServiceController? _controller;
    private readonly ToolStripMenuItem _statusItem;
    private readonly ToolStripMenuItem _startApi;
    private readonly ToolStripMenuItem _stopApi;
    private readonly ToolStripMenuItem _restartApi;
    private readonly ToolStripMenuItem _rebuildApi;
    private readonly ToolStripMenuItem _startUi;
    private readonly ToolStripMenuItem _stopUi;
    private readonly ToolStripMenuItem _restartUi;
    private readonly ToolStripMenuItem _rebuildUi;
    private readonly ToolStripMenuItem _restartAll;
    private readonly ToolStripMenuItem _devUi;
    private bool _busy;

    public TrayApplicationContext()
    {
        var paths = AppPaths.Find();
        _controller = paths is null ? null : new ServiceController(paths);

        _statusItem = new ToolStripMenuItem("Starting…") { Enabled = false };
        _startApi = Item("Start backend", () => _controller?.StartApi(SetStatus));
        _stopApi = Item("Stop backend", () => _controller?.StopApi());
        _restartApi = Item("Restart backend", () => _controller?.RestartApi(SetStatus));
        _rebuildApi = Item("Rebuild backend", () => _controller?.RebuildApi(SetStatus));
        _startUi = Item("Start frontend", () => _controller?.StartFrontend(SetStatus));
        _stopUi = Item("Stop frontend", () => _controller?.StopFrontend());
        _restartUi = Item("Restart frontend", () => _controller?.RestartFrontend(SetStatus));
        _rebuildUi = Item("Rebuild frontend", () => _controller?.RebuildFrontend(SetStatus));
        _restartAll = Item("Restart backend & frontend", () => _controller?.RestartAll(SetStatus));
        _devUi = new ToolStripMenuItem("Development server") { CheckOnClick = true };
        _devUi.CheckedChanged += (_, _) => OnDevServerToggled();

        var backend = new ToolStripMenuItem("Backend");
        backend.DropDownItems.AddRange(_startApi, _stopApi, _restartApi, _rebuildApi);
        var frontend = new ToolStripMenuItem("Frontend");
        frontend.DropDownItems.AddRange(_startUi, _stopUi, _restartUi, _rebuildUi);
        frontend.DropDownItems.Add(new ToolStripSeparator());
        frontend.DropDownItems.Add(_devUi);

        var menu = new ContextMenuStrip();
        menu.Items.Add(new ToolStripMenuItem("Open admin UI", null, (_, _) => OpenUi())
        {
            Font = new Font(SystemFonts.MenuFont!, FontStyle.Bold)
        });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(backend);
        menu.Items.Add(frontend);
        menu.Items.Add(_restartAll);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(_statusItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Exit", null, (_, _) => Exit()));
        menu.Opening += (_, _) => RefreshMenu();

        _icon = new NotifyIcon
        {
            Icon = LoadIcon(),
            Text = "ProxyMockTool",
            Visible = true,
            ContextMenuStrip = menu
        };
        _icon.DoubleClick += (_, _) => OpenUi();
        _icon.BalloonTipClicked += (_, _) => OpenUi();

        Application.ApplicationExit += (_, _) => _controller?.Dispose();
        ThreadPool.QueueUserWorkItem(_ => StartServices());
    }

    public static void OpenUi()
    {
        Process.Start(new ProcessStartInfo(ServiceController.UiUrl) { UseShellExecute = true });
    }

    private static Icon LoadIcon()
    {
        var process = Environment.ProcessPath;
        if (!string.IsNullOrWhiteSpace(process))
        {
            try
            {
                var icon = Icon.ExtractAssociatedIcon(process);
                if (icon is not null)
                {
                    return icon;
                }
            }
            catch (ArgumentException)
            {
            }
        }

        var file = Path.Combine(AppContext.BaseDirectory, "icon.ico");
        return File.Exists(file) ? new Icon(file) : SystemIcons.Application;
    }

    private ToolStripMenuItem Item(string text, Action action) =>
        new(text, null, (_, _) => Run(text, action));

    private void StartServices()
    {
        if (_controller is null)
        {
            SetStatus("Could not find the ProxyMockTool repo (API + frontend).");
            _icon.ShowBalloonTip(8000, "ProxyMockTool", "Could not find src/ProxyMockTool.Api and frontend. Run this from the repository.", ToolTipIcon.Error);
            return;
        }

        Run("Start", () =>
        {
            _controller.StartAll(SetStatus);
            SetStatus("API and admin UI are running");
            _icon.ShowBalloonTip(4000, "ProxyMockTool", "Admin UI is ready. Click to open it.", ToolTipIcon.Info);
        });
    }

    private void OnDevServerToggled()
    {
        var controller = _controller;
        if (controller is null)
        {
            return;
        }

        controller.UseDevServer = _devUi.Checked;

        // Apply immediately when we own a running frontend; otherwise it takes effect on the next start.
        if (_busy || !controller.OwnsFrontend || !controller.UiRunning)
        {
            RefreshStatus();
            return;
        }

        Run("Restart frontend", () => controller.RestartFrontend(SetStatus));
    }

    private void Run(string title, Action action)
    {
        if (_busy)
        {
            return;
        }

        _busy = true;
        RefreshMenu();
        ThreadPool.QueueUserWorkItem(_ =>
        {
            try
            {
                action();
                RefreshStatus();
            }
            catch (Exception exception)
            {
                SetStatus(exception.Message);
                _icon.ShowBalloonTip(8000, title, exception.Message, ToolTipIcon.Error);
            }
            finally
            {
                _busy = false;
                RefreshMenu();
            }
        });
    }

    private void RefreshStatus()
    {
        if (_controller is null)
        {
            return;
        }

        var api = _controller.ApiRunning ? (_controller.OwnsApi ? "backend running" : "backend running (external)") : "backend stopped";
        string ui;
        if (!_controller.UiRunning)
        {
            ui = "frontend stopped";
        }
        else if (!_controller.OwnsFrontend)
        {
            ui = "frontend running (external)";
        }
        else
        {
            ui = _controller.UseDevServer ? "frontend running (dev)" : "frontend running";
        }

        SetStatus($"{api}; {ui}");
    }

    private void RefreshMenu()
    {
        void Apply()
        {
            var controller = _controller;
            var ready = controller is not null && !_busy;
            _startApi.Enabled = ready && controller is { ApiRunning: false };
            _stopApi.Enabled = ready && controller is { OwnsApi: true };
            _restartApi.Enabled = ready && controller is { OwnsApi: true };
            _rebuildApi.Enabled = ready;
            _startUi.Enabled = ready && controller is { UiRunning: false };
            _stopUi.Enabled = ready && controller is { OwnsFrontend: true };
            _restartUi.Enabled = ready && controller is { OwnsFrontend: true };
            _rebuildUi.Enabled = ready;
            _restartAll.Enabled = ready && controller is { OwnsApi: true, OwnsFrontend: true };
            _devUi.Enabled = ready;
        }

        InvokeOnMenu(Apply);
    }

    private void SetStatus(string text)
    {
        void Apply()
        {
            _statusItem.Text = text.Length <= 80 ? text : text[..77] + "…";
            _icon.Text = text.Length <= 63 ? $"ProxyMockTool — {text}" : "ProxyMockTool";
        }

        InvokeOnMenu(Apply);
    }

    private void InvokeOnMenu(Action action)
    {
        var menu = _icon.ContextMenuStrip;
        if (menu is { IsHandleCreated: true } && menu.InvokeRequired)
        {
            menu.BeginInvoke(action);
        }
        else
        {
            action();
        }
    }

    private void Exit()
    {
        _icon.Visible = false;
        _controller?.Dispose();
        _icon.Dispose();
        ExitThread();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _icon.Visible = false;
            _controller?.Dispose();
            _icon.Dispose();
        }

        base.Dispose(disposing);
    }
}
