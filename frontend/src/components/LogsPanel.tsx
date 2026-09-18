import { ClearOutlined, PauseCircleOutlined, PlayCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Progress,
  Segmented,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { memo, useEffect, useMemo, useState } from "react";
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatTime,
  logWindow,
  type LogWindowPreset,
} from "../format";
import { statusColor } from "../logColors";
import { logSortFromSorter, logSorter, logSortParams, type LogSort, type LogSortField } from "../logSort";
import {
  useClearLogsMutation,
  useGetLogStorageQuery,
  useGetLogsQuery,
  useGetLogTimelineQuery,
} from "../store/proxyApi";
import type { LogListItemDto, MockDto } from "../store/types";
import { LogModeTag, LogRequestLine, ProtocolTag } from "./LogBits";
import { ValueTooltip } from "./FieldHelp";
import { LogPagination } from "./LogPagination";
import { LogTimeline } from "./LogTimeline";
import { activeFilterCount, emptyLogFilter, ProxyLogFilter, type LogFilter } from "./ProxyLogFilter";

const PAGE_SIZE = 50;
const REFRESH_STORAGE_KEY = "proxy-log-refresh-ms";
const REFRESH_OPTIONS = [
  { label: "1s", value: 1_000 },
  { label: "2s", value: 2_000 },
  { label: "5s", value: 5_000 },
  { label: "10s", value: 10_000 },
  { label: "30s", value: 30_000 },
];
const PRESETS: LogWindowPreset[] = ["1h", "6h", "24h", "7d", "all"];

function readRefreshMs() {
  const raw = Number(window.localStorage.getItem(REFRESH_STORAGE_KEY));
  return REFRESH_OPTIONS.some((option) => option.value === raw) ? raw : 2_000;
}

interface Props {
  proxyId: string;
  active: boolean;
  mocks: MockDto[];
  onOpenLog: (id: number) => void;
  onOpenMock: (mock: MockDto) => void;
}

const frozenQuery = { refetchOnFocus: false, refetchOnReconnect: false } as const;

const NextRefresh = memo(function NextRefresh({
  refreshMs,
  fulfilledAt,
  fetching,
}: {
  refreshMs: number;
  fulfilledAt?: number;
  fetching: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = fulfilledAt ? now - fulfilledAt : 0;
  const percent = fetching
    ? 100
    : Math.min(100, Math.max(0, (elapsed / Math.max(refreshMs, 1)) * 100));

  return (
    <Tooltip title={`Auto-refresh every ${(refreshMs / 1000).toFixed(0)}s`}>
      <Progress
        type="circle"
        size={18}
        strokeWidth={3}
        percent={percent}
        showInfo={false}
        status={fetching ? "active" : "normal"}
        aria-label="Time until the next log refresh"
      />
    </Tooltip>
  );
});

export const LogsPanel = memo(function LogsPanel({
  proxyId,
  active,
  mocks,
  onOpenLog,
  onOpenMock,
}: Props) {
  const { modal, message } = App.useApp();
  const [paused, setPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [refreshMs, setRefreshMs] = useState(readRefreshMs);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<LogSort | null>(null);
  const [windowPreset, setWindowPreset] = useState<LogWindowPreset>("24h");
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [filter, setFilter] = useState<LogFilter>(emptyLogFilter);

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
      ...logSortParams(sort),
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

  const applyFilter = (next: LogFilter) => {
    setFilter(next);
    setPage(0);
  };

  const total = logs.data?.total ?? 0;
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

  const resumeLive = () => {
    setPaused(false);
    setPausedAt(null);
    setRange(null);
    setSort(null);
    setPage(0);
  };

  const clear = (selectedRange: boolean) => {
    const label = selectedRange
      ? "Delete logs in the selected time range? This cannot be undone."
      : `Delete all ${storage.data?.entryCount ?? total} log entries? This cannot be undone.`;

    modal.confirm({
      title: selectedRange ? "Clear selected range" : "Clear all logs",
      content: label,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await clearLogs({
            proxyId,
            from: selectedRange ? range?.from : undefined,
            to: selectedRange ? range?.to : undefined,
          }).unwrap();
          message.success(`Deleted ${result.deleted} log entries.`);
          setPage(0);
        } catch {
          message.error("Could not delete the logs.");
        }
      },
    });
  };

  const columns: ColumnsType<LogListItemDto> = useMemo(() => {
    // Live entries are the newest ones only, so sorting is offered while the view is paused.
    const sortable = (field: LogSortField) => (paused ? logSorter(field, sort) : {});
    return [
      {
        title: "Method",
        dataIndex: "method",
        width: 90,
        render: (method: string) => <strong>{method}</strong>,
        ...sortable("method"),
      },
      {
        title: "Request",
        key: "request",
        render: (_value, item) => (
          <div>
            <LogRequestLine item={item} clip showMethod={false} />
            <div className="app-subtle">
              {item.contentType || "no content-type"} ·{" "}
              {formatBytes(item.requestBytes, item.requestBodyTruncated)} →{" "}
              {formatBytes(item.responseBytes, item.responseBodyTruncated)}
            </div>
          </div>
        ),
        ...sortable("path"),
      },
      {
        title: "SOAPAction",
        dataIndex: "soapAction",
        render: (action: string | null, item) =>
          item.protocol === "soap" && action ? (
            <ValueTooltip value={action}>{action}</ValueTooltip>
          ) : null,
      },
      {
        title: "Type",
        dataIndex: "protocol",
        width: 80,
        render: (protocol: string) => <ProtocolTag protocol={protocol} />,
        ...sortable("protocol"),
      },
      {
        title: "Mode",
        dataIndex: "mode",
        width: 120,
        render: (mode: string, item) => (
          <LogModeTag
            mode={mode}
            mockName={item.mockName}
            mock={mocks.find((entry) => entry.name.toLowerCase() === item.mockName?.toLowerCase())}
            onOpenMock={onOpenMock}
          />
        ),
        ...sortable("mode"),
      },
      {
        title: "Status",
        dataIndex: "statusCode",
        width: 80,
        render: (status: number | null) => <Tag color={statusColor(status)}>{status ?? "-"}</Tag>,
        ...sortable("status"),
      },
      {
        title: "Time",
        dataIndex: "timestampUtc",
        width: 140,
        render: (value: string, item) => (
          <div>
            <div>{formatTime(value)}</div>
            <div className="app-subtle">
              {formatDate(value)} · {item.durationMs} ms
            </div>
          </div>
        ),
        ...sortable("time"),
      },
    ];
  }, [mocks, onOpenMock, paused, sort]);

  return (
    <>
      <div className="app-log-toolbar">
        <div>
          <div style={{ fontWeight: 600 }}>Database {formatBytes(storage.data?.totalBytes)}</div>
          <div className="app-subtle">{storage.data?.entryCount ?? 0} entries on disk</div>
        </div>
        <Tag color={paused ? "orange" : "green"}>{paused ? "Paused" : "Live"}</Tag>
        <div className="app-log-toolbar-actions">
          <span className="app-row" style={{ gap: 8 }}>
            <span className="app-subtle">Refresh every</span>
            <Select
              size="small"
              style={{ width: 80 }}
              value={refreshMs}
              aria-label="Log refresh interval"
              onChange={setRefreshMs}
              options={REFRESH_OPTIONS}
            />
          </span>
          {!paused && (
            <NextRefresh
              refreshMs={refreshMs}
              fulfilledAt={liveLogs.fulfilledTimeStamp}
              fetching={liveLogs.isFetching}
            />
          )}
          {paused ? (
            <Button size="small" icon={<PlayCircleOutlined />} onClick={resumeLive}>
              Resume live
            </Button>
          ) : (
            <Button size="small" icon={<PauseCircleOutlined />} onClick={pauseUpdates}>
              Pause
            </Button>
          )}
          <Button size="small" icon={<ReloadOutlined />} onClick={() => void logs.refetch()}>
            Reload
          </Button>
          {range && (
            <Button
              size="small"
              danger
              icon={<ClearOutlined />}
              disabled={clearState.isLoading}
              onClick={() => clear(true)}
            >
              Clear selection
            </Button>
          )}
          <Button
            size="small"
            danger
            icon={<ClearOutlined />}
            disabled={clearState.isLoading}
            onClick={() => clear(false)}
          >
            Clear all logs
          </Button>
        </div>
      </div>

      {paused && (
        <div className="log-timeline-card" style={{ marginBottom: 12 }}>
          <div className="app-row" style={{ gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <strong>Timeline</strong>
            <span className="app-subtle">Drag across the graph to inspect a time range</span>
            <div style={{ marginLeft: "auto" }}>
              <Segmented
                size="small"
                value={windowPreset}
                options={PRESETS.map((preset) => ({
                  value: preset,
                  label: preset === "all" ? "All" : preset,
                }))}
                onChange={(value) => {
                  setWindowPreset(value as LogWindowPreset);
                  setRange(null);
                  setPage(0);
                }}
              />
            </div>
          </div>
          {timeline.data ? (
            <LogTimeline
              fromUtc={timeline.data.fromUtc}
              toUtc={timeline.data.toUtc}
              bucketSeconds={timeline.data.bucketSeconds}
              buckets={timeline.data.buckets}
              selection={range}
              onSelect={(from, to) => {
                setRange({ from, to });
                setPage(0);
              }}
            />
          ) : (
            <div className="app-subtle">Loading timeline…</div>
          )}
          {range && (
            <div className="app-subtle" style={{ marginTop: 8 }}>
              Showing {formatDateTime(range.from)} – {formatDateTime(range.to)}
            </div>
          )}
        </div>
      )}

      {paused && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Updates are paused"
          description="Browse history with the timeline, column sorting, and pagination, or resume to follow the latest entries."
        />
      )}

      <ProxyLogFilter
        filter={filter}
        onChange={applyFilter}
        onClear={() => applyFilter(emptyLogFilter)}
      />

      <div className="app-log-pager">
        <div className="app-subtle">
          {paused
            ? `Showing ${showingFrom}–${showingTo} of ${total}`
            : `Showing latest ${logs.data?.items.length ?? 0} of ${total}`}
          {activeFilterCount(filter) > 0 ? " (filtered)" : ""}
        </div>
        {paused ? (
          <LogPagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        ) : null}
      </div>

      <Table<LogListItemDto>
        rowKey="id"
        size="small"
        className="logs-table"
        loading={logs.isLoading}
        columns={columns}
        dataSource={logs.data?.items ?? []}
        pagination={false}
        tableLayout="fixed"
        onChange={(_pagination, _filters, sorter) => {
          setSort(logSortFromSorter(sorter));
          setPage(0);
        }}
        onRow={(item) => ({
          onClick: () => onOpenLog(item.id),
          style: { cursor: "pointer" },
        })}
        locale={{
          emptyText: paused ? "No logs in this range." : "No logs yet.",
        }}
      />

      {paused ? (
        <div className="app-log-pager app-log-pager-bottom">
          <LogPagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      ) : null}

      {!paused && total > 0 && (
        <Typography.Text className="app-subtle">
          Pause the live view to browse older entries, sort by column, and select a time range.
        </Typography.Text>
      )}
    </>
  );
});
