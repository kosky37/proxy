import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const SHOW_DELAY_MS = 450;
const HIDE_DELAY_MS = 350;
const VIEW_MARGIN = 8;
const CURSOR_GAP = 10;
const CURSOR_ALIGN = 12;

export function HoverTip({
  content,
  onlyIfClipped = false,
  className,
  children,
}: {
  content: ReactNode;
  onlyIfClipped?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef(0);
  const hideTimer = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const tipId = useId();

  const clearTimers = useCallback(() => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
    showTimer.current = 0;
    hideTimer.current = 0;
  }, []);

  const isClipped = useCallback(() => {
    const el = triggerRef.current;
    if (!el) {
      return false;
    }
    return el.scrollWidth - el.clientWidth > 1 || el.scrollHeight - el.clientHeight > 1;
  }, []);

  const rememberPointer = useCallback((event: MouseEvent) => {
    pointer.current = { x: event.clientX, y: event.clientY };
  }, []);

  const updatePosition = useCallback(() => {
    const tip = tipRef.current;
    if (!tip) {
      return;
    }
    const tipRect = tip.getBoundingClientRect();
    const { x, y } = pointer.current;
    let left = x - CURSOR_ALIGN;
    if (left + tipRect.width > window.innerWidth - VIEW_MARGIN) {
      left = window.innerWidth - tipRect.width - VIEW_MARGIN;
    }
    left = Math.max(VIEW_MARGIN, left);

    const below = y + CURSOR_GAP;
    const above = y - CURSOR_GAP - tipRect.height;
    const placeBelow =
      below + tipRect.height <= window.innerHeight - VIEW_MARGIN || above < VIEW_MARGIN;
    const top = placeBelow
      ? Math.min(below, window.innerHeight - tipRect.height - VIEW_MARGIN)
      : Math.max(VIEW_MARGIN, above);
    setPlacement(placeBelow ? "below" : "above");
    setCoords({ top: Math.max(VIEW_MARGIN, top), left });
  }, []);

  const scheduleShow = useCallback(() => {
    if (onlyIfClipped && !isClipped()) {
      return;
    }
    window.clearTimeout(hideTimer.current);
    hideTimer.current = 0;
    if (open) {
      return;
    }
    window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => {
      setCoords({
        top: pointer.current.y + CURSOR_GAP,
        left: Math.max(VIEW_MARGIN, pointer.current.x - CURSOR_ALIGN),
      });
      setPlacement("below");
      setOpen(true);
    }, SHOW_DELAY_MS);
  }, [isClipped, onlyIfClipped, open]);

  const scheduleHide = useCallback(() => {
    window.clearTimeout(showTimer.current);
    showTimer.current = 0;
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setOpen(false), HIDE_DELAY_MS);
  }, []);

  const hideNow = useCallback(() => {
    clearTimers();
    setOpen(false);
  }, [clearTimers]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updatePosition();
  }, [open, content, updatePosition]);

  useEffect(() => {
    const onScrollAway = () => hideNow();
    window.addEventListener("scroll", onScrollAway, true);
    if (!open) {
      return () => window.removeEventListener("scroll", onScrollAway, true);
    }
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", onScrollAway, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [hideNow, open, updatePosition]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (onlyIfClipped && open && !isClipped()) {
      setOpen(false);
    }
  }, [isClipped, onlyIfClipped, open]);

  return (
    <>
      <span
        ref={triggerRef}
        className={className}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={(event) => {
          rememberPointer(event);
          scheduleShow();
        }}
        onMouseMove={rememberPointer}
        onMouseLeave={scheduleHide}
      >
        {children}
      </span>
      {open
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              className={`hover-tip hover-tip-${placement}`}
              style={{ top: coords.top, left: coords.left }}
              onMouseEnter={scheduleShow}
              onMouseLeave={scheduleHide}
              onClick={(event) => event.stopPropagation()}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
