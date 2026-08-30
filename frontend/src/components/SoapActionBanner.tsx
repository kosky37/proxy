import type { LogListItemDto } from "../store/types";
import { CopyButton } from "./CopyButton";

export function soapActionText(action?: string | null) {
  return action?.trim() || "no SOAPAction";
}

export function LogRequestLine({
  item,
  showSoapAction = false,
}: {
  item: Pick<
    LogListItemDto,
    "protocol" | "method" | "path" | "query" | "soapAction"
  >;
  showSoapAction?: boolean;
}) {
  if (item.protocol === "soap") {
    const action = soapActionText(item.soapAction);
    return (
      <div>
        <span className="text-break">
          <strong>{item.method}</strong> {item.path}
          {item.query ? (
            <span className="text-secondary">?{item.query}</span>
          ) : null}
        </span>{" "}
        {showSoapAction && (
          <>
            <br />
            <span className="text-break text-info-emphasis">{action}</span>{" "}
            <CopyButton value={item.soapAction ?? ""} label="Copy SOAPAction" />
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <span className="text-break">
        <strong>{item.method}</strong> {item.path}
        {item.query ? (
          <span className="text-secondary">?{item.query}</span>
        ) : null}
      </span>
    </div>
  );
}

export function SoapActionTitle({ action }: { action?: string | null }) {
  const value = action?.trim();
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <span className="text-break">{soapActionText(action)}</span>
      {value ? <CopyButton value={value} label="Copy SOAPAction" /> : null}
    </span>
  );
}
