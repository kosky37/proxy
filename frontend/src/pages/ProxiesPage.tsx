import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  useCreateProxyMutation,
  useDeleteProxyMutation,
  useGetProxiesQuery,
  useSetMocksEnabledMutation,
} from '../store/proxyApi'
import type { UpsertProxyRequest } from '../store/types'

const emptyForm: UpsertProxyRequest = {
  id: '',
  name: '',
  enabled: true,
  listen: { url: 'http://127.0.0.1:8083' },
  destination: { address: 'http://127.0.0.1:9090', acceptAnyServerCertificate: false },
  mocksEnabled: true,
  passthroughDelayMs: 0,
}

export function ProxiesPage() {
  const { data, isLoading, error, refetch } = useGetProxiesQuery()
  const [createProxy, createState] = useCreateProxyMutation()
  const [deleteProxy] = useDeleteProxyMutation()
  const [setMocksEnabled] = useSetMocksEnabledMutation()
  const [form, setForm] = useState(emptyForm)

  const onCreate = async (event: FormEvent) => {
    event.preventDefault()
    await createProxy({
      ...form,
      id: form.id || undefined,
    }).unwrap()
    setForm(emptyForm)
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">Proxies</h1>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => refetch()}>
          Refresh
        </button>
      </div>

      {isLoading && <div className="alert alert-secondary">Loading…</div>}
      {error && <div className="alert alert-danger">Could not load proxies. Is the API running on port 5050?</div>}

      <div className="table-responsive mb-4">
        <table className="table table-striped table-hover align-middle">
          <thead>
            <tr>
              <th>Name</th>
              <th>Listen</th>
              <th>Destination</th>
              <th>Mocks</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((proxy) => (
              <tr key={proxy.id}>
                <td>
                  <Link to={`/proxies/${proxy.id}`}>{proxy.name}</Link>
                  {!proxy.enabled && <span className="badge text-bg-secondary ms-2">disabled</span>}
                </td>
                <td>
                  <code>{proxy.listenUrl}</code>
                </td>
                <td>
                  <code>{proxy.destinationAddress}</code>
                </td>
                <td>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={proxy.mocksEnabled}
                      onChange={(event) =>
                        setMocksEnabled({ id: proxy.id, mocksEnabled: event.target.checked })
                      }
                    />
                    <label className="form-check-label">
                      {proxy.enabledMockCount}/{proxy.mockCount} enabled
                    </label>
                  </div>
                </td>
                <td className="text-end">
                  <button className="btn btn-outline-danger btn-sm" onClick={() => deleteProxy(proxy.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={5} className="text-secondary">
                  No proxy folders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">New proxy</div>
        <div className="card-body">
          <form className="row g-3" onSubmit={onCreate}>
            <div className="col-md-3">
              <label className="form-label">Id</label>
              <input
                className="form-control"
                value={form.id ?? ''}
                onChange={(event) => setForm({ ...form, id: event.target.value })}
                placeholder="folder-name"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Name</label>
              <input
                className="form-control"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Listen URL</label>
              <input
                className="form-control"
                required
                value={form.listen.url}
                onChange={(event) => setForm({ ...form, listen: { ...form.listen, url: event.target.value } })}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Destination</label>
              <input
                className="form-control"
                required
                value={form.destination.address}
                onChange={(event) =>
                  setForm({ ...form, destination: { ...form.destination, address: event.target.value } })
                }
              />
            </div>
            <div className="col-12">
              <button className="btn btn-primary" type="submit" disabled={createState.isLoading}>
                Create
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
