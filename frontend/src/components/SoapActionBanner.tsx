import type { LogListItemDto } from "../store/types";
import { ClipText } from "./ClipText";
import { CopyButton } from "./CopyButton";

export function soapActionText(action?: string | null) {
  return action?.trim() || "no SOAPAction";
}

export function LogRequestLine({
  item,
  showSoapAction = false,
  showMethod = true,
  clip = false,
}: {
  item: Pick<LogListItemDto, "protocol" | "method" | "path" | "query" | "soapAction">;
  showSoapAction?: boolean;
  showMethod?: boolean;
  clip?: boolean;
}) {
  const pathText = `${item.path}${item.query ? `?${item.query}` : ""}`;
  const full = showMethod ? `${item.method} ${pathText}` : pathText;
  const path = (
    <>
      {showMethod ? <strong>{item.method} </strong> : null}
      {item.path}
      {item.query ? <span className="text-secondary">?{item.query}</span> : null}
    </>
  );
  const request = clip ? (
    <ClipText text={full} tooltip={path}>
      {path}
    </ClipText>
  ) : (
    <span className="text-break">{path}</span>
  );

  if (item.protocol === "soap") {
    const action = soapActionText(item.soapAction);
    return (
      <div>
        {request}{" "}
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

  return <div>{request}</div>;
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
