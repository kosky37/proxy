import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MockEditor } from '../components/MockEditor'
import {
  useCreateMockMutation,
  useDeleteMockMutation,
  useGetLogsQuery,
  useGetLogQuery,
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
  const logs = useGetLogsQuery({ proxyId: id, ...logFilter, take: 100 })
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
    return <div className="alert alert-secondary">Loading…</div>
  }
  if (proxy.isError) {
    return <div className="alert alert-danger">Proxy not found.</div>
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
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Link to="/">Proxies</Link>
          <h1 className="h3 mb-0">{proxy.data?.name}</h1>
          <div className="text-secondary">{id}</div>
        </div>
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            checked={proxy.data?.mocksEnabled ?? false}
            onChange={(event) => setMocksEnabled({ id, mocksEnabled: event.target.checked })}
          />
          <label className="form-check-label">Mocks enabled</label>
        </div>
      </div>

      {stats.data && (
        <div className="row g-3 mb-3">
          <Stat label="Requests" value={stats.data.totalRequests} />
          <Stat label="Mocks" value={stats.data.mockRequests} />
          <Stat label="Passthrough" value={stats.data.passthroughRequests} />
          <Stat label="Avg ms" value={Math.round(stats.data.averageDurationMs)} />
        </div>
      )}

      <ul className="nav nav-tabs mb-3">
        {(['settings', 'rest', 'soap', 'logs'] as Tab[]).map((item) => (
          <li className="nav-item" key={item}>
            <button className={`nav-link ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>
              {item === 'rest' ? 'REST mocks' : item === 'soap' ? 'SOAP mocks' : item[0].toUpperCase() + item.slice(1)}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'settings' && (
        <form className="row g-3" onSubmit={saveSettings}>
          <div className="col-md-4">
            <label className="form-label">Name</label>
            <input className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div className="col-md-4">
            <label className="form-label">Listen URL</label>
            <input
              className="form-control"
              value={form.listen.url}
              onChange={(event) => setForm({ ...form, listen: { ...form.listen, url: event.target.value } })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Path prefix</label>
            <input
              className="form-control"
              value={form.listen.pathPrefix ?? ''}
              onChange={(event) => setForm({ ...form, listen: { ...form.listen, pathPrefix: event.target.value } })}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Destination</label>
            <input
              className="form-control"
              value={form.destination.address}
              onChange={(event) =>
                setForm({ ...form, destination: { ...form.destination, address: event.target.value } })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Client cert PFX</label>
            <input
              className="form-control"
              value={form.destination.clientCertificate?.pfxPath ?? ''}
              onChange={(event) =>
                setForm({
                  ...form,
                  destination: {
                    ...form.destination,
                    clientCertificate: { ...form.destination.clientCertificate, pfxPath: event.target.value },
                  },
                })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Cert password</label>
            <input
              className="form-control"
              type="password"
              value={form.destination.clientCertificate?.password ?? ''}
              onChange={(event) =>
                setForm({
                  ...form,
                  destination: {
                    ...form.destination,
                    clientCertificate: { ...form.destination.clientCertificate, password: event.target.value },
                  },
                })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Passthrough delay ms</label>
            <input
              className="form-control"
              type="number"
              value={form.passthroughDelayMs}
              onChange={(event) => setForm({ ...form, passthroughDelayMs: Number(event.target.value) })}
            />
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
              />
              <label className="form-check-label">Enabled</label>
            </div>
          </div>
          <div className="col-md-6 d-flex align-items-end">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                checked={form.destination.acceptAnyServerCertificate}
                onChange={(event) =>
                  setForm({
                    ...form,
                    destination: { ...form.destination, acceptAnyServerCertificate: event.target.checked },
                  })
                }
              />
              <label className="form-check-label">Accept any server certificate</label>
            </div>
          </div>
          <div className="col-12">
            <button className="btn btn-primary" type="submit">
              Save settings
            </button>
          </div>
        </form>
      )}

      {(tab === 'rest' || tab === 'soap') && (
        <>
          {editing !== undefined && (
            <MockEditor
              initial={editing ?? { ...blankMock(tab), type: tab === 'soap' ? 'soap' : 'rest' }}
              onSave={saveMock}
              onCancel={() => setEditing(undefined)}
            />
          )}
          <div className="mb-3">
            <button className="btn btn-primary btn-sm" onClick={() => setEditing(null)}>
              Add {tab === 'soap' ? 'SOAP' : 'REST'} mock
            </button>
          </div>
          <MockTable
            items={tab === 'rest' ? restMocks : soapMocks}
            onEdit={setEditing}
            onToggle={(name) => toggleMock({ proxyId: id, name })}
            onDelete={(name) => deleteMock({ proxyId: id, name })}
          />
        </>
      )}

      {tab === 'logs' && (
        <>
          <form
            className="row g-2 mb-3"
            onSubmit={(event) => {
              event.preventDefault()
            }}
          >
            <div className="col-md-4">
              <input
                className="form-control"
                placeholder="Path contains"
                value={logFilter.path}
                onChange={(event) => setLogFilter({ ...logFilter, path: event.target.value })}
              />
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={logFilter.mode}
                onChange={(event) => setLogFilter({ ...logFilter, mode: event.target.value })}
              >
                <option value="">Any mode</option>
                <option value="mock">mock</option>
                <option value="passthrough">passthrough</option>
              </select>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={logFilter.protocol}
                onChange={(event) => setLogFilter({ ...logFilter, protocol: event.target.value })}
              >
                <option value="">Any protocol</option>
                <option value="rest">rest</option>
                <option value="soap">soap</option>
              </select>
            </div>
          </form>
          <div className="table-responsive">
            <table className="table table-sm table-striped align-middle">
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
                      {item.mockName && <div className="small text-secondary">{item.mockName}</div>}
                    </td>
                    <td>{item.statusCode}</td>
                    <td>
                      <span className={`badge ${item.mode === 'mock' ? 'text-bg-info' : 'text-bg-secondary'}`}>
                        {item.mode}
                      </span>
                    </td>
                    <td>{item.durationMs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logDetail.data && (
            <div className="card mt-3">
              <div className="card-header d-flex justify-content-between">
                <span>Log {logDetail.data.id}</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setLogId(null)}>
                  Close
                </button>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6">
                    <h2 className="h6">Request</h2>
                    <pre>{logDetail.data.requestHeaders}</pre>
                    <pre>{logDetail.data.requestBody}</pre>
                  </div>
                  <div className="col-md-6">
                    <h2 className="h6">Response</h2>
                    <pre>{logDetail.data.responseHeaders}</pre>
                    <pre>{logDetail.data.responseBody}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="col-md-3">
      <div className="card">
        <div className="card-body">
          <div className="text-secondary">{label}</div>
          <div className="h4 mb-0">{value}</div>
        </div>
      </div>
    </div>
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
    <div className="table-responsive">
      <table className="table table-striped align-middle">
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
            <tr key={mock.name} className={mock.enabled ? '' : 'text-secondary'}>
              <td>
                {mock.name}
                <div className="small">{mock.fileName}</div>
              </td>
              <td>
                <code>
                  {mock.match.path || mock.match.soapAction || mock.match.operation || '*'}
                </code>
              </td>
              <td>{mock.response.statusCode}</td>
              <td>{mock.response.delayMs} ms</td>
              <td className="text-end">
                <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => onToggle(mock.name)}>
                  {mock.enabled ? 'Disable' : 'Enable'}
                </button>
                <button className="btn btn-sm btn-outline-primary me-1" onClick={() => onEdit(mock)}>
                  Edit
                </button>
                <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(mock.name)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="text-secondary">
                No mocks in this group.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function blankMock(tab: Tab): MockDto {
  return {
    name: '',
    fileName: '',
    enabled: true,
    type: tab === 'soap' ? 'soap' : 'rest',
    match: { pathMode: 'exact' },
    response: { statusCode: 200, delayMs: 0 },
  }
}
