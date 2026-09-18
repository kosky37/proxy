import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxy = {
  "/api": "http://127.0.0.1:5050",
  "/swagger": "http://127.0.0.1:5050",
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.*.tmpdir/**",
      ],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
});
