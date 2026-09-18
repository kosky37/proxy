import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate, formatDateTime, formatTime } from "../format";
import { timelineSeries, type TimelineSeriesKey } from "../logColors";
import type { LogTimelineBucketDto } from "../store/types";

interface Props {
  fromUtc: string;
  toUtc: string;
  bucketSeconds: number;
  buckets: LogTimelineBucketDto[];
  selection?: { from: string; to: string } | null;
  onSelect: (from: string, to: string) => void;
}

const HEIGHT = 96;
const PADDING = { left: 8, right: 8, top: 10, bottom: 22 };
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TICK_STEPS = [
  SECOND,
  2 * SECOND,
  5 * SECOND,
  10 * SECOND,
  15 * SECOND,
  30 * SECOND,
  MINUTE,
  2 * MINUTE,
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  4 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
];

export function LogTimeline({
  fromUtc,
  toUtc,
  bucketSeconds,
  buckets,
  selection,
  onSelect,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(640);
  const [drag, setDrag] = useState<{ start: number; current: number } | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  useEffect(() => {
    const element = svgRef.current;
    if (!element) {
      return;
    }

    const frame = () => setWidth(element.clientWidth || 640);
    frame();
    const observer = new ResizeObserver(frame);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const from = Date.parse(fromUtc);
  const to = Date.parse(toUtc);
  const plotWidth = Math.max(width - PADDING.left - PADDING.right, 1);
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const barWidth = buckets.length === 0 ? plotWidth : plotWidth / buckets.length;

  const timeToX = (iso: string) => {
    const ratio = (Date.parse(iso) - from) / Math.max(to - from, 1);
    return PADDING.left + Math.min(1, Math.max(0, ratio)) * plotWidth;
  };

  const xToTime = (x: number) => {
    const ratio = Math.min(1, Math.max(0, (x - PADDING.left) / plotWidth));
    return new Date(from + ratio * Math.max(to - from, 1)).toISOString();
  };

  const clientX = (event: { clientX: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return event.clientX - (rect?.left ?? 0);
  };

  const finishSelection = (startX: number, endX: number) => {
    if (Math.abs(endX - startX) < 4) {
      const index = Math.min(
        buckets.length - 1,
        Math.max(0, Math.floor((endX - PADDING.left) / barWidth)),
      );
      const bucket = buckets[index];
      if (!bucket) {
        return;
      }

      const start = Date.parse(bucket.startUtc);
      onSelect(bucket.startUtc, new Date(start + bucketSeconds * 1000).toISOString());
      return;
    }

    const left = Math.min(startX, endX);
    const right = Math.max(startX, endX);
    onSelect(xToTime(left), xToTime(right));
  };

  useEffect(() => {
    if (!drag) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      const x = clientX(event);
      setHoverX(x);
      setDrag((current) => (current ? { ...current, current: x } : current));
    };
    const onUp = (event: MouseEvent) => {
      finishSelection(drag.start, clientX(event));
      setDrag(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, buckets, bucketSeconds, from, to, plotWidth]);

  const overlay = drag
    ? { left: Math.min(drag.start, drag.current), right: Math.max(drag.start, drag.current) }
    : selection
      ? { left: timeToX(selection.from), right: timeToX(selection.to) }
      : null;
  const markerX =
    hoverX == null ? null : Math.min(PADDING.left + plotWidth, Math.max(PADDING.left, hoverX));
  const hoverTime = markerX == null ? null : xToTime(markerX);
  const labelShift =
    markerX == null ? 0 : Math.min(1, Math.max(0, (markerX - PADDING.left) / plotWidth)) * 100;
  const ticks = useMemo(
    () => timeTicks(from, to, Math.max(3, Math.min(8, Math.floor(plotWidth / 88)))),
    [from, to, plotWidth],
  );

  return (
    <div className="log-timeline-wrap">
      {hoverTime && markerX != null && (
        <div className="log-timeline-hover-label-track">
          <div
            className="log-timeline-hover-label"
            style={{ left: markerX, transform: `translateX(-${labelShift}%)` }}
          >
            {formatDateTime(hoverTime)}
          </div>
        </div>
      )}
      <svg
        ref={svgRef}
        className="log-timeline"
        height={HEIGHT}
        width="100%"
        role="img"
        aria-label="Log timeline"
        onMouseDown={(event) => {
          event.preventDefault();
          const x = clientX(event);
          setHoverX(x);
          setDrag({ start: x, current: x });
        }}
        onMouseMove={(event) => {
          if (!drag) {
            setHoverX(clientX(event));
          }
        }}
        onMouseLeave={() => {
          if (!drag) {
            setHoverX(null);
          }
        }}
      >
        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={plotWidth}
          height={plotHeight}
          className="log-timeline-plot"
        />
        {ticks.map((tick) => {
          const x = PADDING.left + ((tick.at - from) / Math.max(to - from, 1)) * plotWidth;
          const edge = 36;
          const anchor =
            x < PADDING.left + edge ? "start" : x > width - PADDING.right - edge ? "end" : "middle";
          return (
            <g key={tick.at}>
              <line
                className="log-timeline-tick"
                x1={x}
                x2={x}
                y1={PADDING.top}
                y2={PADDING.top + plotHeight}
              />
              <text className="log-timeline-axis" x={x} y={HEIGHT - 6} textAnchor={anchor}>
                {tick.label}
              </text>
            </g>
          );
        })}
        {buckets.map((bucket, index) => {
          const x = PADDING.left + index * barWidth + 0.5;
          const width = Math.max(barWidth - 1, 0.5);
          let y = PADDING.top + plotHeight;
          return (
            <g key={`${bucket.startUtc}-${index}`}>
              {timelineSeries.map((series) => {
                const value = bucket[series.key as TimelineSeriesKey] ?? 0;
                const height = (value / max) * plotHeight;
                if (height <= 0) {
                  return null;
                }

                y -= height;
                return (
                  <rect
                    key={series.key}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={series.color}
                  />
                );
              })}
              <title>
                {tooltip(bucket)} at {formatDateTime(bucket.startUtc)}
              </title>
            </g>
          );
        })}
        {overlay && (
          <rect
            className="log-timeline-selection"
            x={overlay.left}
            y={PADDING.top}
            width={Math.max(overlay.right - overlay.left, 1)}
            height={plotHeight}
          />
        )}
        {markerX != null && (
          <line
            className="log-timeline-hover"
            x1={markerX}
            x2={markerX}
            y1={PADDING.top}
            y2={PADDING.top + plotHeight}
          />
        )}
      </svg>
      <div className="log-timeline-legend">
        {timelineSeries.map((series) => (
          <span key={series.key}>
            <span className="log-timeline-swatch" style={{ background: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function timeTicks(fromMs: number, toMs: number, maxTicks: number) {
  const duration = Math.max(toMs - fromMs, 1);
  const stepMs =
    TICK_STEPS.find((step) => duration / step <= maxTicks) ?? TICK_STEPS[TICK_STEPS.length - 1];
  const ticks: { at: number; label: string }[] = [];
  let at = alignUp(fromMs, stepMs);
  if (at - fromMs < stepMs * 0.15) {
    at = addStep(at, stepMs);
  }
  while (at < toMs - stepMs * 0.15) {
    ticks.push({ at, label: formatTick(at, stepMs, duration) });
    at = addStep(at, stepMs);
  }
  return ticks;
}

function alignUp(ms: number, stepMs: number) {
  const date = new Date(ms);
  if (stepMs >= DAY && stepMs % DAY === 0) {
    date.setHours(0, 0, 0, 0);
    if (date.getTime() < ms) {
      date.setDate(date.getDate() + 1);
    }
    return date.getTime();
  }

  if (stepMs >= HOUR && stepMs % HOUR === 0) {
    const hours = stepMs / HOUR;
    date.setMinutes(0, 0, 0);
    let hour = Math.ceil(date.getHours() / hours) * hours;
    if (hour === date.getHours() && date.getTime() < ms) {
      hour += hours;
    }
    date.setHours(hour, 0, 0, 0);
    return date.getTime();
  }

  const midnight = new Date(ms);
  midnight.setHours(0, 0, 0, 0);
  const offset = ms - midnight.getTime();
  return midnight.getTime() + Math.ceil(offset / stepMs) * stepMs;
}

function addStep(ms: number, stepMs: number) {
  if (stepMs >= DAY && stepMs % DAY === 0) {
    const date = new Date(ms);
    date.setDate(date.getDate() + stepMs / DAY);
    return date.getTime();
  }

  if (stepMs >= HOUR && stepMs % HOUR === 0) {
    const date = new Date(ms);
    date.setHours(date.getHours() + stepMs / HOUR);
    return date.getTime();
  }

  return ms + stepMs;
}

function formatTick(ms: number, stepMs: number, durationMs: number) {
  if (stepMs >= DAY) {
    return formatDate(ms);
  }

  const time =
    stepMs >= MINUTE
      ? new Date(ms).toLocaleTimeString("pl-PL", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : formatTime(ms);
  if (durationMs >= DAY) {
    const date = new Date(ms);
    if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
      return formatDate(ms);
    }
  }

  return time;
}

function tooltip(bucket: LogTimelineBucketDto): string {
  const parts = timelineSeries
    .map((series) => {
      const value = bucket[series.key as TimelineSeriesKey] ?? 0;
      return value > 0 ? `${series.label} ${value}` : null;
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "0";
}
