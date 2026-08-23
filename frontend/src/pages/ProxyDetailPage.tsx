import { useEffect, useState, type FormEvent } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Nav,
  OverlayTrigger,
  Row,
  Stack,
  Table,
  Tooltip,
} from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { IgnoreEditor } from '../components/IgnoreEditor'
import { LogDetailModal } from '../components/LogDetailModal'
import { ManualSendPanel } from '../components/ManualSendPanel'
import { MockEditor } from '../components/MockEditor'
import { formatBytes, hasAdvancedMatch } from '../format'
import { mockFromLog } from '../mockFromLog'
import { modeBadge } from '../modeBadge'
import {
  useCreateIgnoreMutation,
  useCreateMockMutation,
  useDeleteIgnoreMutation,
  useDeleteMockMutation,
  useGetCertificatesQuery,
  useGetIgnoresQuery,
  useGetLogQuery,
  useGetLogsQuery,
  useGetMocksQuery,
  useGetProxyQuery,
  useGetStatsQuery,
  useSetMocksEnabledMutation,
  useToggleMockMutation,
  useUpdateIgnoreMutation,
  useUpdateMockMutation,
  useUpdateProxyMutation,
} from '../store/proxyApi'
import type { IgnoredPathDto, LogDetailDto, MockDto, UpsertProxyRequest } from '../store/types'

type Tab = 'settings' | 'send' | 'rest' | 'soap' | 'ignores' | 'logs'

export function ProxyDetailPage() {
  const { id = '' } = useParams()
  const proxy = useGetProxyQuery(id)
  const mocks = useGetMocksQuery(id)
  const ignores = useGetIgnoresQuery(id)
  const certificates = useGetCertificatesQuery()
  const stats = useGetStatsQuery(id)
  const [tab, setTab] = useState<Tab>('settings')
  const [form, setForm] = useState<UpsertProxyRequest | null>(null)
  const [editing, setEditing] = useState<MockDto | null | undefined>(undefined)
  const [editingExisting, setEditingExisting] = useState(false)
  const [editingIgnore, setEditingIgnore] = useState<IgnoredPathDto | null | undefined>(undefined)
  const [logId, setLogId] = useState<number | null>(null)
  const [logFilter, setLogFilter] = useState({ path: '', mode: '', protocol: '' })
  const logs = useGetLogsQuery(
    { proxyId: id, ...logFilter, take: 100 },
    { skip: tab !== 'logs' || !id, pollingInterval: tab === 'logs' ? 2000 : 0 },
  )
  const logDetail = useGetLogQuery({ proxyId: id, entryId: logId ?? 0 }, { skip: logId == null })
  const [updateProxy] = useUpdateProxyMutation()
  const [setMocksEnabled] = useSetMocksEnabledMutation()
  const [createMock] = useCreateMockMutation()
  const [updateMock] = useUpdateMockMutation()
  const [deleteMock] = useDeleteMockMutation()
  const [toggleMock] = useToggleMockMutation()
  const [createIgnore] = useCreateIgnoreMutation()
  const [updateIgnore] = useUpdateIgnoreMutation()
  const [deleteIgnore] = useDeleteIgnoreMutation()
  useEffect(() => {
    if (proxy.data) {
      setForm({
        name: proxy.data.name,
        enabled: proxy.data.enabled,
        listen: proxy.data.listen,
        destination: proxy.data.destination,
        mocksEnabled: proxy.data.mocksEnabled,
        passthroughDelayMs: proxy.data.passthroughDelayMs,
      })
    }
  }, [proxy.data])

  if (proxy.isLoading || !form) {
    return <Alert variant="secondary">Loading…</Alert>
  }
  if (proxy.isError) {
    return <Alert variant="danger">Proxy not found.</Alert>
  }

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault()
    await updateProxy({ id, body: form }).unwrap()
  }

  const saveMock = async (mock: MockDto) => {
    if (editingExisting && editing?.name) {
      await updateMock({ proxyId: id, name: editing.name, body: mock }).unwrap()
    } else {
      await createMock({ proxyId: id, body: mock }).unwrap()
    }
    setEditing(undefined)
  }

  const saveIgnore = async (ignore: IgnoredPathDto) => {
    if (editingIgnore?.name) {
      await updateIgnore({ proxyId: id, name: editingIgnore.name, body: ignore }).unwrap()
    } else {
      await createIgnore({ proxyId: id, body: ignore }).unwrap()
    }
    setEditingIgnore(undefined)
  }

  const openExistingMock = (mock: MockDto) => {
    setEditingExisting(true)
    setEditing(mock)
    setTab(mock.type === 'soap' ? 'soap' : 'rest')
    setLogId(null)
  }

  const createMockFromLog = (log: LogDetailDto) => {
    setEditingExisting(false)
    setEditing(mockFromLog(log))
    setTab(log.protocol === 'soap' ? 'soap' : 'rest')
    setLogId(null)
  }

  const existingLogMock = logDetail.data?.mockName
    ? mocks.data?.find((item) => item.name.toLowerCase() === logDetail.data?.mockName?.toLowerCase())
    : undefined

  const restMocks = mocks.data?.filter((item) => item.type === 'rest') ?? []
  const soapMocks = mocks.data?.filter((item) => item.type === 'soap') ?? []

  return (
    <>
      <Stack direction="horizontal" className="mb-3 align-items-start">
        <div>
          <Link to="/">Proxies</Link>
          <h1 className="h3 mb-0">{proxy.data?.name}</h1>
          <div>{id}</div>
        </div>
        <Form.Check
          type="switch"
          id="mocks-enabled"
          className="ms-auto"
          label="Mocks enabled"
          checked={proxy.data?.mocksEnabled ?? false}
          onChange={(event) => setMocksEnabled({ id, mocksEnabled: event.target.checked })}
        />
      </Stack>

      {stats.data && (
        <Row className="g-3 mb-3">
          <Stat label="Requests" value={stats.data.totalRequests} />
          <Stat label="Mocks" value={stats.data.mockRequests} />
          <Stat label="Passthrough" value={stats.data.passthroughRequests} />
          <Stat label="Manual" value={stats.data.manualRequests} />
          <Stat label="Avg ms" value={Math.round(stats.data.averageDurationMs)} />
        </Row>
      )}

      <Nav variant="tabs" activeKey={tab} onSelect={(key) => setTab((key as Tab) ?? 'settings')} className="mb-3">
        <Nav.Item>
          <Nav.Link eventKey="settings">Settings</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="send">Send</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="rest">REST mocks</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="soap">SOAP mocks</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="ignores">Ignores</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="logs">Logs</Nav.Link>
        </Nav.Item>
      </Nav>

      {tab === 'settings' && (
        <Form onSubmit={saveSettings}>
          <Row className="g-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Listen URL</Form.Label>
                <Form.Control
                  value={form.listen.url}
                  onChange={(event) => setForm({ ...form, listen: { ...form.listen, url: event.target.value } })}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Path prefix</Form.Label>
                <Form.Control
                  value={form.listen.pathPrefix ?? ''}
                  onChange={(event) => setForm({ ...form, listen: { ...form.listen, pathPrefix: event.target.value } })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Destination</Form.Label>
                <Form.Control
                  value={form.destination.address}
                  onChange={(event) =>
                    setForm({ ...form, destination: { ...form.destination, address: event.target.value } })
                  }
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Passthrough delay ms</Form.Label>
                <Form.Control
                  type="number"
                  value={form.passthroughDelayMs}
                  onChange={(event) => setForm({ ...form, passthroughDelayMs: Number(event.target.value) })}
                />
              </Form.Group>
            </Col>
            <Col md={3} className="d-flex align-items-end">
              <Form.Check
                type="switch"
                id="proxy-enabled"
                label="Enabled"
                checked={form.enabled}
                onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
              />
            </Col>
            <Col md={6}>
              <Form.Check
                type="switch"
                id="accept-any-cert"
                label="Accept any server certificate"
                checked={form.destination.acceptAnyServerCertificate}
                onChange={(event) =>
                  setForm({
                    ...form,
                    destination: { ...form.destination, acceptAnyServerCertificate: event.target.checked },
                  })
                }
              />
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Client certificate</Form.Label>
                <Form.Select
                  value={form.destination.clientCertificateId ?? ''}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      destination: { ...form.destination, clientCertificateId: event.target.value || null },
                    })
                  }
                >
                  <option value="">None</option>
                  {certificates.data
                    ?.filter((item) => item.type === 'client')
                    .map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                </Form.Select>
                <Form.Text>
                  Defined on the <Link to="/certificates">Certificates</Link> page.
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Server certificate</Form.Label>
                <Form.Select
                  value={form.listen.serverCertificateId ?? ''}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      listen: { ...form.listen, serverCertificateId: event.target.value || null },
                    })
                  }
                >
                  <option value="">None</option>
                  {certificates.data
                    ?.filter((item) => item.type === 'server')
                    .map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                </Form.Select>
                <Form.Text>
                  Defined on the <Link to="/certificates">Certificates</Link> page.
                </Form.Text>
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Button type="submit">Save settings</Button>
            </Col>
          </Row>
        </Form>
      )}

      {tab === 'send' && proxy.data && (
        <ManualSendPanel
          proxyId={id}
          destination={proxy.data.destination.address}
          pathPrefix={proxy.data.listen.pathPrefix}
          onOpenLog={setLogId}
        />
      )}

      {(tab === 'rest' || tab === 'soap') && (
        <>
          <Button
            className="mb-3"
            onClick={() => {
              setEditingExisting(false)
              setEditing(null)
            }}
          >
            Add {tab === 'soap' ? 'SOAP' : 'REST'} mock
          </Button>
          <MockTable
            items={tab === 'rest' ? restMocks : soapMocks}
            onEdit={(mock) => {
              setEditingExisting(true)
              setEditing(mock)
            }}
            onToggle={(name) => toggleMock({ proxyId: id, name })}
            onDelete={(name) => deleteMock({ proxyId: id, name })}
          />
        </>
      )}

      {tab === 'ignores' && (
        <>
          <p>Matching requests are still proxied or mocked, but they are not written to logs.</p>
          <Button className="mb-3" onClick={() => setEditingIgnore(null)}>
            Add ignore
          </Button>
          <Table striped responsive className="align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Path</th>
                <th>Mode</th>
                <th>Methods</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ignores.data?.map((ignore) => (
                <tr key={ignore.name}>
                  <td>{ignore.name}</td>
                  <td>
                    <code>{ignore.path}</code>
                  </td>
                  <td>{ignore.pathMode}</td>
                  <td>{ignore.methods?.length ? ignore.methods.join(', ') : 'any'}</td>
                  <td className="text-end">
                    <Stack direction="horizontal" gap={1} className="justify-content-end">
                      <Button variant="outline-primary" size="sm" onClick={() => setEditingIgnore(ignore)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => deleteIgnore({ proxyId: id, name: ignore.name })}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </td>
                </tr>
              ))}
              {ignores.data?.length === 0 && (
                <tr>
                  <td colSpan={5}>No ignored paths. Add one to keep noisy requests out of the log.</td>
                </tr>
              )}
            </tbody>
          </Table>
          <IgnoreEditor
            show={editingIgnore !== undefined}
            initial={editingIgnore}
            onSave={saveIgnore}
            onCancel={() => setEditingIgnore(undefined)}
          />
        </>
      )}

      {tab === 'logs' && (
        <>
          <Row className="g-2 mb-3">
            <Col md={4}>
              <Form.Control
                placeholder="Path contains"
                value={logFilter.path}
                onChange={(event) => setLogFilter({ ...logFilter, path: event.target.value })}
              />
            </Col>
            <Col md={3}>
              <Form.Select
                value={logFilter.mode}
                onChange={(event) => setLogFilter({ ...logFilter, mode: event.target.value })}
              >
                <option value="">Any mode</option>
                <option value="mock">mock</option>
                <option value="passthrough">passthrough</option>
                <option value="manual">manual</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select
                value={logFilter.protocol}
                onChange={(event) => setLogFilter({ ...logFilter, protocol: event.target.value })}
              >
                <option value="">Any protocol</option>
                <option value="rest">rest</option>
                <option value="soap">soap</option>
              </Form.Select>
            </Col>
          </Row>
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
                <tr key={item.id} role="button" onClick={() => setLogId(item.id)}>
                  <td>
                    <div>{new Date(item.timestampUtc).toLocaleString()}</div>
                    <div className="row-meta">{item.durationMs} ms</div>
                  </td>
                  <td>
                    <Badge bg={item.protocol === 'soap' ? 'warning' : 'primary'} text={item.protocol === 'soap' ? 'dark' : undefined}>
                      {item.protocol === 'soap' ? 'SOAP' : 'REST'}
                    </Badge>
                    {item.protocol === 'soap' && (
                      <div className="row-meta">{item.soapAction || 'no SOAPAction'}</div>
                    )}
                  </td>
                  <td>
                    <Badge bg={modeBadge(item.mode).bg}>{modeBadge(item.mode).label}</Badge>
                    {item.mockName && (
                      <div>
                        {mocks.data?.some((mock) => mock.name.toLowerCase() === item.mockName?.toLowerCase()) ? (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0"
                            onClick={(event) => {
                              event.stopPropagation()
                              const mock = mocks.data?.find(
                                (entry) => entry.name.toLowerCase() === item.mockName?.toLowerCase(),
                              )
                              if (mock) {
                                openExistingMock(mock)
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
            </tbody>
          </Table>
        </>
      )}

      <LogDetailModal
        show={logId != null}
        log={logDetail.data ?? null}
        existingMock={existingLogMock}
        onClose={() => setLogId(null)}
        onOpenMock={openExistingMock}
        onCreateMock={createMockFromLog}
      />

      <MockEditor
        show={editing !== undefined}
        initial={editing}
        isNew={!editingExisting}
        defaultType={editing?.type ?? (tab === 'soap' ? 'soap' : 'rest')}
        onSave={saveMock}
        onCancel={() => setEditing(undefined)}
      />
    </>
  )
}

function MockIcon({
  on,
  icon,
  activeClass,
  title,
}: {
  on: boolean
  icon: string
  activeClass: string
  title: string
}) {
  return (
    <OverlayTrigger overlay={<Tooltip>{title}</Tooltip>}>
      <i className={`bi ${icon} ${on ? activeClass : 'is-off'}`} aria-label={title} />
    </OverlayTrigger>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Col md={2}>
      <Card>
        <Card.Body>
          <div>{label}</div>
          <Card.Title className="mb-0">{value}</Card.Title>
        </Card.Body>
      </Card>
    </Col>
  )
}

function MockTable({
  items,
  onEdit,
  onToggle,
  onDelete,
}: {
  items: MockDto[]
  onEdit: (mock: MockDto) => void
  onToggle: (name: string) => void
  onDelete: (name: string) => void
}) {
  return (
    <Table striped responsive className="align-middle">
      <thead>
        <tr>
          <th>Name</th>
          <th>Methods</th>
          <th>Match</th>
          <th>Flags</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((mock) => {
          const delayed = (mock.response.delayMs ?? 0) > 0
          const blocked = mock.response.block === true
          const advanced = hasAdvancedMatch(mock.match)
          const methods = mock.match.methods?.filter(Boolean) ?? []
          return (
            <tr key={mock.name} className={mock.enabled ? undefined : 'text-secondary'}>
              <td>
                {mock.name}
                <div className="row-meta">{mock.fileName}</div>
              </td>
              <td>
                {methods.length > 0 ? (
                  <Stack direction="horizontal" gap={1} className="flex-wrap">
                    {methods.map((method) => (
                      <Badge key={method} bg="secondary">
                        {method}
                      </Badge>
                    ))}
                  </Stack>
                ) : (
                  <span className="row-meta">any</span>
                )}
              </td>
              <td>
                <code>{mock.match.path || mock.match.soapAction || mock.match.operation || '*'}</code>
                {mock.match.pathMode && mock.match.pathMode !== 'exact' && (
                  <div className="row-meta">{mock.match.pathMode}</div>
                )}
              </td>
              <td>
                <div className="mock-icons">
                  <MockIcon
                    on={mock.enabled}
                    icon={mock.enabled ? 'bi-check-circle-fill' : 'bi-pause-circle'}
                    activeClass={mock.enabled ? 'text-success' : 'text-secondary'}
                    title={mock.enabled ? 'Enabled' : 'Disabled'}
                  />
                  <MockIcon
                    on={delayed}
                    icon="bi-hourglass-split"
                    activeClass="text-warning"
                    title={delayed ? `Delayed ${mock.response.delayMs} ms` : 'No delay'}
                  />
                  <MockIcon
                    on={blocked}
                    icon="bi-slash-circle"
                    activeClass="text-danger"
                    title={blocked ? 'Blocks the request' : 'Responds normally'}
                  />
                  <MockIcon
                    on={advanced}
                    icon="bi-sliders"
                    activeClass="text-info"
                    title={advanced ? 'Uses extra match rules' : 'Path matching only'}
                  />
                </div>
              </td>
              <td>{blocked ? 'Block' : mock.response.statusCode}</td>
              <td className="text-end">
                <Stack direction="horizontal" gap={1} className="justify-content-end">
                  <Button variant="outline-secondary" size="sm" onClick={() => onToggle(mock.name)}>
                    {mock.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="outline-primary" size="sm" onClick={() => onEdit(mock)}>
                    Edit
                  </Button>
                  <Button variant="outline-danger" size="sm" onClick={() => onDelete(mock.name)}>
                    Delete
                  </Button>
                </Stack>
              </td>
            </tr>
          )
        })}
        {items.length === 0 && (
          <tr>
            <td colSpan={6}>No mocks in this group.</td>
          </tr>
        )}
      </tbody>
    </Table>
  )
}
