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
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { IgnoreEditor } from '../components/IgnoreEditor'
import { LogDetailModal } from '../components/LogDetailModal'
import { LogsPanel } from '../components/LogsPanel'
import { ManualSendPanel } from '../components/ManualSendPanel'
import { MockEditor } from '../components/MockEditor'
import { MockSetEditor } from '../components/MockSetEditor'
import { hasAdvancedMatch } from '../format'
import { ignoreFromLog, mockFromLog } from '../mockFromLog'
import { sendFromLog, type SendDraft } from '../headers'
import {
  useApplyMockSetMutation,
  useCreateIgnoreMutation,
  useCreateMockMutation,
  useCreateMockSetMutation,
  useDeleteIgnoreMutation,
  useDeleteMockMutation,
  useDeleteMockSetMutation,
  useGetCertificatesQuery,
  useGetIgnoresQuery,
  useGetLogQuery,
  useGetMocksQuery,
  useGetMockSetsQuery,
  useGetProxyQuery,
  useSetMocksEnabledMutation,
  useToggleMockMutation,
  useUpdateIgnoreMutation,
  useUpdateMockMutation,
  useUpdateMockSetMutation,
  useUpdateProxyMutation,
} from '../store/proxyApi'
import type { IgnoredPathDto, LogDetailDto, MockDto, MockSetDto, UpsertProxyRequest } from '../store/types'

type Tab = 'settings' | 'send' | 'rest' | 'soap' | 'mock-sets' | 'ignores' | 'logs'

export function ProxyDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const proxy = useGetProxyQuery(id)
  const mocks = useGetMocksQuery(id)
  const ignores = useGetIgnoresQuery(id)
  const mockSets = useGetMockSetsQuery(id)
  const certificates = useGetCertificatesQuery()
  const [tab, setTab] = useState<Tab>('logs')
  const [form, setForm] = useState<UpsertProxyRequest | null>(null)
  const [editing, setEditing] = useState<MockDto | null | undefined>(undefined)
  const [editingExisting, setEditingExisting] = useState(false)
  const [editingIgnore, setEditingIgnore] = useState<IgnoredPathDto | null | undefined>(undefined)
  const [editingSet, setEditingSet] = useState<MockSetDto | null | undefined>(undefined)
  const [logId, setLogId] = useState<number | null>(null)
  const [sendDraft, setSendDraft] = useState<SendDraft | null>(null)
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
  const [createMockSet] = useCreateMockSetMutation()
  const [updateMockSet] = useUpdateMockSetMutation()
  const [deleteMockSet] = useDeleteMockSetMutation()
  const [applyMockSet] = useApplyMockSetMutation()
  useEffect(() => {
    if (proxy.data) {
      setForm({
        name: proxy.data.name,
        enabled: proxy.data.enabled,
        listen: proxy.data.listen,
        destination: proxy.data.destination,
        mocksEnabled: proxy.data.mocksEnabled,
        passthroughDelayMs: proxy.data.passthroughDelayMs,
        logRetentionDays: proxy.data.logRetentionDays ?? 7,
        bodyLogLimitBytes: proxy.data.bodyLogLimitBytes ?? 1_048_576,
      })
    }
  }, [proxy.data])

  useEffect(() => {
    const state = location.state as {
      fromLog?: { action: 'mock' | 'send'; log: LogDetailDto }
      openMock?: MockDto
    } | null
    if (state?.openMock) {
      setEditingExisting(true)
      setEditing(state.openMock)
      setTab(state.openMock.type === 'soap' ? 'soap' : 'rest')
      setLogId(null)
    } else if (state?.fromLog) {
      const fromLog = state.fromLog
      if (fromLog.action === 'send') {
        setSendDraft(sendFromLog(fromLog.log))
        setTab('send')
        setLogId(null)
      } else {
        setEditingExisting(false)
        setEditing(mockFromLog(fromLog.log))
        setTab(fromLog.log.protocol === 'soap' ? 'soap' : 'rest')
        setLogId(null)
      }
    } else {
      return
    }

    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state, navigate])

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
    const existingName = editingIgnore?.name
    const exists = Boolean(
      existingName &&
        ignores.data?.some((item) => item.name.toLowerCase() === existingName.toLowerCase()),
    )
    if (exists && existingName) {
      await updateIgnore({ proxyId: id, name: existingName, body: ignore }).unwrap()
    } else {
      await createIgnore({ proxyId: id, body: ignore }).unwrap()
    }
    setEditingIgnore(undefined)
  }

  const saveMockSet = async (set: MockSetDto) => {
    const existingName = editingSet?.name
    const exists = Boolean(
      existingName &&
        mockSets.data?.some((item) => item.name.toLowerCase() === existingName.toLowerCase()),
    )
    if (exists && existingName) {
      await updateMockSet({ proxyId: id, name: existingName, body: set }).unwrap()
    } else {
      await createMockSet({ proxyId: id, body: set }).unwrap()
    }
    setEditingSet(undefined)
  }

  const openExistingMock = (mock: MockDto) => {
    setEditingExisting(true)
    setEditing(mock)
    setTab(mock.type === 'soap' ? 'soap' : 'rest')
    setLogId(null)
  }

  const openMockFromSet = (mock: MockDto) => {
    setEditingExisting(true)
    setEditing(mock)
  }

  const createMockFromLog = (log: LogDetailDto) => {
    setEditingExisting(false)
    setEditing(mockFromLog(log))
    setTab(log.protocol === 'soap' ? 'soap' : 'rest')
    setLogId(null)
  }

  const createSendFromLog = (log: LogDetailDto) => {
    setSendDraft(sendFromLog(log))
    setTab('send')
    setLogId(null)
  }

  const createIgnoreFromLog = (log: LogDetailDto) => {
    setEditingIgnore(ignoreFromLog(log))
    setTab('ignores')
    setLogId(null)
  }

  const ignoreIsNew =
    editingIgnore == null ||
    !ignores.data?.some((item) => item.name.toLowerCase() === editingIgnore.name.toLowerCase())

  const setIsNew =
    editingSet == null ||
    !mockSets.data?.some((item) => item.name.toLowerCase() === editingSet.name.toLowerCase())

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

      <Nav variant="tabs" activeKey={tab} onSelect={(key) => setTab((key as Tab) ?? 'logs')} className="mb-3">
        <Nav.Item>
          <Nav.Link eventKey="logs">Logs</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="mock-sets">Mock sets</Nav.Link>
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
          <Nav.Link eventKey="send">Send</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="settings">Settings</Nav.Link>
        </Nav.Item>
      </Nav>

      {tab === 'settings' && (
        <Form onSubmit={saveSettings}>
          <Stack gap={3}>
            <Card>
              <Card.Body>
                <h2 className="h6 mb-3">Proxy</h2>
                <Row className="g-3 align-items-end">
                  <Col md={8}>
                    <Form.Group>
                      <Form.Label>Name</Form.Label>
                      <Form.Control
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4} className="d-flex align-items-end pb-2">
                    <Form.Check
                      type="switch"
                      id="proxy-enabled"
                      label="Enabled"
                      checked={form.enabled}
                      onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
                    />
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            <Row className="g-3">
              <Col md={6}>
                <Card className="h-100">
                  <Card.Body>
                    <h2 className="h6 mb-3">Listen</h2>
                    <Stack gap={3}>
                      <Form.Group>
                        <Form.Label>Listen URL</Form.Label>
                        <Form.Control
                          value={form.listen.url}
                          onChange={(event) => setForm({ ...form, listen: { ...form.listen, url: event.target.value } })}
                        />
                        <Form.Text>Scheme, host, and port this proxy binds.</Form.Text>
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Path prefix</Form.Label>
                        <Form.Control
                          value={form.listen.pathPrefix ?? ''}
                          onChange={(event) =>
                            setForm({ ...form, listen: { ...form.listen, pathPrefix: event.target.value } })
                          }
                        />
                        <Form.Text>Optional. Share a port by giving each proxy a different prefix, for example /api. Removed before the request is forwarded.</Form.Text>
                      </Form.Group>
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
                          HTTPS certificate for this listener. Defined on the <Link to="/certificates">Certificates</Link>{' '}
                          page.
                        </Form.Text>
                      </Form.Group>
                    </Stack>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="h-100">
                  <Card.Body>
                    <h2 className="h6 mb-3">Destination</h2>
                    <Stack gap={3}>
                      <Form.Group>
                        <Form.Label>Destination URL</Form.Label>
                        <Form.Control
                          value={form.destination.address}
                          onChange={(event) =>
                            setForm({ ...form, destination: { ...form.destination, address: event.target.value } })
                          }
                        />
                        <Form.Text>Upstream service used when no mock matches.</Form.Text>
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Passthrough delay ms</Form.Label>
                        <Form.Control
                          type="number"
                          value={form.passthroughDelayMs}
                          onChange={(event) => setForm({ ...form, passthroughDelayMs: Number(event.target.value) })}
                        />
                        <Form.Text>Optional wait before forwarding an unmatched request.</Form.Text>
                      </Form.Group>
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
                          Presented to the destination. Defined on the <Link to="/certificates">Certificates</Link> page.
                        </Form.Text>
                      </Form.Group>
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
                    </Stack>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Card>
              <Card.Body>
                <h2 className="h6 mb-3">Logs</h2>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Retention (days)</Form.Label>
                      <Form.Control
                        type="number"
                        min={0}
                        value={form.logRetentionDays ?? 7}
                        onChange={(event) => setForm({ ...form, logRetentionDays: Number(event.target.value) })}
                      />
                      <Form.Text>0 keeps logs forever. Older entries are deleted automatically.</Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Max logged body (KB)</Form.Label>
                      <Form.Control
                        type="number"
                        min={1}
                        value={Math.round((form.bodyLogLimitBytes ?? 1_048_576) / 1024)}
                        onChange={(event) =>
                          setForm({ ...form, bodyLogLimitBytes: Math.max(1, Number(event.target.value)) * 1024 })
                        }
                      />
                      <Form.Text>Bodies larger than this are not stored; only the original size is logged.</Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            <div>
              <Button type="submit">Save settings</Button>
            </div>
          </Stack>
        </Form>
      )}

      {tab === 'send' && proxy.data && (
        <ManualSendPanel
          proxyId={id}
          destination={proxy.data.destination.address}
          pathPrefix={proxy.data.listen.pathPrefix}
          draft={sendDraft}
          onDraftConsumed={() => setSendDraft(null)}
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

      {tab === 'mock-sets' && (
        <>
          <p>
            Apply a set to enable those mocks and disable every other mock. Use this to switch between testing
            scenarios.
          </p>
          <Button className="mb-3" onClick={() => setEditingSet(null)}>
            Add mock set
          </Button>
          <Table striped responsive className="align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mocks</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mockSets.data?.map((set) => {
                const active = isMockSetActive(set, mocks.data ?? [])
                return (
                  <tr key={set.name}>
                    <td>
                      {set.name}
                      <div className="row-meta">{set.fileName}</div>
                    </td>
                    <td>
                      <MockNameLinks names={set.mockNames} mocks={mocks.data ?? []} onOpenMock={openMockFromSet} />
                    </td>
                    <td>{active && <Badge bg="success">Active</Badge>}</td>
                    <td className="text-end">
                      <Stack direction="horizontal" gap={1} className="justify-content-end">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => applyMockSet({ proxyId: id, name: set.name })}
                        >
                          Apply
                        </Button>
                        <Button variant="outline-primary" size="sm" onClick={() => setEditingSet(set)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => deleteMockSet({ proxyId: id, name: set.name })}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </td>
                  </tr>
                )
              })}
              {mockSets.data?.length === 0 && (
                <tr>
                  <td colSpan={4}>No mock sets. Add one to switch between testing scenarios.</td>
                </tr>
              )}
            </tbody>
          </Table>
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
        </>
      )}

      {tab === 'logs' && (
        <LogsPanel
          proxyId={id}
          active
          mocks={mocks.data ?? []}
          onOpenLog={setLogId}
          onOpenMock={openExistingMock}
        />
      )}

      <LogDetailModal
        show={logId != null}
        log={logDetail.data ?? null}
        existingMock={existingLogMock}
        onClose={() => setLogId(null)}
        onOpenMock={openExistingMock}
        onCreateMock={createMockFromLog}
        onCreateSend={createSendFromLog}
        onCreateIgnore={createIgnoreFromLog}
      />

      <MockSetEditor
        show={editingSet !== undefined}
        initial={editingSet}
        isNew={setIsNew}
        mocks={mocks.data ?? []}
        onSave={saveMockSet}
        onCancel={() => setEditingSet(undefined)}
      />

      <IgnoreEditor
        show={editingIgnore !== undefined}
        initial={editingIgnore}
        isNew={ignoreIsNew}
        onSave={saveIgnore}
        onCancel={() => setEditingIgnore(undefined)}
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

function isMockSetActive(set: MockSetDto, mocks: MockDto[]) {
  const enabled = mocks
    .filter((mock) => mock.enabled)
    .map((mock) => mock.name.toLowerCase())
    .sort()
  const selected = set.mockNames.map((name) => name.toLowerCase()).sort()
  return enabled.length === selected.length && enabled.every((name, index) => name === selected[index])
}

function MockNameLinks({
  names,
  mocks,
  onOpenMock,
}: {
  names: string[]
  mocks: MockDto[]
  onOpenMock: (mock: MockDto) => void
}) {
  if (names.length === 0) {
    return <span className="row-meta">none (apply disables all mocks)</span>
  }

  return (
    <Stack direction="horizontal" gap={2} className="flex-wrap">
      {names.map((name) => {
        const mock = mocks.find((item) => item.name.toLowerCase() === name.toLowerCase())
        return mock ? (
          <Button key={name} variant="link" size="sm" className="p-0" onClick={() => onOpenMock(mock)}>
            {mock.name}
          </Button>
        ) : (
          <span key={name} className="row-meta">
            {name}
          </span>
        )
      })}
    </Stack>
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
                <code>
                  {mock.type === 'soap'
                    ? mock.match.soapAction || mock.match.operation || '*'
                    : mock.match.path || '*'}
                </code>
                {mock.type !== 'soap' && mock.match.pathMode && mock.match.pathMode !== 'exact' && (
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
