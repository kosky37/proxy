import { ApiOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { Badge, Button, Layout as AntLayout, Menu } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useGetHealthQuery } from "../store/proxyApi";
import { useAppTheme } from "../themeContext";
import { HelpTooltip } from "./FieldHelp";

const NAV_ITEMS = [
  { key: "/", label: "Proxies" },
  { key: "/certificates", label: "Certificates" },
  { key: "/logs", label: "Logs" },
];

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const health = useGetHealthQuery();
  const { theme, toggleTheme } = useAppTheme();

  const selectedKey = NAV_ITEMS.map((item) => item.key)
    .filter((key) => key !== "/" && location.pathname.startsWith(key))
    .at(0) ?? "/";

  const online = health.data?.status === "ok";

  return (
    <AntLayout style={{ minHeight: "100vh", background: "var(--app-bg)" }}>
      <AntLayout.Header className="app-header">
        <div className="app-header-brand">
          <img src="/favicon.svg" alt="" className="app-logo" />
          <span>ProxyMockTool</span>
        </div>
        <Menu
          className="app-header-nav"
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS}
          onClick={({ key }) => navigate(key)}
        />
        <div className="app-header-tools">
          <HelpTooltip
            help={
              online
                ? "API reachable on port 5050."
                : "API not reachable — start the host or the API project."
            }
          >
            <Badge
              status={online ? "success" : "default"}
              text={
                <span className="app-inline-row">
                  <ApiOutlined />
                  API {health.data?.status ?? "offline"}
                </span>
              }
            />
          </HelpTooltip>
          <HelpTooltip help={theme === "light" ? "Switch to dark mode." : "Switch to light mode."}>
            <Button
              size="small"
              type="text"
              aria-label="Toggle colour theme"
              icon={theme === "light" ? <MoonOutlined /> : <SunOutlined />}
              onClick={toggleTheme}
            />
          </HelpTooltip>
        </div>
      </AntLayout.Header>
      <AntLayout.Content className="app-content">
        <Outlet />
      </AntLayout.Content>
    </AntLayout>
  );
}
