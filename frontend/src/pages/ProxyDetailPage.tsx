import { useEffect, useState, type FormEvent } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Nav,
  Row,
  Stack,
  Table,
} from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { CertPathField } from '../components/CertPathField'
import { LogDetailModal } from '../components/LogDetailModal'
import { MockEditor } from '../components/MockEditor'
import {
  useCreateMockMutation,
  useDeleteMockMutation,
  useGetLogQuery,
  useGetLogsQuery,
  useGetMocksQuery,
  useGetProxyQuery,
  useGetStatsQuery,
  useSetMocksEnabledMutation,
  useToggleMockMutation,
  useUpdateMockMutation,
  useUpdateProxyMutation,
} from '../store/proxyApi'
import type { MockDto, UpsertProxyRequest } from '../store/types'

type Tab = 'settings' | 'rest' | 'soap' | 'logs'

export function ProxyDetailPage() {
  const { id = '' } = useParams()
  const proxy = useGetProxyQuery(id)
  const mocks = useGetMocksQuery(id)
  const stats = useGetStatsQuery(id)
  const [tab, setTab] = useState<Tab>('settings')
  const [form, setForm] = useState<UpsertProxyRequest | null>(null)
  const [editing, setEditing] = useState<MockDto | null | undefined>(undefined)
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
    if (editing && editing.name) {
      await updateMock({ proxyId: id, name: editing.name, body: mock }).unwrap()
    } else {
      await createMock({ proxyId: id, body: mock }).unwrap()
    }
    setEditing(undefined)
  }

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
          <Stat label="Avg ms" value={Math.round(stats.data.averageDurationMs)} />
        </Row>
      )}

      <Nav variant="tabs" activeKey={tab} onSelect={(key) => setTab((key as Tab) ?? 'settings')} className="mb-3">
        <Nav.Item>
          <Nav.Link eventKey="settings">Settings</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="rest">REST mocks</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="soap">SOAP mocks</Nav.Link>
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
              <CertPathField
                label="Client certificate"
                proxyId={id}
                value={form.destination.clientCertificate}
                onChange={(clientCertificate) =>
                  setForm({ ...form, destination: { ...form.destination, clientCertificate } })
                }
              />
            </Col>
            <Col md={6}>
              <CertPathField
                label="Server certificate"
                proxyId={id}
                value={form.listen.serverCertificate}
                onChange={(serverCertificate) =>
                  setForm({ ...form, listen: { ...form.listen, serverCertificate } })
                }
              />
            </Col>
            <Col xs={12}>
              <Button type="submit">Save settings</Button>
            </Col>
          </Row>
        </Form>
      )}

      {(tab === 'rest' || tab === 'soap') && (
        <>
          <Button className="mb-3" onClick={() => setEditing(null)}>
            Add {tab === 'soap' ? 'SOAP' : 'REST'} mock
          </Button>
          <MockTable
            items={tab === 'rest' ? restMocks : soapMocks}
            onEdit={setEditing}
            onToggle={(name) => toggleMock({ proxyId: id, name })}
            onDelete={(name) => deleteMock({ proxyId: id, name })}
          />
          <MockEditor
            show={editing !== undefined}
            initial={editing}
            defaultType={tab === 'soap' ? 'soap' : 'rest'}
            onSave={saveMock}
            onCancel={() => setEditing(undefined)}
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
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Mode</th>
                <th>ms</th>
              </tr>
            </thead>
            <tbody>
              {logs.data?.items.map((item) => (
                <tr key={item.id} role="button" onClick={() => setLogId(item.id)}>
                  <td>{new Date(item.timestampUtc).toLocaleString()}</td>
                  <td>{item.method}</td>
                  <td>
                    {item.path}
                    {item.mockName && <div>{item.mockName}</div>}
                  </td>
                  <td>{item.statusCode}</td>
                  <td>
                    <Badge bg={item.mode === 'mock' ? 'info' : 'secondary'}>{item.mode}</Badge>
                  </td>
                  <td>{item.durationMs}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <LogDetailModal
            show={logId != null}
            log={logDetail.data ?? null}
            onClose={() => setLogId(null)}
          />
        </>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Col md={3}>
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
          <th>Match</th>
          <th>Status</th>
          <th>Delay</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((mock) => (
          <tr key={mock.name}>
            <td>
              {mock.name}
              <div>{mock.fileName}</div>
            </td>
            <td>
              <code>{mock.match.path || mock.match.soapAction || mock.match.operation || '*'}</code>
            </td>
            <td>{mock.response.statusCode}</td>
            <td>{mock.response.delayMs} ms</td>
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
        ))}
        {items.length === 0 && (
          <tr>
            <td colSpan={5}>No mocks in this group.</td>
          </tr>
        )}
      </tbody>
    </Table>
  )
}
