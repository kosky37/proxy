# Admin UI

React + Ant Design single-page app for ProxyMockTool. It talks to the API on
`http://127.0.0.1:5050` through the Vite dev-server proxy and is served on
`http://127.0.0.1:5173`, the port the desktop host opens.

## Commands

```powershell
npm install                        # dependencies
npm run dev                        # dev server on 127.0.0.1:5173
npm run build                      # tsc -b && vite build
npm run lint                       # oxlint
```

## Layout

- `src/store/` — RTK Query API and DTOs.
- Framework-free modules: `format.ts`, `headers.ts`, `parseBody.ts`,
  `logColors.ts`, `modeBadge.ts`, `protocolBadge.ts`, `mockFromLog.ts`,
  `looksLikeHtml.ts`, `theme.ts`.
- `src/components/` — reusable pieces; the timeline is an interactive SVG styled
  with the CSS variables in `index.css` so it follows the app theme.
- `src/pages/` — Proxies, Proxy detail (Logs / Mock sets / REST mocks / SOAP mocks
  / Ignores / Send), Logs, Certificates.
