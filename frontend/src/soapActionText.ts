export function soapActionText(action?: string | null) {
  return action?.trim() || "no SOAPAction";
}
