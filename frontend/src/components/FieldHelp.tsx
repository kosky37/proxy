import { InfoCircleOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import type { TooltipPlacement } from "antd/es/tooltip";
import { useCallback, useRef, useState, type ReactNode, type SyntheticEvent } from "react";

export interface HelpPoint {
  label?: string;
  text?: string;
  code?: string;
  note?: string;
}

export interface HelpDoc {
  summary?: string;
  points?: HelpPoint[];
  note?: string;
}

export type HelpContent = string | HelpDoc;

export const pathModeHelp: HelpDoc = {
  summary: "How the request path is compared with the mock path.",
  points: [
    {
      label: "Exact",
      text: "Only this path matches.",
      code: "/accounts matches /accounts, not /accounts/1",
    },
    {
      label: "Prefix",
      text: "This path and everything under it matches.",
      code: "/accounts matches /accounts/1",
    },
    {
      label: "Template",
      text: "Each {name} stands for exactly one path segment.",
      code: "/accounts/{id} matches /accounts/42",
      note: "but not /accounts/42/orders",
    },
  ],
};

const HOST_ID = "app-tooltip-host";

const TOOLTIP_OPEN_DELAY = 0.3;

const VALUE_TOOLTIP_ALIGN = { overflow: { adjustX: false, adjustY: true, shiftX: true } };

export function tooltipHost(): HTMLElement {
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    return existing;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);
  return host;
}

function inline(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .filter((part) => part !== "")
    .map((part, index) => {
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
        return <code key={index}>{part.slice(1, -1)}</code>;
      }

      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }

      return part;
    });
}

function Prose({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length === 0) {
      return;
    }

    blocks.push(
      <ul key={`list-${blocks.length}`} className="app-help-list">
        {bullets.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }

    if (line.startsWith("- ")) {
      bullets.push(line.slice(2));
      continue;
    }

    flush();
    blocks.push(<p key={`text-${blocks.length}`}>{inline(line)}</p>);
  }
  flush();

  return <>{blocks}</>;
}

export function HelpBody({ help }: { help: HelpContent }) {
  if (typeof help === "string") {
    return (
      <div className="app-help">
        <Prose text={help} />
      </div>
    );
  }

  return (
    <div className="app-help">
      {help.summary ? (
        <p className="app-help-summary">{inline(help.summary)}</p>
      ) : null}
      {help.points && help.points.length > 0 ? (
        <ul className="app-help-list">
          {help.points.map((point, index) => (
            <li key={index}>
              {point.label ? <strong className="app-help-term">{point.label}</strong> : null}
              {point.text ? <span className="app-help-text">{inline(point.text)}</span> : null}
              {point.code ? <code className="app-help-code">{point.code}</code> : null}
              {point.note ? <span className="app-help-gloss">{inline(point.note)}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {help.note ? <p className="app-help-gloss">{inline(help.note)}</p> : null}
    </div>
  );
}

export function HelpTooltip({
  help,
  children,
  placement = "top",
}: {
  help: HelpContent;
  children: ReactNode;
  placement?: TooltipPlacement;
}) {
  return (
    <Tooltip
      title={<HelpBody help={help} />}
      placement={placement}
      getPopupContainer={tooltipHost}
      classNames={{ root: "app-tooltip" }}
      mouseEnterDelay={TOOLTIP_OPEN_DELAY}
    >
      {children}
    </Tooltip>
  );
}

export function FieldHelp({
  text,
  placement = "top",
}: {
  text: HelpContent;
  placement?: TooltipPlacement;
}) {
  return (
    <HelpTooltip help={text} placement={placement}>
      <InfoCircleOutlined className="app-help-icon" tabIndex={0} aria-label="More information" />
    </HelpTooltip>
  );
}

export function ValueTooltip({
  value,
  children,
  className = "app-cell-tight",
  placement = "topLeft",
}: {
  value: ReactNode;
  children: ReactNode;
  className?: string;
  placement?: TooltipPlacement;
}) {
  const [clipped, setClipped] = useState(false);
  const detachRef = useRef<(() => void) | null>(null);

  const attach = useCallback((element: HTMLSpanElement | null) => {
    detachRef.current?.();
    detachRef.current = null;
    if (!element) {
      return;
    }

    const measure = () => setClipped(element.scrollWidth > element.clientWidth + 1);
    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(element, { characterData: true, childList: true, subtree: true });

    detachRef.current = () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  const trigger = (
    <span ref={attach} className={className}>
      {children}
    </span>
  );

  if (!clipped) {
    return trigger;
  }

  return (
    <Tooltip
      title={
        <div
          className="app-value-tip"
          onMouseDown={stopPropagation}
          onMouseUp={stopPropagation}
          onClick={stopPropagation}
          onDoubleClick={stopPropagation}
          onContextMenu={stopPropagation}
          onPointerDown={stopPropagation}
          onPointerUp={stopPropagation}
        >
          {value}
        </div>
      }
      placement={placement}
      align={VALUE_TOOLTIP_ALIGN}
      getPopupContainer={tooltipHost}
      classNames={{ root: "app-tooltip app-tooltip-value" }}
      mouseEnterDelay={TOOLTIP_OPEN_DELAY}
      mouseLeaveDelay={0.25}
    >
      {trigger}
    </Tooltip>
  );
}

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

export function FieldLabel({
  children,
  help,
  placement = "top",
}: {
  children: ReactNode;
  help: HelpContent;
  placement?: TooltipPlacement;
}) {
  return (
    <span className="app-row" style={{ gap: 6 }}>
      <span>{children}</span>
      <FieldHelp text={help} placement={placement} />
    </span>
  );
}
