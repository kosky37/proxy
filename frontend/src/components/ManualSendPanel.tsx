import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Nav, Row, Stack } from 'react-bootstrap'
import { modeClass, statusClass } from '../logColors'
import { protocolBadge } from '../protocolBadge'
import { useSendManualRequestMutation } from '../store/proxyApi'
import type { LogDetailDto } from '../store/types'
import type { SendDraft } from '../headers'
import { CopyButton } from './CopyButton'
import { HeaderEditor } from './HeaderEditor'
import { ContentTypeTypeahead, MethodTypeahead } from './TypeaheadFields'

const soapTemplate = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
  </s:Body>
</s:Envelope>`

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

function authFromHeader(value: string): AuthState {
  if (/^bearer\s/i.test(value)) {
    return { scheme: 'Bearer', token: value.replace(/^bearer\s+/i, '') }
  }

  return { scheme: 'Raw', token: value }
}

interface Props {
  proxyId: string
  destination: string
  pathPrefix?: string | null
  draft?: SendDraft | null
  onDraftConsumed?: () => void
  onOpenLog: (id: number) => void
}

export function ManualSendPanel({ proxyId, destination, pathPrefix, draft, onDraftConsumed, onOpenLog }: Props) {
  const [protocol, setProtocol] = useState<'rest' | 'soap'>('rest')
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('/')
  const [query, setQuery] = useState('')
  const [headers, setHeaders] = useState<Record<string, string> | null>(null)
  const [headerResetKey, setHeaderResetKey] = useState('blank')
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
    if (!draft) {
      return
    }

    setProtocol(draft.protocol)
    setMethod(draft.method)
    setPath(draft.path)
    setQuery(draft.query)
    setHeaders(draft.headers)
    setHeaderResetKey(`draft-${draft.method}-${draft.path}-${Date.now()}`)
    setBody(draft.body)
    setSoapAction(draft.soapAction)
    setContentType(draft.contentType)
    if (draft.authorization.trim()) {
      setAuth(authFromHeader(draft.authorization))
    }
    setResult(null)
    onDraftConsumed?.()
  }, [draft])

  useEffect(() => {
    if (protocol === 'soap') {
      setMethod('POST')
      setContentType((current) => (current === 'application/json' ? 'text/xml; charset=utf-8' : current))
      setBody((current) => (current.trim() === '' ? soapTemplate : current))
      return
    }

    setContentType((current) => (current.startsWith('text/xml') ? 'application/json' : current))
  }, [protocol])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const outgoing: Record<string, string> = { ...(headers ?? {}) }

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
              <MethodTypeahead
                id="send-method"
                selected={[method]}
                disabled={protocol === 'soap'}
                onChange={(methods) => setMethod(methods[0] ?? 'GET')}
              />
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
              <ContentTypeTypeahead id="send-content-type" value={contentType} onChange={setContentType} />
            </Form.Group>
          </Col>
          <Col xs={12}>
            <HeaderEditor
              id="send-headers"
              resetKey={`${proxyId}:${headerResetKey}`}
              label="Headers"
              help="Additional request headers. Content-Type, SOAPAction, and Authorization are set in the fields above when those apply."
              value={headers}
              onChange={setHeaders}
              collapsible
            />
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
              <span className={`badge ${modeClass('manual')}`}>Manual</span>
              <span className={`badge ${statusClass(result.statusCode)}`}>{result.statusCode ?? '-'}</span>
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
