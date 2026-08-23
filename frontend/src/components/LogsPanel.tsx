import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Col, Form, Row, Stack, Table } from 'react-bootstrap'
import { formatBytes } from '../format'
import { modeBadge } from '../modeBadge'
import {
  useClearLogsMutation,
  useGetLogStorageQuery,
  useGetLogsQuery,
  useGetLogTimelineQuery,
} from '../store/proxyApi'
import type { MockDto } from '../store/types'
import { LogTimeline } from './LogTimeline'

const PAGE_SIZE = 50

type WindowPreset = '1h' | '6h' | '24h' | '7d' | 'all'

interface Props {
  proxyId: string
  active: boolean
  mocks: MockDto[]
  onOpenLog: (id: number) => void
  onOpenMock: (mock: MockDto) => void
  onPausedChange?: (paused: boolean) => void
}

const frozenQuery = { refetchOnFocus: false, refetchOnReconnect: false } as const

export function LogsPanel({ proxyId, active, mocks, onOpenLog, onOpenMock, onPausedChange }: Props) {
  const [paused, setPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [windowPreset, setWindowPreset] = useState<WindowPreset>('24h')
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [filter, setFilter] = useState({ path: '', mode: '', protocol: '' })
  const windowRange = useMemo(
    () => timelineWindow(windowPreset, pausedAt ?? Date.now()),
    [windowPreset, pausedAt],
  )

  const liveStorage = useGetLogStorageQuery(proxyId, {
    skip: !active || !proxyId || paused,
    pollingInterval: 2000,
  })
  const pausedStorage = useGetLogStorageQuery(proxyId, {
    skip: !active || !proxyId || !paused,
    ...frozenQuery,
  })
  const storage = paused ? pausedStorage : liveStorage

  const timeline = useGetLogTimelineQuery(
    { proxyId, ...windowRange, buckets: 80 },
    { skip: !active || !paused || !proxyId, ...frozenQuery },
  )
  const liveLogs = useGetLogsQuery(
    { proxyId, ...filter, take: PAGE_SIZE },
    { skip: !active || !proxyId || paused, pollingInterval: 2000 },
  )
  const pausedLogs = useGetLogsQuery(
    {
      proxyId,
      ...filter,
      from: range?.from,
      to: range?.to,
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    },
    { skip: !active || !proxyId || !paused, ...frozenQuery },
  )
  const logs = paused ? pausedLogs : liveLogs
  const [clearLogs, clearState] = useClearLogsMutation()

  useEffect(() => {
    onPausedChange?.(paused)
    return () => onPausedChange?.(false)
  }, [paused, onPausedChange])

  const total = logs.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const showingFrom = total === 0 ? 0 : (paused ? page * PAGE_SIZE : 0) + 1
  const showingTo = Math.min(total, (paused ? page * PAGE_SIZE : 0) + (logs.data?.items.length ?? 0))

  const pauseUpdates = () => {
    setPaused(true)
    setPausedAt(Date.now())
    setPage(0)
    onPausedChange?.(true)
  }

  const selectRange = (from: string, to: string) => {
    setRange({ from, to })
    setPage(0)
    if (!paused) {
      pauseUpdates()
    }
  }

  const resumeLive = () => {
    setPaused(false)
    setPausedAt(null)
    setRange(null)
    setPage(0)
    onPausedChange?.(false)
  }

  const clear = async (selected: boolean) => {
    const label = selected
      ? 'Delete logs in the selected time range? This cannot be undone.'
      : `Delete all ${storage.data?.entryCount ?? total} log entries? This cannot be undone.`
    if (!window.confirm(label)) {
      return
    }

    await clearLogs({
      proxyId,
      from: selected ? range?.from : undefined,
      to: selected ? range?.to : undefined,
    }).unwrap()
    setPage(0)
  }

  return (
    <>
      <Stack direction="horizontal" className="mb-3 flex-wrap gap-2 align-items-center">
        <div>
          <div className="fw-semibold">
            Database {formatBytes(storage.data?.totalBytes)}
            {storage.data && storage.data.walBytes > 0 && (
              <span className="row-meta">
                {' '}
                ({formatBytes(storage.data.databaseBytes)} + {formatBytes(storage.data.walBytes)} WAL)
              </span>
            )}
          </div>
          <div className="row-meta">{storage.data?.entryCount ?? 0} entries on disk</div>
        </div>
        <Badge bg={paused ? 'warning' : 'success'} text={paused ? 'dark' : undefined} className="ms-2">
          {paused ? 'Paused' : 'Live'}
        </Badge>
        <div className="ms-auto d-flex flex-wrap gap-2">
          {paused ? (
            <Button variant="outline-success" size="sm" onClick={resumeLive}>
              Resume live
            </Button>
          ) : (
            <Button variant="outline-secondary" size="sm" onClick={pauseUpdates}>
              Pause
            </Button>
          )}
          {range && (
            <Button variant="outline-danger" size="sm" disabled={clearState.isLoading} onClick={() => clear(true)}>
              Clear selection
            </Button>
          )}
          <Button variant="outline-danger" size="sm" disabled={clearState.isLoading} onClick={() => clear(false)}>
            Clear all logs
          </Button>
        </div>
      </Stack>

      {paused && (
        <div className="log-timeline-card mb-3">
          <Stack direction="horizontal" className="mb-2 flex-wrap gap-2 align-items-center">
            <strong>Timeline</strong>
            <span className="row-meta">Drag across the graph to inspect a time range</span>
            <div className="ms-auto d-flex flex-wrap gap-1">
              {(['1h', '6h', '24h', '7d', 'all'] as WindowPreset[]).map((preset) => (
                <Button
                  key={preset}
                  size="sm"
                  variant={windowPreset === preset ? 'primary' : 'outline-secondary'}
                  onClick={() => setWindowPreset(preset)}
                >
                  {preset === 'all' ? 'All' : preset}
                </Button>
              ))}
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
              Showing {new Date(range.from).toLocaleString()} – {new Date(range.to).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {paused && (
        <Alert variant="secondary">
          Updates are paused. Browse history with the timeline and pagination, or resume to follow the latest entries.
        </Alert>
      )}

      <Row className="g-2 mb-3">
        <Col md={4}>
          <Form.Control
            placeholder="Path contains"
            value={filter.path}
            onChange={(event) => {
              setFilter({ ...filter, path: event.target.value })
              setPage(0)
            }}
          />
        </Col>
        <Col md={3}>
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
        </Col>
        <Col md={3}>
          <Form.Select
            value={filter.protocol}
            onChange={(event) => {
              setFilter({ ...filter, protocol: event.target.value })
              setPage(0)
            }}
          >
            <option value="">Any protocol</option>
            <option value="rest">rest</option>
            <option value="soap">soap</option>
          </Form.Select>
        </Col>
      </Row>

      <Stack direction="horizontal" className="mb-2 flex-wrap gap-2 align-items-center">
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

      <Table striped hover responsive size="sm" className="align-middle">
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Mode</th>
            <th>Request</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.data?.items.map((item) => (
            <tr key={item.id} role="button" onClick={() => onOpenLog(item.id)}>
              <td>
                <div>{new Date(item.timestampUtc).toLocaleString()}</div>
                <div className="row-meta">{item.durationMs} ms</div>
              </td>
              <td>
                <Badge bg={item.protocol === 'soap' ? 'warning' : 'primary'} text={item.protocol === 'soap' ? 'dark' : undefined}>
                  {item.protocol === 'soap' ? 'SOAP' : 'REST'}
                </Badge>
                {item.protocol === 'soap' && <div className="row-meta">{item.soapAction || 'no SOAPAction'}</div>}
              </td>
              <td>
                <Badge bg={modeBadge(item.mode).bg}>{modeBadge(item.mode).label}</Badge>
                {item.mockName && (
                  <div>
                    {mocks.some((mock) => mock.name.toLowerCase() === item.mockName?.toLowerCase()) ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0"
                        onClick={(event) => {
                          event.stopPropagation()
                          const mock = mocks.find((entry) => entry.name.toLowerCase() === item.mockName?.toLowerCase())
                          if (mock) {
                            onOpenMock(mock)
                          }
                        }}
                      >
                        {item.mockName}
                      </Button>
                    ) : (
                      <span className="row-meta">{item.mockName}</span>
                    )}
                  </div>
                )}
              </td>
              <td>
                <div>
                  <strong>{item.method}</strong> {item.path}
                  {item.query && <span className="text-secondary">?{item.query}</span>}
                </div>
                <div className="row-meta">
                  {item.contentType || 'no content-type'}
                  {' · '}
                  {formatBytes(item.requestBytes, item.requestBodyTruncated)}
                  {' → '}
                  {formatBytes(item.responseBytes, item.responseBodyTruncated)}
                </div>
              </td>
              <td>{item.statusCode ?? '-'}</td>
            </tr>
          ))}
          {logs.data?.items.length === 0 && (
            <tr>
              <td colSpan={5}>{paused ? 'No logs in this range.' : 'No logs yet.'}</td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  )
}

function timelineWindow(preset: WindowPreset, nowMs: number): { from?: string; to?: string } {
  if (preset === 'all') {
    return {}
  }

  const to = new Date(nowMs)
  const from = new Date(to)
  if (preset === '1h') {
    from.setHours(from.getHours() - 1)
  } else if (preset === '6h') {
    from.setHours(from.getHours() - 6)
  } else if (preset === '7d') {
    from.setDate(from.getDate() - 7)
  } else {
    from.setDate(from.getDate() - 1)
  }

  return { from: from.toISOString(), to: to.toISOString() }
}
