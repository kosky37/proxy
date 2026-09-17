import type { ReactNode } from "react";
import { HoverTip } from "./HoverTip";

export function ClipText({
  text,
  tooltip,
  children,
}: {
  text: string;
  tooltip?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <HoverTip onlyIfClipped className="clip-text" content={tooltip ?? text}>
      {children ?? text}
    </HoverTip>
  );
}
