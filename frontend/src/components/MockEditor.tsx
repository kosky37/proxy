import { useEffect, useState, type FormEvent } from 'react'
import { Button, Col, Form, InputGroup, Modal, Row } from 'react-bootstrap'
import type { MockDto, MockMatchDto } from '../store/types'
import { FieldLabel, pathModeHelp } from './FieldHelp'
import { HeaderEditor } from './HeaderEditor'
import { ContentTypeTypeahead, MethodTypeahead } from './TypeaheadFields'

const blank = (type: string): MockDto => ({
  name: '',
  fileName: '',
  enabled: true,
  type,
  match: { pathMode: 'exact', methods: type === 'rest' ? ['GET'] : ['POST'] },
  response: { statusCode: 200, delayMs: 0, contentType: type === 'soap' ? 'text/xml' : 'application/json' },
})

interface Props {
  show: boolean
  initial?: MockDto | null
  defaultType: string
  isNew?: boolean
  onSave: (mock: MockDto) => Promise<void>
  onCancel: () => void
}

export function MockEditor({ show, initial, defaultType, isNew = true, onSave, onCancel }: Props) {
  const [mock, setMock] = useState<MockDto>(initial ?? blank(defaultType))
  const [useDelay, setUseDelay] = useState(false)
  const [useHeaderMatch, setUseHeaderMatch] = useState(false)
  const [useAdvanced, setUseAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (show) {
      const next = initial ?? blank(defaultType)
      setMock(next)
      setUseDelay((next.response.delayMs ?? 0) > 0)
      setUseHeaderMatch(hasHeaderMatch(next.match))
      setUseAdvanced(hasExtraFilters(next.match))
    }
  }, [defaultType, initial, show])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave({
        ...mock,
        match: persistMatch(mock.match, mock.type === 'soap', useAdvanced, useHeaderMatch),
        response: {
          ...mock.response,
          delayMs: useDelay ? mock.response.delayMs : 0,
        },
      })
    } finally {
      setSaving(false)
    }
  }

  const isSoap = mock.type === 'soap'
  const headerResetKey = `${show}:${initial?.name ?? 'new'}:${initial?.fileName ?? ''}:${initial?.type ?? defaultType}`

  return (
    <Modal show={show} onHide={onCancel} size="lg" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{!isNew && initial?.name ? `Edit ${initial.name}` : 'New mock'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form id="mock-form" onSubmit={submit}>
          <Row className="g-3">
            <Col md={4}>
              <Form.Group>
                <FieldLabel help="REST matches HTTP APIs. SOAP matches XML envelope requests, usually with a SOAPAction header.">
                  Type
                </FieldLabel>
                <Form.Select
                  value={mock.type}
                  onChange={(event) => {
                    const type = event.target.value
                    setMock({
                      ...mock,
                      type,
                      match:
                        type === 'soap'
                          ? { ...mock.match, path: null, pathMode: 'exact' }
                          : mock.match,
                    })
                  }}
                >
                  <option value="rest">REST</option>
                  <option value="soap">SOAP</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={5}>
              <Form.Group>
                <FieldLabel help="Shown in the mock list and in request logs when this mock answers.">
                  Name
                </FieldLabel>
                <Form.Control
                  required
                  value={mock.name}
                  onChange={(event) => setMock({ ...mock, name: event.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={3} className="d-flex align-items-end pb-1">
              <Form.Check
                type="switch"
                id="mock-enabled"
                label="Enabled"
                checked={mock.enabled}
                onChange={(event) => setMock({ ...mock, enabled: event.target.checked })}
              />
            </Col>

            <Col xs={12}>
              <div className="editor-section-title">Match</div>
            </Col>
            {isSoap ? (
              <Col xs={12}>
                <Form.Group>
                  <FieldLabel help='Value of the SOAPAction header. This is how the mock is selected; the URL path is ignored. Examples: GetAccount or "http://example.com/GetAccount".'>
                    SOAPAction
                  </FieldLabel>
                  <Form.Control
                    required
                    value={mock.match.soapAction ?? ''}
                    onChange={(event) =>
                      setMock({ ...mock, match: { ...mock.match, soapAction: event.target.value } })
                    }
                  />
                </Form.Group>
              </Col>
            ) : (
              <>
                <Col md={4}>
                  <Form.Group>
                    <FieldLabel help="The URL path after the host. Leave empty to match any path. Example: /accounts">
                      Path
                    </FieldLabel>
                    <Form.Control
                      placeholder="/accounts"
                      value={mock.match.path ?? ''}
                      onChange={(event) => setMock({ ...mock, match: { ...mock.match, path: event.target.value } })}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <FieldLabel help={pathModeHelp}>Path mode</FieldLabel>
                    <Form.Select
                      value={mock.match.pathMode}
                      onChange={(event) => setMock({ ...mock, match: { ...mock.match, pathMode: event.target.value } })}
                    >
                      <option value="exact">exact — this path only</option>
                      <option value="prefix">prefix — this path and below</option>
                      <option value="template">template — {`{placeholders}`}</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <FieldLabel help="HTTP methods this mock accepts. Leave empty to match any method.">
                      Methods
                    </FieldLabel>
                    <MethodTypeahead
                      id="mock-methods"
                      multiple
                      selected={mock.match.methods ?? []}
                      onChange={(methods) => setMock({ ...mock, match: { ...mock.match, methods } })}
                      placeholder="Any method"
                    />
                  </Form.Group>
                </Col>
              </>
            )}
            <Col xs={12}>
              <Form.Check
                type="switch"
                id="mock-header-match"
                label="Match by headers"
                checked={useHeaderMatch}
                onChange={(event) => setUseHeaderMatch(event.target.checked)}
              />
              <Form.Text>Require these request headers. Names and values are case-insensitive.</Form.Text>
            </Col>
            {useHeaderMatch && (
              <Col xs={12}>
                <HeaderEditor
                  id="mock-match-headers"
                  resetKey={`${headerResetKey}:match`}
                  label="Request headers"
                  help="The request must include these headers with these values. Names and values are case-insensitive."
                  value={mock.match.headers}
                  onChange={(headers) => setMock({ ...mock, match: { ...mock.match, headers } })}
                />
              </Col>
            )}

            <Col xs={12}>
              <Form.Check
                type="switch"
                id="mock-advanced"
                label="Advanced matching"
                checked={useAdvanced}
                onChange={(event) => setUseAdvanced(event.target.checked)}
              />
              <Form.Text>
                {isSoap ? 'Match on the SOAP body as well as SOAPAction.' : 'Match on the request body as well as the path.'}
              </Form.Text>
            </Col>
            {useAdvanced && !isSoap && (
              <>
                <Col xs={12}>
                  <Form.Group>
                    <FieldLabel help='Plain text search in the raw body. No JSON or XML parsing. Case is ignored. Example: "status":"open"'>
                      Body contains
                    </FieldLabel>
                    <Form.Control
                      value={mock.match.bodyContains ?? ''}
                      onChange={(event) =>
                        setMock({ ...mock, match: { ...mock.match, bodyContains: event.target.value } })
                      }
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <FieldLabel help='For JSON bodies only. JSONPath picks a value out of JSON. $.user.id with 42 matches {"user":{"id":42}}. Leave the value empty to only require that the path exists.'>
                      JSON path equals
                    </FieldLabel>
                    <InputGroup>
                      <Form.Control
                        placeholder="$.user.id"
                        value={mock.match.jsonPath ?? ''}
                        onChange={(event) =>
                          setMock({ ...mock, match: { ...mock.match, jsonPath: event.target.value } })
                        }
                      />
                      <Form.Control
                        placeholder="42"
                        value={mock.match.jsonPathEquals ?? ''}
                        onChange={(event) =>
                          setMock({ ...mock, match: { ...mock.match, jsonPathEquals: event.target.value } })
                        }
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <FieldLabel help="For XML bodies only. XPath is a query into the XML. The mock matches when the query finds something. Examples: //Account (that element exists), //AccountId[text()='42'] (that element has this text).">
                      XML XPath
                    </FieldLabel>
                    <Form.Control
                      placeholder="//AccountId"
                      value={mock.match.xpath ?? ''}
                      onChange={(event) => setMock({ ...mock, match: { ...mock.match, xpath: event.target.value } })}
                    />
                  </Form.Group>
                </Col>
              </>
            )}
            {useAdvanced && isSoap && (
              <>
                <Col md={6}>
                  <Form.Group>
                    <FieldLabel help="Plain text search in the raw SOAP body. No XML parsing. Case is ignored. Example: AccountId>42">
                      Body contains
                    </FieldLabel>
                    <Form.Control
                      value={mock.match.bodyContains ?? ''}
                      onChange={(event) =>
                        setMock({ ...mock, match: { ...mock.match, bodyContains: event.target.value } })
                      }
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <FieldLabel help="The first child element inside the SOAP Body, i.e. the operation name. Example: GetAccount. Use this when SOAPAction is missing or unreliable. Requires parsing the XML.">
                      Operation
                    </FieldLabel>
                    <Form.Control
                      value={mock.match.operation ?? ''}
                      onChange={(event) =>
                        setMock({ ...mock, match: { ...mock.match, operation: event.target.value } })
                      }
                    />
                  </Form.Group>
                </Col>
                <Col xs={12}>
                  <Form.Group>
                    <FieldLabel help="For the SOAP XML envelope. XPath is a query into the XML. The mock matches when the query finds something. Examples: //GetAccount (that element exists), //AccountId[text()='42'] (that element has this text). Requires parsing the XML.">
                      XML XPath
                    </FieldLabel>
                    <Form.Control
                      placeholder="//GetAccount"
                      value={mock.match.xpath ?? ''}
                      onChange={(event) => setMock({ ...mock, match: { ...mock.match, xpath: event.target.value } })}
                    />
                  </Form.Group>
                </Col>
              </>
            )}

            <Col xs={12}>
              <div className="editor-section-title">Response</div>
            </Col>
            <Col xs={12}>
              <Form.Check
                type="switch"
                id="mock-block"
                label="Block request (do not respond)"
                checked={mock.response.block ?? false}
                onChange={(event) =>
                  setMock({ ...mock, response: { ...mock.response, block: event.target.checked } })
                }
              />
              {mock.response.block && (
                <Form.Text>The client waits until it times out. Status and body are not sent.</Form.Text>
              )}
            </Col>
            <Col md={3}>
              <Form.Group>
                <FieldLabel help="HTTP status sent back to the client. Ignored when the request is blocked. Example: 200 or 404.">
                  Status
                </FieldLabel>
                <Form.Control
                  type="number"
                  value={mock.response.statusCode}
                  onChange={(event) =>
                    setMock({ ...mock, response: { ...mock.response, statusCode: Number(event.target.value) } })
                  }
                />
              </Form.Group>
            </Col>
            <Col md={5}>
              <Form.Group>
                <FieldLabel help="Content-Type of the mocked response. Pick a common type or type your own.">
                  Content type
                </FieldLabel>
                <ContentTypeTypeahead
                  id="mock-content-type"
                  value={mock.response.contentType}
                  onChange={(contentType) =>
                    setMock({ ...mock, response: { ...mock.response, contentType } })
                  }
                />
              </Form.Group>
            </Col>
            <Col md={4} className="d-flex align-items-end pb-1">
              <Form.Check
                type="switch"
                id="mock-delay"
                label="Delay response"
                checked={useDelay}
                onChange={(event) => {
                  const enabled = event.target.checked
                  setUseDelay(enabled)
                  if (enabled && (mock.response.delayMs ?? 0) <= 0) {
                    setMock({ ...mock, response: { ...mock.response, delayMs: 250 } })
                  }
                }}
              />
            </Col>
            {useDelay && (
              <Col md={4}>
                <Form.Group>
                  <FieldLabel help="Wait this many milliseconds before sending the response. Use it to simulate a slow service. Example: 250.">
                    Delay ms
                  </FieldLabel>
                  <Form.Control
                    type="number"
                    min={0}
                    value={mock.response.delayMs}
                    onChange={(event) =>
                      setMock({ ...mock, response: { ...mock.response, delayMs: Number(event.target.value) } })
                    }
                  />
                </Form.Group>
              </Col>
            )}
            <Col xs={12}>
              <HeaderEditor
                id="mock-response-headers"
                resetKey={`${headerResetKey}:response`}
                label="Response headers"
                help="Extra headers sent with the mocked response. Content-Type is set above; you can still override it here."
                value={mock.response.headers}
                onChange={(headers) => setMock({ ...mock, response: { ...mock.response, headers } })}
                collapsible
              />
            </Col>
            <Col xs={12}>
              <Form.Group>
                <FieldLabel help="The body sent back to the client. For REST this is often JSON; for SOAP it is the XML envelope.">
                  Response body
                </FieldLabel>
                <Form.Control
                  as="textarea"
                  rows={6}
                  value={mock.response.body ?? ''}
                  onChange={(event) =>
                    setMock({ ...mock, response: { ...mock.response, body: event.target.value } })
                  }
                />
              </Form.Group>
            </Col>
          </Row>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" form="mock-form" disabled={saving}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

function hasHeaderMatch(match: MockMatchDto): boolean {
  return Boolean(match.headers && Object.keys(match.headers).length > 0)
}

function persistMatch(
  match: MockMatchDto,
  isSoap: boolean,
  useAdvanced: boolean,
  useHeaderMatch: boolean,
): MockMatchDto {
  const next = {
    ...(useAdvanced ? match : basicMatch(match)),
    headers: useHeaderMatch ? match.headers : null,
  }
  if (!isSoap) {
    return next
  }

  return {
    ...next,
    path: null,
    pathMode: 'exact',
    methods: null,
    query: null,
  }
}

function hasExtraFilters(match: MockMatchDto): boolean {
  if (match.query && Object.keys(match.query).length > 0) {
    return true
  }

  return Boolean(match.bodyContains || match.bodyRegex || match.jsonPath || match.jsonPathEquals || match.operation || match.xpath)
}

function basicMatch(match: MockMatchDto): MockMatchDto {
  return {
    ...match,
    query: null,
    bodyContains: null,
    bodyRegex: null,
    jsonPath: null,
    jsonPathEquals: null,
    operation: null,
    xpath: null,
  }
}
