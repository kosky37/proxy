import { ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogDetailModal } from "../components/LogDetailModal";
import { ValueTooltip } from "../components/FieldHelp";
import { LogModeTag, LogRequestLine, ProtocolTag } from "../components/LogBits";
import { LogPagination } from "../components/LogPagination";
import { LogTimeline } from "../components/LogTimeline";
import { PageHeader } from "../components/PageHeader";
import {
  activeFilterCount,
  emptyLogFilter,
  ProxyLogFilter,
  type LogFilter,
} from "../components/ProxyLogFilter";
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatTime,
  logWindow,
  type LogWindowPreset,
} from "../format";
import { statusColor } from "../logColors";
import { logSortFromSorter, logSorter, logSortParams, type LogSort } from "../logSort";
import {
  useGetGlobalLogTimelineQuery,
  useGetGlobalLogsQuery,
  useGetLogQuery,
  useGetMocksQuery,
  useGetProxiesQuery,
} from "../store/proxyApi";
import type { LogListItemDto, MockDto } from "../store/types";

const PAGE_SIZE = 50;
const PRESETS: Exclude<LogWindowPreset, "all">[] = ["1h", "6h", "24h", "7d"];
const frozenQuery = { refetchOnFocus: false, refetchOnReconnect: false } as const;

export function LogsPage() {
  const navigate = useNavigate();
  const proxies = useGetProxiesQuery();
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [windowEnd, setWindowEnd] = useState(() => Date.now());
  const [preset, setPreset] = useState<Exclude<LogWindowPreset, "all">>("24h");
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<LogSort | null>(null);
  const [filter, setFilter] = useState<LogFilter>(emptyLogFilter);
  const [openLog, setOpenLog] = useState<{ proxyId: string; entryId: number } | null>(null);

  const allIds = useMemo(() => (proxies.data ?? []).map((proxy) => proxy.id), [proxies.data]);
  const proxyIds = selectedIds ?? allIds;
  const windowRange = useMemo(() => logWindow(preset, windowEnd), [preset, windowEnd]);
  const listRange = range ?? windowRange;
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
  const canQuery = proxyIds.length > 0 && Boolean(listRange.from && listRange.to);

  const timeline = useGetGlobalLogTimelineQuery(
    { proxyIds, ...windowRange, buckets: 80 },
    { skip: !canQuery, ...frozenQuery },
  );
  const logs = useGetGlobalLogsQuery(
    {
      proxyIds,
      ...queryFilter,
      from: listRange.from,
      to: listRange.to,
      ...logSortParams(sort),
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    },
    { skip: !canQuery, ...frozenQuery },
  );
  const logDetail = useGetLogQuery(
    { proxyId: openLog?.proxyId ?? "", entryId: openLog?.entryId ?? 0 },
    { skip: openLog == null },
  );
  const openMocks = useGetMocksQuery(openLog?.proxyId ?? ("" as unknown as string), {
    skip: openLog == null,
    ...frozenQuery,
  });

  const existingLogMock = useMemo(() => {
    if (!openLog || !logDetail.data?.mockName) {
      return undefined;
    }
    const name = logDetail.data.mockName.toLowerCase();
    return openMocks.data?.find((mock) => mock.name.toLowerCase() === name);
  }, [openLog, logDetail.data, openMocks.data]);

  const modalLog = useMemo(
    () =>
      logDetail.data && openLog
        ? {
            ...logDetail.data,
            proxyId: openLog.proxyId,
            proxyName: proxies.data?.find((item) => item.id === openLog.proxyId)?.name,
          }
        : null,
    [logDetail.data, openLog, proxies.data],
  );

  const openMockInProxy = (proxyId: string, mock: MockDto) => {
    setOpenLog(null);
    navigate(`/proxies/${proxyId}`, { state: { openMock: mock } });
  };

  const total = logs.data?.total ?? 0;
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min(total, page * PAGE_SIZE + (logs.data?.items.length ?? 0));

  const setPresetWindow = (next: Exclude<LogWindowPreset, "all">) => {
    setPreset(next);
    setWindowEnd(Date.now());
    setRange(null);
    setPage(0);
  };

  const columns: ColumnsType<LogListItemDto> = [
    {
      title: "Proxy",
      dataIndex: "proxyName",
      width: 160,
      render: (_value, item) => (
        <Link to={`/proxies/${item.proxyId}`} onClick={(event) => event.stopPropagation()}>
          <span className="app-cell-tight">{item.proxyName || item.proxyId}</span>
        </Link>
      ),
      ...logSorter("proxy", sort),
    },
    {
      title: "Method",
      dataIndex: "method",
      width: 90,
      render: (method: string) => <strong>{method}</strong>,
      ...logSorter("method", sort),
    },
    {
      title: "Request",
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
      ...logSorter("path", sort),
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
      ...logSorter("protocol", sort),
    },
    {
      title: "Mode",
      dataIndex: "mode",
      width: 120,
      render: (_value: string, item) => (
        <LogModeCell
          item={item}
          onOpenMock={(row, mock) => row.proxyId && openMockInProxy(row.proxyId, mock)}
        />
      ),
      ...logSorter("mode", sort),
    },
    {
      title: "Status",
      dataIndex: "statusCode",
      width: 80,
      render: (status: number | null) => <Tag color={statusColor(status)}>{status ?? "-"}</Tag>,
      ...logSorter("status", sort),
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
      ...logSorter("time", sort),
    },
  ];

  return (
    <>
      <PageHeader
        title="Logs"
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => setPresetWindow(preset)}>
            Reload window
          </Button>
        }
      />

      <div className="app-panel" style={{ marginBottom: 12 }}>
        <Row gutter={[16, 8]} align="middle">
          <Col xs={24} md={12}>
            <div className="app-row" style={{ gap: 8 }}>
              <strong>Proxies</strong>
              <Select
                mode="multiple"
                style={{ minWidth: 320, flex: 1 }}
                value={proxyIds}
                placeholder="Select proxies"
                onChange={(ids: string[]) => {
                  setSelectedIds(ids);
                  setPage(0);
                }}
                options={(proxies.data ?? []).map((proxy) => ({
                  value: proxy.id,
                  label: proxy.name,
                }))}
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div className="app-row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <Button size="small" onClick={() => setSelectedIds(allIds)}>
                All
              </Button>
              <Button size="small" onClick={() => setSelectedIds([])}>
                None
              </Button>
              <span className="app-subtle">
                {proxyIds.length} of {allIds.length} selected
              </span>
            </div>
          </Col>
        </Row>
      </div>

      <Card
        size="small"
        style={{ marginBottom: 12 }}
        title={
          <Space size={12} wrap>
            <strong>Timeline</strong>
            <span className="app-subtle">Drag across the graph to inspect a time range</span>
          </Space>
        }
        extra={
          <Segmented
            size="small"
            value={range ? "" : preset}
            options={PRESETS.map((item) => ({ value: item, label: item }))}
            onChange={(value) => setPresetWindow(value as Exclude<LogWindowPreset, "all">)}
          />
        }
      >
        {canQuery && timeline.data ? (
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
          <Typography.Text className="app-subtle">
            {canQuery ? "Loading timeline…" : "Select at least one proxy."}
          </Typography.Text>
        )}
        <div className="app-subtle" style={{ marginTop: 8 }}>
          Showing {formatDateTime(listRange.from ?? "")} – {formatDateTime(listRange.to ?? "")}
          {range ? " (custom range)" : ` (last ${preset})`}
          {range && (
            <Button
              type="link"
              size="small"
              style={{ paddingLeft: 8 }}
              onClick={() => {
                setRange(null);
                setPage(0);
              }}
            >
              Reset to {preset}
            </Button>
          )}
        </div>
      </Card>

      <ProxyLogFilter
        filter={filter}
        onChange={(next) => {
          setFilter(next);
          setPage(0);
        }}
        onClear={() => {
          setFilter(emptyLogFilter);
          setPage(0);
        }}
      />

      <div className="app-log-pager">
        <div className="app-subtle">
          Showing {showingFrom}–{showingTo} of {total}
          {activeFilterCount(filter) > 0 ? " (filtered)" : ""}
        </div>
        <LogPagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {logs.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="Could not load logs"
          description="Is the API running on port 9310?"
        />
      )}

      <Table<LogListItemDto>
        rowKey={(item) => `${item.proxyId}-${item.id}`}
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
          onClick: () => item.proxyId && setOpenLog({ proxyId: item.proxyId, entryId: item.id }),
          style: { cursor: "pointer" },
        })}
        locale={{
          emptyText: canQuery ? "No logs in this range." : "Select at least one proxy.",
        }}
      />

      <div className="app-log-pager app-log-pager-bottom">
        <LogPagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      <LogDetailModal
        open={openLog != null}
        loading={logDetail.isFetching}
        log={modalLog}
        existingMock={existingLogMock}
        onClose={() => setOpenLog(null)}
        onOpenMock={(mock) => {
          if (openLog?.proxyId) {
            openMockInProxy(openLog.proxyId, mock);
          }
        }}
        onCreateMock={(log) => {
          if (!log.proxyId) {
            return;
          }
          setOpenLog(null);
          navigate(`/proxies/${log.proxyId}`, { state: { fromLog: { action: "mock", log } } });
        }}
        onCreateSend={(log) => {
          if (!log.proxyId) {
            return;
          }
          setOpenLog(null);
          navigate(`/proxies/${log.proxyId}`, { state: { fromLog: { action: "send", log } } });
        }}
      />
    </>
  );
}

function LogModeCell({
  item,
  onOpenMock,
}: {
  item: LogListItemDto;
  onOpenMock: (item: LogListItemDto, mock: MockDto) => void;
}) {
  const mocks = useGetMocksQuery(item.mockName ? (item.proxyId ?? "") : "", {
    skip: !item.mockName || !item.proxyId,
    ...frozenQuery,
  });
  const mock = item.mockName
    ? mocks.data?.find((entry) => entry.name.toLowerCase() === item.mockName?.toLowerCase())
    : undefined;

  return (
    <LogModeTag
      mode={item.mode}
      mockName={item.mockName}
      mock={mock}
      onOpenMock={mock ? (entry) => onOpenMock(item, entry) : undefined}
    />
  );
}
