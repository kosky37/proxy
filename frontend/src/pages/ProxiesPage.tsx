import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Col, Form, Modal, Row, Stack, Table } from 'react-bootstrap'
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
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (showCreate) {
      setForm(emptyForm)
    }
  }, [showCreate])

  const onCreate = async (event: FormEvent) => {
    event.preventDefault()
    await createProxy({
      ...form,
      id: form.id || undefined,
    }).unwrap()
    setShowCreate(false)
  }

  return (
    <>
      <Stack direction="horizontal" className="mb-3">
        <h1 className="h3 mb-0">Proxies</h1>
        <div className="ms-auto d-flex gap-2">
          <Button variant="outline-secondary" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button onClick={() => setShowCreate(true)}>New proxy</Button>
        </div>
      </Stack>

      {isLoading && <Alert variant="secondary">Loading…</Alert>}
      {error && <Alert variant="danger">Could not load proxies. Is the API running on port 5050?</Alert>}

      <Table striped hover responsive className="align-middle">
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
                {!proxy.enabled && (
                  <Badge bg="secondary" className="ms-2">
                    disabled
                  </Badge>
                )}
              </td>
              <td>
                <div>
                  <code>{proxy.listenUrl}</code>
                </div>
                {proxy.listenPathPrefix && <div className="row-meta">{proxy.listenPathPrefix}</div>}
              </td>
              <td>
                <code>{proxy.destinationAddress}</code>
              </td>
              <td>
                <Form.Check
                  type="switch"
                  id={`mocks-${proxy.id}`}
                  checked={proxy.mocksEnabled}
                  label={`${proxy.enabledMockCount}/${proxy.mockCount} enabled`}
                  onChange={(event) =>
                    setMocksEnabled({ id: proxy.id, mocksEnabled: event.target.checked })
                  }
                />
              </td>
              <td className="text-end">
                <Button variant="outline-danger" size="sm" onClick={() => deleteProxy(proxy.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
          {data?.length === 0 && (
            <tr>
              <td colSpan={5}>No proxy folders found.</td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={showCreate} onHide={() => setShowCreate(false)}>
        <Modal.Header closeButton>
          <Modal.Title>New proxy</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form id="proxy-create-form" onSubmit={onCreate}>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Id</Form.Label>
                  <Form.Control
                    value={form.id ?? ''}
                    placeholder="folder-name"
                    onChange={(event) => setForm({ ...form, id: event.target.value })}
                  />
                  <Form.Text>Leave empty to derive it from the name.</Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    required
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={7}>
                <Form.Group>
                  <Form.Label>Listen URL</Form.Label>
                  <Form.Control
                    required
                    value={form.listen.url}
                    onChange={(event) => setForm({ ...form, listen: { ...form.listen, url: event.target.value } })}
                  />
                  <Form.Text>Scheme, host, and port this proxy binds.</Form.Text>
                </Form.Group>
              </Col>
              <Col md={5}>
                <Form.Group>
                  <Form.Label>Path prefix</Form.Label>
                  <Form.Control
                    value={form.listen.pathPrefix ?? ''}
                    placeholder="/api"
                    onChange={(event) =>
                      setForm({ ...form, listen: { ...form.listen, pathPrefix: event.target.value || null } })
                    }
                  />
                  <Form.Text>Optional. Use this to share a port with other proxies.</Form.Text>
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group>
                  <Form.Label>Destination</Form.Label>
                  <Form.Control
                    required
                    value={form.destination.address}
                    onChange={(event) =>
                      setForm({ ...form, destination: { ...form.destination, address: event.target.value } })
                    }
                  />
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
          <Button type="submit" form="proxy-create-form" disabled={createState.isLoading}>
            Create
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
