export function protocolBadge(protocol: string): { bg: string; label: string; text?: "dark" } {
  switch (protocol) {
    case "soap":
      return { bg: "warning", label: "SOAP", text: "dark" };
    case "json":
      return { bg: "primary", label: "JSON" };
    case "xml":
      return { bg: "info", label: "XML" };
    default:
      return { bg: "secondary", label: "Other" };
  }
}
