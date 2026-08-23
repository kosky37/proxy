import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Nav, Row, Stack } from 'react-bootstrap'
import { protocolBadge } from '../protocolBadge'
import { useSendManualRequestMutation } from '../store/proxyApi'
import type { LogDetailDto } from '../store/types'
import { CopyButton } from './CopyButton'

const soapTemplate = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
  </s:Body>
</s:Envelope>`

interface HeaderRow {
  id: number
  name: string
  value: string
}

interface AuthState {
  token: string
  scheme: 'Bearer' | 'Raw'
}

function authKey(proxyId: string) {
  return `proxy-send-auth-${proxyId}`
}

function readAuth(proxyId: string): AuthState {
  try {
    const raw = sessionStorage.getItem(authKey(proxyId))
    if (!raw) {
      return { token: '', scheme: 'Bearer' }
    }

    const parsed = JSON.parse(raw) as AuthState
    return {
      token: parsed.token ?? '',
      scheme: parsed.scheme === 'Raw' ? 'Raw' : 'Bearer',
    }
  } catch {
    return { token: '', scheme: 'Bearer' }
  }
}

interface Props {
  proxyId: string
  destination: string
  pathPrefix?: string | null
  onOpenLog: (id: number) => void
}

export function ManualSendPanel({ proxyId, destination, pathPrefix, onOpenLog }: Props) {
  const [protocol, setProtocol] = useState<'rest' | 'soap'>('rest')
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('/')
  const [query, setQuery] = useState('')
  const [headers, setHeaders] = useState<HeaderRow[]>([{ id: 1, name: '', value: '' }])
  const [body, setBody] = useState('')
  const [soapAction, setSoapAction] = useState('')
  const [contentType, setContentType] = useState('application/json')
  const [auth, setAuth] = useState<AuthState>(() => readAuth(proxyId))
  const [result, setResult] = useState<LogDetailDto | null>(null)
  const [send, sendState] = useSendManualRequestMutation()

  useEffect(() => {
    setAuth(readAuth(proxyId))
    setResult(null)
  }, [proxyId])

  useEffect(() => {
    sessionStorage.setItem(authKey(proxyId), JSON.stringify(auth))
  }, [auth, proxyId])

  useEffect(() => {
    if (protocol === 'soap') {
      setMethod('POST')
      setContentType((current) => (current === 'application/json' ? 'text/xml; charset=utf-8' : current))
      setBody((current) => (current.trim() === '' ? soapTemplate : current))
      return
    }

    setContentType((current) => (current.startsWith('text/xml') ? 'application/json' : current))
  }, [protocol])

  const nextHeaderId = useMemo(() => headers.reduce((max, row) => Math.max(max, row.id), 0) + 1, [headers])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const outgoing: Record<string, string> = {}
    for (const row of headers) {
      if (row.name.trim()) {
        outgoing[row.name.trim()] = row.value
      }
    }

    if (contentType.trim()) {
      outgoing['Content-Type'] = contentType.trim()
    }

    if (protocol === 'soap' && soapAction.trim()) {
      outgoing.SOAPAction = `"${soapAction.trim().replace(/^"+|"+$/g, '')}"`
    }

    if (protocol === 'rest' && auth.token.trim()) {
      const token = auth.token.trim()
      outgoing.Authorization =
        auth.scheme === 'Bearer' && !/^bearer\s/i.test(token) ? `Bearer ${token}` : token
    }

    const log = await send({
      proxyId,
      body: {
        method,
        path,
        query: query.trim() || null,
        headers: outgoing,
        body: body.trim() === '' ? null : body,
        protocol,
      },
    }).unwrap()
    setResult(log)
  }

  return (
    <>
      <p className="text-secondary">
        Sends directly to <code>{destination}</code>
        {pathPrefix ? (
          <>
            {' '}
            (listen prefix <code>{pathPrefix}</code> is stripped)
          </>
        ) : null}
        . The request is logged as Manual.
      </p>
      <Nav variant="pills" activeKey={protocol} onSelect={(key) => setProtocol((key as 'rest' | 'soap') ?? 'rest')} className="mb-3">
        <Nav.Item>
          <Nav.Link eventKey="rest">REST</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="soap">SOAP</Nav.Link>
        </Nav.Item>
      </Nav>
      <Form onSubmit={submit}>
        <Row className="g-3">
          <Col md={2}>
            <Form.Group>
              <Form.Label>Method</Form.Label>
              <Form.Select value={method} onChange={(event) => setMethod(event.target.value)} disabled={protocol === 'soap'}>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Path</Form.Label>
              <Form.Control value={path} onChange={(event) => setPath(event.target.value)} placeholder="/resource" />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label>Query</Form.Label>
              <Form.Control value={query} onChange={(event) => setQuery(event.target.value)} placeholder="id=1&active=true" />
            </Form.Group>
          </Col>
          {protocol === 'rest' && (
            <Col xs={12}>
              <Card className="border-primary-subtle">
                <Card.Header>Authentication</Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Scheme</Form.Label>
                        <Form.Select
                          value={auth.scheme}
                          onChange={(event) =>
                            setAuth({ ...auth, scheme: event.target.value === 'Raw' ? 'Raw' : 'Bearer' })
                          }
                        >
                          <option value="Bearer">Bearer</option>
                          <option value="Raw">Raw header value</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={9}>
                      <Form.Group>
                        <Form.Label>Token</Form.Label>
                        <Form.Control
                          type="password"
                          autoComplete="off"
                          value={auth.token}
                          onChange={(event) => setAuth({ ...auth, token: event.target.value })}
                          placeholder={auth.scheme === 'Bearer' ? 'eyJ...' : 'Bearer eyJ...'}
                        />
                        <Form.Text>
                          Sent as the Authorization header. Kept in this browser tab only.
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          )}
          {protocol === 'soap' && (
            <Col md={6}>
              <Form.Group>
                <Form.Label>SOAPAction</Form.Label>
                <Form.Control
                  value={soapAction}
                  onChange={(event) => setSoapAction(event.target.value)}
                  placeholder="GetAccount"
                />
              </Form.Group>
            </Col>
          )}
          <Col md={protocol === 'soap' ? 6 : 12}>
            <Form.Group>
              <Form.Label>Content type</Form.Label>
              <Form.Control value={contentType} onChange={(event) => setContentType(event.target.value)} />
            </Form.Group>
          </Col>
          <Col xs={12}>
            <Form.Label>Headers</Form.Label>
            {headers.map((row) => (
              <InputGroup className="mb-2" key={row.id}>
                <Form.Control
                  placeholder="Name"
                  value={row.name}
                  onChange={(event) =>
                    setHeaders(headers.map((item) => (item.id === row.id ? { ...item, name: event.target.value } : item)))
                  }
                />
                <Form.Control
                  placeholder="Value"
                  value={row.value}
                  onChange={(event) =>
                    setHeaders(headers.map((item) => (item.id === row.id ? { ...item, value: event.target.value } : item)))
                  }
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => setHeaders(headers.filter((item) => item.id !== row.id))}
                  disabled={headers.length === 1}
                >
                  Remove
                </Button>
              </InputGroup>
            ))}
            <Button variant="outline-secondary" size="sm" onClick={() => setHeaders([...headers, { id: nextHeaderId, name: '', value: '' }])}>
              Add header
            </Button>
          </Col>
          <Col xs={12}>
            <Form.Group>
              <Form.Label>{protocol === 'soap' ? 'SOAP envelope' : 'Body'}</Form.Label>
              <Form.Control
                as="textarea"
                rows={protocol === 'soap' ? 10 : 6}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </Form.Group>
          </Col>
          <Col xs={12}>
            <Button type="submit" disabled={sendState.isLoading}>
              {sendState.isLoading ? 'Sending…' : 'Send'}
            </Button>
          </Col>
        </Row>
      </Form>
      {sendState.isError && (
        <Alert variant="danger" className="mt-3">
          Could not send the request.
        </Alert>
      )}
      {result && (
        <Card className="mt-4">
          <Card.Header>
            <Stack direction="horizontal" gap={2} className="flex-wrap">
              <Badge bg={protocolBadge(result.protocol).bg} text={protocolBadge(result.protocol).text}>
                {protocolBadge(result.protocol).label}
              </Badge>
              <Badge bg="success">Manual</Badge>
              <Badge bg={result.statusCode && result.statusCode < 400 ? 'success' : 'danger'}>
                {result.statusCode ?? '-'}
              </Badge>
              <span>{result.durationMs} ms</span>
              {result.error && <Badge bg="danger">{result.error}</Badge>}
              <div className="ms-auto">
                <Button variant="outline-primary" size="sm" onClick={() => onOpenLog(result.id)}>
                  Open log
                </Button>
              </div>
            </Stack>
          </Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col lg={6}>
                <Stack direction="horizontal" className="mb-2">
                  <strong>Request body</strong>
                  <div className="ms-auto">
                    <CopyButton value={result.requestBody ?? ''} label="Copy" />
                  </div>
                </Stack>
                <pre className="border rounded p-2 mb-0">{result.requestBody || '(empty)'}</pre>
              </Col>
              <Col lg={6}>
                <Stack direction="horizontal" className="mb-2">
                  <strong>Response body</strong>
                  <div className="ms-auto">
                    <CopyButton value={result.responseBody ?? ''} label="Copy" />
                  </div>
                </Stack>
                <pre className="border rounded p-2 mb-0">{result.responseBody || result.error || '(empty)'}</pre>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
    </>
  )
}
