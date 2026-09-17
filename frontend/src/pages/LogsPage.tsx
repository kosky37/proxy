import { skipToken } from '@reduxjs/toolkit/query/react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Col, Collapse, Form, Row, Stack, Table } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import { ClipText } from '../components/ClipText'
import { LogDetailModal } from '../components/LogDetailModal'
import { LogModeBadge } from '../components/LogModeBadge'
import { LogTimeline } from '../components/LogTimeline'
import { ProxyLogFilter } from '../components/ProxyLogFilter'
import { LogRequestLine } from '../components/SoapActionBanner'
import { formatBytes, formatDate, formatDateTime, formatTime, logWindow, type LogWindowPreset } from '../format'
import { statusClass } from '../logColors'
import { protocolBadge } from '../protocolBadge'
import {
  useGetGlobalLogTimelineQuery,
  useGetGlobalLogsQuery,
  useGetLogQuery,
  useGetMocksQuery,
  useGetProxiesQuery,
} from '../store/proxyApi'
import type { LogListItemDto, MockDto } from '../store/types'

const PAGE_SIZE = 50
const PRESETS: Exclude<LogWindowPreset, 'all'>[] = ['1h', '6h', '24h', '7d']
const frozenQuery = { refetchOnFocus: false, refetchOnReconnect: false } as const

export function LogsPage() {
  const navigate = useNavigate()
  const proxies = useGetProxiesQuery()
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null)
  const [windowEnd, setWindowEnd] = useState(() => Date.now())
  const [preset, setPreset] = useState<Exclude<LogWindowPreset, 'all'>>('24h')
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [page, setPage] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [filter, setFilter] = useState({ path: '', soapAction: '', body: '', mode: '', protocol: '' })
  const [openLog, setOpenLog] = useState<{ proxyId: string; entryId: number } | null>(null)

  useEffect(() => {
    if (proxies.data && selectedIds === null) {
      setSelectedIds(proxies.data.map((proxy) => proxy.id))
    }
  }, [proxies.data, selectedIds])

  const proxyIds = selectedIds ?? []
  const windowRange = useMemo(() => logWindow(preset, windowEnd), [preset, windowEnd])
  const listRange = range ?? windowRange
  const queryFilter = useMemo(
    () => ({
      path: filter.path || undefined,
      soapAction: filter.soapAction || undefined,
      body: filter.body || undefined,
      mode: filter.mode || undefined,
      protocol: filter.protocol || undefined,
    }),
    [filter],
  )
  const activeFilterCount = Object.values(queryFilter).filter(Boolean).length
  const canQuery = proxyIds.length > 0 && Boolean(listRange.from && listRange.to)

  const timeline = useGetGlobalLogTimelineQuery(
    { proxyIds, ...windowRange, buckets: 80 },
    { skip: !canQuery, ...frozenQuery },
  )
  const logs = useGetGlobalLogsQuery(
    {
      proxyIds,
      ...queryFilter,
      from: listRange.from,
      to: listRange.to,
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    },
    { skip: !canQuery, ...frozenQuery },
  )
  const logDetail = useGetLogQuery(
    { proxyId: openLog?.proxyId ?? '', entryId: openLog?.entryId ?? 0 },
    { skip: openLog == null },
  )

  const openMocks = useGetMocksQuery(openLog?.proxyId ?? skipToken, frozenQuery)

  const existingLogMock = useMemo(() => {
    if (!openLog || !logDetail.data?.mockName) {
      return undefined
    }
    const name = logDetail.data.mockName.toLowerCase()
    return openMocks.data?.find((mock) => mock.name.toLowerCase() === name)
  }, [openLog, logDetail.data, openMocks.data])

  const openMockInProxy = (proxyId: string, mock: MockDto) => {
    setOpenLog(null)
    navigate(`/proxies/${proxyId}`, { state: { openMock: mock } })
  }

  const total = logs.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1
  const showingTo = Math.min(total, page * PAGE_SIZE + (logs.data?.items.length ?? 0))

  const toggleProxy = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const ids = current ?? []
      return checked ? [...ids, id] : ids.filter((item) => item !== id)
    })
    setPage(0)
  }

  const setPresetWindow = (next: Exclude<LogWindowPreset, 'all'>) => {
    setPreset(next)
    setWindowEnd(Date.now())
    setRange(null)
    setPage(0)
  }

  return (
    <>
      <Stack direction="horizontal" className="mb-3 align-items-start">
        <div>
          <h1 className="h3 mb-0">Logs</h1>
          <div>Compare requests across proxies in one shared time window. This page does not live-refresh.</div>
        </div>
        <Button className="ms-auto" variant="outline-secondary" onClick={() => setPresetWindow(preset)}>
          Reload window
        </Button>
      </Stack>

      <ProxyLogFilter
        proxies={proxies.data ?? []}
        selectedIds={proxyIds}
        onToggle={toggleProxy}
        onSelectIds={(ids) => {
          setSelectedIds(ids)
          setPage(0)
        }}
      />

      <div className="log-timeline-card mb-3">
        <Stack direction="horizontal" className="mb-2 flex-wrap gap-2 align-items-center">
          <strong>Timeline</strong>
          <span className="row-meta">Drag across the graph to inspect a time range</span>
          <div className="ms-auto d-flex flex-wrap gap-1">
            {PRESETS.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={preset === item && !range ? 'primary' : preset === item ? 'outline-primary' : 'outline-secondary'}
                onClick={() => setPresetWindow(item)}
              >
                {item}
              </Button>
            ))}
          </div>
        </Stack>
        {canQuery && timeline.data ? (
          <LogTimeline
            fromUtc={timeline.data.fromUtc}
            toUtc={timeline.data.toUtc}
            bucketSeconds={timeline.data.bucketSeconds}
            buckets={timeline.data.buckets}
            selection={range}
            onSelect={(from, to) => {
              setRange({ from, to })
              setPage(0)
            }}
          />
        ) : (
          <div className="row-meta">{canQuery ? 'Loading timeline…' : 'Select at least one proxy.'}</div>
        )}
        <div className="row-meta mt-2">
          Showing {formatDateTime(listRange.from ?? '')} – {formatDateTime(listRange.to ?? '')}
        </div>
      </div>

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
              setFilter({ path: '', soapAction: '', body: '', mode: '', protocol: '' })
              setPage(0)
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
                      setFilter({ ...filter, path: event.target.value })
                      setPage(0)
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
                      setFilter({ ...filter, soapAction: event.target.value })
                      setPage(0)
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
                      setFilter({ ...filter, body: event.target.value })
                      setPage(0)
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
                      setFilter({ ...filter, mode: event.target.value })
                      setPage(0)
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
                      setFilter({ ...filter, protocol: event.target.value })
                      setPage(0)
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

      <Stack direction="horizontal" className="mb-2 flex-wrap gap-2 align-items-center">
        <div className="row-meta">
          Showing {showingFrom}–{showingTo} of {total}
        </div>
        <div className="ms-auto d-flex gap-2 align-items-center">
          <Button size="sm" variant="outline-secondary" disabled={page <= 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
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
      </Stack>

      <Table striped hover responsive size="sm" className="align-middle logs-table">
        <colgroup>
          <col className="col-proxy" />
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
            <th>Proxy</th>
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
            <tr
              key={`${item.proxyId}-${item.id}`}
              role="button"
              onClick={() => item.proxyId && setOpenLog({ proxyId: item.proxyId, entryId: item.id })}
            >
              <td>
                <ClipText
                  text={item.proxyName || item.proxyId || ''}
                  tooltip={
                    <Link to={`/proxies/${item.proxyId}`} onClick={(event) => event.stopPropagation()}>
                      {item.proxyName || item.proxyId}
                    </Link>
                  }
                >
                  <Link to={`/proxies/${item.proxyId}`} onClick={(event) => event.stopPropagation()}>
                    {item.proxyName || item.proxyId}
                  </Link>
                </ClipText>
              </td>
              <td>
                <strong>{item.method}</strong>
              </td>
              <td>
                <LogRequestLine item={item} clip showMethod={false} />
                <div className="row-meta">
                  {item.contentType || 'no content-type'}
                  {' · '}
                  {formatBytes(item.requestBytes, item.requestBodyTruncated)}
                  {' → '}
                  {formatBytes(item.responseBytes, item.responseBodyTruncated)}
                </div>
              </td>
              <td>
                {item.protocol === 'soap' && item.soapAction ? <ClipText text={item.soapAction} /> : null}
              </td>
              <td>
                <Badge bg={protocolBadge(item.protocol).bg} text={protocolBadge(item.protocol).text}>
                  {protocolBadge(item.protocol).label}
                </Badge>
              </td>
              <td>
                <LogModeCell item={item} onOpenMock={(row, mock) => row.proxyId && openMockInProxy(row.proxyId, mock)} />
              </td>
              <td>
                <span className={`badge ${statusClass(item.statusCode)}`}>{item.statusCode ?? '-'}</span>
              </td>
              <td>
                <div>{formatTime(item.timestampUtc)}</div>
                <div className="row-meta">
                  {formatDate(item.timestampUtc)} · {item.durationMs} ms
                </div>
              </td>
            </tr>
          ))}
          {(!logs.data || logs.data.items.length === 0) && (
            <tr>
              <td colSpan={8}>{canQuery ? 'No logs in this range.' : 'Select at least one proxy.'}</td>
            </tr>
          )}
        </tbody>
      </Table>

      <LogDetailModal
        show={openLog != null}
        log={
          logDetail.data && openLog
            ? { ...logDetail.data, proxyId: openLog.proxyId, proxyName: proxies.data?.find((item) => item.id === openLog.proxyId)?.name }
            : null
        }
        existingMock={existingLogMock}
        onClose={() => setOpenLog(null)}
        onOpenMock={(mock) => {
          if (openLog?.proxyId) {
            openMockInProxy(openLog.proxyId, mock)
          }
        }}
        onCreateMock={(log) => {
          if (!log.proxyId) {
            return
          }
          setOpenLog(null)
          navigate(`/proxies/${log.proxyId}`, { state: { fromLog: { action: 'mock', log } } })
        }}
        onCreateSend={(log) => {
          if (!log.proxyId) {
            return
          }
          setOpenLog(null)
          navigate(`/proxies/${log.proxyId}`, { state: { fromLog: { action: 'send', log } } })
        }}
      />
    </>
  )
}

function LogModeCell({
  item,
  onOpenMock,
}: {
  item: LogListItemDto
  onOpenMock: (item: LogListItemDto, mock: MockDto) => void
}) {
  const mocks = useGetMocksQuery(item.mockName ? (item.proxyId ?? skipToken) : skipToken, frozenQuery)
  const mock = item.mockName
    ? mocks.data?.find((entry) => entry.name.toLowerCase() === item.mockName?.toLowerCase())
    : undefined

  return (
    <LogModeBadge
      mode={item.mode}
      mockName={item.mockName}
      mock={mock}
      onOpenMock={mock ? (entry) => onOpenMock(item, entry) : undefined}
    />
  )
}
