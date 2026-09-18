import { Tag, Typography } from "antd";
import { modeColor, protocolColor } from "../logColors";
import { modeBadge } from "../modeBadge";
import { protocolBadge } from "../protocolBadge";
import { soapActionText } from "../soapActionText";
import type { LogListItemDto, MockDto } from "../store/types";
import { CopyButton } from "./CopyButton";
import { HelpTooltip, ValueTooltip } from "./FieldHelp";

export function ProtocolTag({ protocol }: { protocol: string }) {
  const badge = protocolBadge(protocol);
  return <Tag color={protocolColor(protocol)}>{badge.label}</Tag>;
}

export function LogModeTag({
  mode,
  mockName,
  mock,
  onOpenMock,
}: {
  mode: string;
  mockName?: string | null;
  mock?: MockDto;
  onOpenMock?: (mock: MockDto) => void;
}) {
  const canOpen = Boolean(mock && onOpenMock);
  const tag = (
    <Tag
      color={modeColor(mode)}
      style={canOpen ? { cursor: "pointer" } : undefined}
      onClick={
        canOpen
          ? (event) => {
              event.stopPropagation();
              onOpenMock?.(mock as MockDto);
            }
          : undefined
      }
    >
      {modeBadge(mode).label}
    </Tag>
  );

  if (!mockName) {
    return tag;
  }

  return (
    <HelpTooltip
      help={{
        summary: `Answered by mock \`${mockName}\``,
        note: canOpen ? "Click the tag to open the mock in its proxy." : undefined,
      }}
    >
      {tag}
    </HelpTooltip>
  );
}

export function LogRequestLine({
  item,
  showMethod = true,
  clip = false,
}: {
  item: Pick<LogListItemDto, "protocol" | "method" | "path" | "query" | "soapAction">;
  showMethod?: boolean;
  clip?: boolean;
}) {
  const action = soapActionText(item.soapAction);

  const content = (
    <span className="app-break">
      {showMethod ? <Typography.Text strong>{item.method} </Typography.Text> : null}
      {item.path}
      {item.query ? <span className="app-subtle">?{item.query}</span> : null}
    </span>
  );

  const tooltip = (
    <>
      {showMethod ? <strong>{item.method} </strong> : null}
      {item.path}
      {item.query ? <span className="app-value-query">?{item.query}</span> : null}
    </>
  );

  const soapLine = item.protocol === "soap" && (
    <div className="app-row" style={{ gap: 4, minWidth: 0 }}>
      <span className="app-cell-tight app-subtle">SOAPAction: {action}</span>
      {item.soapAction ? <CopyButton value={item.soapAction} label="Copy SOAPAction" /> : null}
    </div>
  );

  if (!clip) {
    return (
      <div style={{ minWidth: 0, maxWidth: "100%" }}>
        {content}
        {soapLine}
      </div>
    );
  }

  return (
    <div style={{ minWidth: 0, maxWidth: "100%" }}>
      <ValueTooltip value={tooltip}>{content}</ValueTooltip>
      {soapLine}
    </div>
  );
}
