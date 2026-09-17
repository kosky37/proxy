import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Col,
  Collapse,
  Form,
  Row,
  Stack,
  Table,
} from "react-bootstrap";
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatTime,
  logWindow,
  type LogWindowPreset,
} from "../format";
import { statusClass } from "../logColors";
import { protocolBadge } from "../protocolBadge";
import {
  useClearLogsMutation,
  useGetLogStorageQuery,
  useGetLogsQuery,
  useGetLogTimelineQuery,
} from "../store/proxyApi";
import type { MockDto } from "../store/types";
import { ClipText } from "./ClipText";
import { LogModeBadge } from "./LogModeBadge";
import { LogTimeline } from "./LogTimeline";
import { LogRequestLine } from "./SoapActionBanner";

const PAGE_SIZE = 50;
const REFRESH_STORAGE_KEY = "proxy-log-refresh-ms";
const REFRESH_OPTIONS = [
  { label: "1s", ms: 1_000 },
  { label: "2s", ms: 2_000 },
  { label: "5s", ms: 5_000 },
  { label: "10s", ms: 10_000 },
  { label: "30s", ms: 30_000 },
] as const;

type WindowPreset = LogWindowPreset;

function readRefreshMs() {
  const raw = Number(window.localStorage.getItem(REFRESH_STORAGE_KEY));
  return REFRESH_OPTIONS.some((option) => option.ms === raw) ? raw : 2_000;
}

interface Props {
  proxyId: string;
  active: boolean;
  mocks: MockDto[];
  onOpenLog: (id: number) => void;
  onOpenMock: (mock: MockDto) => void;
}

const frozenQuery = {
  refetchOnFocus: false,
  refetchOnReconnect: false,
} as const;

export function LogsPanel({
  proxyId,
  active,
  mocks,
  onOpenLog,
  onOpenMock,
}: Props) {
  const [paused, setPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [refreshMs, setRefreshMs] = useState(readRefreshMs);
  const [now, setNow] = useState(() => Date.now());
  const [page, setPage] = useState(0);
  const [windowPreset, setWindowPreset] = useState<WindowPreset>("24h");
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filter, setFilter] = useState({
    path: "",
    soapAction: "",
    body: "",
    mode: "",
    protocol: "",
  });
  const queryFilter = useMemo(
    () => ({
      path: filter.path || undefined,
      soapAction: filter.soapAction || undefined,
      body: filter.body || undefined,
      mode: filter.mode || undefined,
      protocol: filter.protocol || undefined,
    }),
    [filter],
  );
  const activeFilterCount = Object.values(queryFilter).filter(Boolean).length;
  const windowRange = useMemo(
    () => logWindow(windowPreset, pausedAt ?? Date.now()),
    [windowPreset, pausedAt],
  );

  const storage = useGetLogStorageQuery(proxyId, {
    skip: !active || !proxyId,
    pollingInterval: 60_000,
  });

  const timeline = useGetLogTimelineQuery(
    { proxyId, ...windowRange, buckets: 80 },
    { skip: !active || !paused || !proxyId, ...frozenQuery },
  );
  const liveLogs = useGetLogsQuery(
    { proxyId, ...queryFilter, take: PAGE_SIZE },
    { skip: !active || !proxyId || paused, pollingInterval: refreshMs },
  );
  const pausedLogs = useGetLogsQuery(
    {
      proxyId,
      ...queryFilter,
      from: range?.from,
      to: range?.to,
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    },
    { skip: !active || !proxyId || !paused, ...frozenQuery },
  );
  const logs = paused ? pausedLogs : liveLogs;
  const [clearLogs, clearState] = useClearLogsMutation();

  useEffect(() => {
    window.localStorage.setItem(REFRESH_STORAGE_KEY, String(refreshMs));
  }, [refreshMs]);

  useEffect(() => {
    if (!active || paused) {
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [active, paused]);

  const nextRefreshMs = Math.max(
    0,
    refreshMs - (now - (liveLogs.fulfilledTimeStamp ?? now)),
  );

  const total = logs.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : (paused ? page * PAGE_SIZE : 0) + 1;
  const showingTo = Math.min(
    total,
    (paused ? page * PAGE_SIZE : 0) + (logs.data?.items.length ?? 0),
  );

  const pauseUpdates = () => {
    setPaused(true);
    setPausedAt(Date.now());
    setPage(0);
  };

  const selectRange = (from: string, to: string) => {
    setRange({ from, to });
    setPage(0);
    if (!paused) {
      pauseUpdates();
    }
  };

  const resumeLive = () => {
    setPaused(false);
    setPausedAt(null);
    setRange(null);
    setPage(0);
  };

  const clear = async (selected: boolean) => {
    const label = selected
      ? "Delete logs in the selected time range? This cannot be undone."
      : `Delete all ${storage.data?.entryCount ?? total} log entries? This cannot be undone.`;
    if (!window.confirm(label)) {
      return;
    }

    await clearLogs({
      proxyId,
      from: selected ? range?.from : undefined,
      to: selected ? range?.to : undefined,
    }).unwrap();
    setPage(0);
  };

  return (
    <>
      <Stack
        direction="horizontal"
        className="mb-3 flex-wrap gap-2 align-items-center"
      >
        <div>
          <div className="fw-semibold">
            Database {formatBytes(storage.data?.totalBytes)}
          </div>
          <div className="row-meta">
            {storage.data?.entryCount ?? 0} entries on disk
          </div>
        </div>
        <Badge
          bg={paused ? "warning" : "success"}
          text={paused ? "dark" : undefined}
          className="ms-2"
        >
          {paused ? "Paused" : "Live"}
        </Badge>
        {!paused && (
          <span className="row-meta">
            {liveLogs.isFetching
              ? "Refreshing…"
              : `Next refresh in ${(nextRefreshMs / 1000).toFixed(1)}s`}
          </span>
        )}
        <Form.Group className="d-flex align-items-center gap-2 mb-0">
          <Form.Label className="mb-0 row-meta text-nowrap">Refresh every</Form.Label>
          <Form.Select
            size="sm"
            className="refresh-interval-select"
            value={refreshMs}
            onChange={(event) => setRefreshMs(Number(event.target.value))}
            aria-label="Log refresh interval"
          >
            {REFRESH_OPTIONS.map((option) => (
              <option key={option.ms} value={option.ms}>
                {option.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <div className="ms-auto d-flex flex-wrap gap-2">
          {paused ? (
            <Button variant="outline-success" size="sm" onClick={resumeLive}>
              Resume live
            </Button>
          ) : (
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={pauseUpdates}
            >
              Pause
            </Button>
          )}
          {range && (
            <Button
              variant="outline-danger"
              size="sm"
              disabled={clearState.isLoading}
              onClick={() => clear(true)}
            >
              Clear selection
            </Button>
          )}
          <Button
            variant="outline-danger"
            size="sm"
            disabled={clearState.isLoading}
            onClick={() => clear(false)}
          >
            Clear all logs
          </Button>
        </div>
      </Stack>

      {paused && (
        <div className="log-timeline-card mb-3">
          <Stack
            direction="horizontal"
            className="mb-2 flex-wrap gap-2 align-items-center"
          >
            <strong>Timeline</strong>
            <span className="row-meta">
              Drag across the graph to inspect a time range
            </span>
            <div className="ms-auto d-flex flex-wrap gap-1">
              {(["1h", "6h", "24h", "7d", "all"] as WindowPreset[]).map(
                (preset) => (
                  <Button
                    key={preset}
                    size="sm"
                    variant={
                      windowPreset === preset ? "primary" : "outline-secondary"
                    }
                    onClick={() => setWindowPreset(preset)}
                  >
                    {preset === "all" ? "All" : preset}
                  </Button>
                ),
              )}
            </div>
          </Stack>
          {timeline.data ? (
            <LogTimeline
              fromUtc={timeline.data.fromUtc}
              toUtc={timeline.data.toUtc}
              bucketSeconds={timeline.data.bucketSeconds}
              buckets={timeline.data.buckets}
              selection={range}
              onSelect={selectRange}
            />
          ) : (
            <div className="row-meta">Loading timeline…</div>
          )}
          {range && (
            <div className="row-meta mt-2">
              Showing {formatDateTime(range.from)} – {formatDateTime(range.to)}
            </div>
          )}
        </div>
      )}

      {paused && (
        <Alert variant="secondary">
          Updates are paused. Browse history with the timeline and pagination,
          or resume to follow the latest entries.
        </Alert>
      )}

      <div className="mb-3">
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => setShowFilters((open) => !open)}
          aria-expanded={showFilters}
        >
          Filters
          {activeFilterCount > 0 && (
            <Badge bg="primary" className="ms-2">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setFilter({
                path: "",
                soapAction: "",
                body: "",
                mode: "",
                protocol: "",
              });
              setPage(0);
            }}
          >
            Clear
          </Button>
        )}
        <Collapse in={showFilters}>
          <div className="log-filters mt-3">
            <Row className="g-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Path contains</Form.Label>
                  <Form.Control
                    value={filter.path}
                    onChange={(event) => {
                      setFilter({ ...filter, path: event.target.value });
                      setPage(0);
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>SOAPAction contains</Form.Label>
                  <Form.Control
                    value={filter.soapAction}
                    onChange={(event) => {
                      setFilter({ ...filter, soapAction: event.target.value });
                      setPage(0);
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Body contains</Form.Label>
                  <Form.Control
                    value={filter.body}
                    onChange={(event) => {
                      setFilter({ ...filter, body: event.target.value });
                      setPage(0);
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Mode</Form.Label>
                  <Form.Select
                    value={filter.mode}
                    onChange={(event) => {
                      setFilter({ ...filter, mode: event.target.value });
                      setPage(0);
                    }}
                  >
                    <option value="">Any mode</option>
                    <option value="mock">mock</option>
                    <option value="passthrough">passthrough</option>
                    <option value="manual">manual</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Type</Form.Label>
                  <Form.Select
                    value={filter.protocol}
                    onChange={(event) => {
                      setFilter({ ...filter, protocol: event.target.value });
                      setPage(0);
                    }}
                  >
                    <option value="">Any type</option>
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                    <option value="soap">SOAP</option>
                    <option value="other">Other</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </div>
        </Collapse>
      </div>

      <Stack
        direction="horizontal"
        className="mb-2 flex-wrap gap-2 align-items-center"
      >
        <div className="row-meta">
          {paused
            ? `Showing ${showingFrom}–${showingTo} of ${total}`
            : `Showing latest ${logs.data?.items.length ?? 0} of ${total}`}
        </div>
        {paused && (
          <div className="ms-auto d-flex gap-2 align-items-center">
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={page <= 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <span className="row-meta">
              Page {Math.min(page + 1, pageCount)} of {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Stack>

      <Table striped hover responsive size="sm" className="align-middle logs-table">
        <colgroup>
          <col className="col-method" />
          <col />
          <col className="col-soap" />
          <col className="col-type" />
          <col className="col-mode" />
          <col className="col-status" />
          <col className="col-time" />
        </colgroup>
        <thead>
          <tr>
            <th>Method</th>
            <th>Request</th>
            <th>SOAPAction</th>
            <th>Type</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.data?.items.map((item) => (
            <tr key={item.id} role="button" onClick={() => onOpenLog(item.id)}>
              <td>
                <strong>{item.method}</strong>
              </td>
              <td>
                <LogRequestLine item={item} clip showMethod={false} />
                <div className="row-meta">
                  {item.contentType || "no content-type"}
                  {" · "}
                  {formatBytes(item.requestBytes, item.requestBodyTruncated)}
                  {" → "}
                  {formatBytes(item.responseBytes, item.responseBodyTruncated)}
                </div>
              </td>
              <td>
                {item.protocol === "soap" && item.soapAction ? (
                  <ClipText text={item.soapAction} />
                ) : null}
              </td>
              <td>
                <Badge
                  bg={protocolBadge(item.protocol).bg}
                  text={protocolBadge(item.protocol).text}
                >
                  {protocolBadge(item.protocol).label}
                </Badge>
              </td>
              <td>
                <LogModeBadge
                  mode={item.mode}
                  mockName={item.mockName}
                  mock={mocks.find(
                    (entry) =>
                      entry.name.toLowerCase() === item.mockName?.toLowerCase(),
                  )}
                  onOpenMock={onOpenMock}
                />
              </td>
              <td>
                <span className={`badge ${statusClass(item.statusCode)}`}>
                  {item.statusCode ?? "-"}
                </span>
              </td>
              <td>
                <div>{formatTime(item.timestampUtc)}</div>
                <div className="row-meta">
                  {formatDate(item.timestampUtc)} · {item.durationMs} ms
                </div>
              </td>
            </tr>
          ))}
          {logs.data?.items.length === 0 && (
            <tr>
              <td colSpan={7}>
                {paused ? "No logs in this range." : "No logs yet."}
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
}
