import { modeClass } from "../logColors";
import { modeBadge } from "../modeBadge";
import type { MockDto } from "../store/types";
import { HoverTip } from "./HoverTip";

export function LogModeBadge({
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
  const openableMock = mock && onOpenMock ? mock : undefined;
  const badge = (
    <span
      className={`badge ${modeClass(mode)}${openableMock ? " log-mode-badge-link" : ""}`}
      role={openableMock ? "button" : undefined}
      onClick={
        openableMock
          ? (event) => {
              event.stopPropagation();
              onOpenMock?.(openableMock);
            }
          : undefined
      }
    >
      {modeBadge(mode).label}
    </span>
  );

  if (!mockName) {
    return badge;
  }

  return (
    <HoverTip
      className="log-mode-hover"
      content={
        openableMock ? (
          <button
            type="button"
            className="btn btn-link p-0 align-baseline"
            onClick={(event) => {
              event.stopPropagation();
              onOpenMock?.(openableMock);
            }}
          >
            {mockName}
          </button>
        ) : (
          mockName
        )
      }
    >
      {badge}
    </HoverTip>
  );
}
