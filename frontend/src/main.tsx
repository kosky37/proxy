import { App as AntApp, ConfigProvider, theme as antdTheme } from "antd";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App.tsx";
import { store } from "./store/store";
import { AppThemeProvider, useAppTheme } from "./themeContext";
import "./index.css";

function ThemedApp() {
  const { theme } = useAppTheme();

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          borderRadius: 6,
          fontSize: 14,
          colorPrimary: "#0d6efd",
        },
        components: {
          Layout: { headerHeight: 56 },
          Table: { cellPaddingBlockSM: 6 },
        },
      }}
    >
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <AppThemeProvider>
        <ThemedApp />
      </AppThemeProvider>
    </Provider>
  </StrictMode>,
);
