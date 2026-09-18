export function statusClass(status?: number | null): string {
  if (!status) {
    return "badge-status-none";
  }
  if (status >= 200 && status < 300) {
    return "badge-status-2xx";
  }
  if (status >= 300 && status < 400) {
    return "badge-status-3xx";
  }
  if (status >= 400 && status < 500) {
    return "badge-status-4xx";
  }
  if (status >= 500 && status < 600) {
    return "badge-status-5xx";
  }
  return "badge-status-none";
}

export function modeClass(mode: string): string {
  if (mode === "mock") {
    return "badge-mode-mock";
  }
  if (mode === "manual") {
    return "badge-mode-manual";
  }
  return "badge-mode-passthrough";
}

export const timelineSeries = [
  { key: "status2xx", label: "2xx", color: "var(--log-status-2xx)" },
  { key: "status3xx", label: "3xx", color: "var(--log-status-3xx)" },
  { key: "status4xx", label: "4xx", color: "var(--log-status-4xx)" },
  { key: "status5xx", label: "5xx", color: "var(--log-status-5xx)" },
  { key: "otherCount", label: "Other", color: "var(--log-status-other)" },
  { key: "mockCount", label: "Mock", color: "var(--log-mode-mock)" },
  { key: "manualCount", label: "Manual", color: "var(--log-mode-manual)" },
] as const;

export type TimelineSeriesKey = (typeof timelineSeries)[number]["key"];

export function statusColor(status?: number | null): string {
  if (!status) {
    return "default";
  }
  if (status >= 200 && status < 300) {
    return "green";
  }
  if (status >= 300 && status < 400) {
    return "gold";
  }
  if (status >= 400 && status < 500) {
    return "orange";
  }
  if (status >= 500 && status < 600) {
    return "red";
  }
  return "default";
}

export function modeColor(mode: string): string {
  if (mode === "mock") {
    return "blue";
  }
  if (mode === "manual") {
    return "purple";
  }
  return "default";
}

export function protocolColor(protocol: string): string {
  switch (protocol) {
    case "soap":
      return "gold";
    case "json":
      return "blue";
    case "xml":
      return "cyan";
    default:
      return "default";
  }
}

