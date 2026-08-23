import { useEffect, useState, type FormEvent } from 'react'
import { Button, Col, Form, InputGroup, Modal, Row } from 'react-bootstrap'
import type { MockDto } from '../store/types'

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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (show) {
      setMock(initial ?? blank(defaultType))
    }
  }, [defaultType, initial, show])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave(mock)
    } finally {
      setSaving(false)
    }
  }

  const isSoap = mock.type === 'soap'

  return (
    <Modal show={show} onHide={onCancel} size="lg" scrollable>
      <Form onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title>{!isNew && initial?.name ? `Edit ${initial.name}` : 'New mock'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={3}>
              <Form.Group>
                <Form.Label>Type</Form.Label>
                <Form.Select
                  value={mock.type}
                  onChange={(event) => setMock({ ...mock, type: event.target.value })}
                >
                  <option value="rest">REST</option>
                  <option value="soap">SOAP</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control
                  required
                  value={mock.name}
                  onChange={(event) => setMock({ ...mock, name: event.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Status</Form.Label>
                <Form.Control
                  type="number"
                  value={mock.response.statusCode}
                  onChange={(event) =>
                    setMock({ ...mock, response: { ...mock.response, statusCode: Number(event.target.value) } })
                  }
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Delay ms</Form.Label>
                <Form.Control
                  type="number"
                  value={mock.response.delayMs}
                  onChange={(event) =>
                    setMock({ ...mock, response: { ...mock.response, delayMs: Number(event.target.value) } })
                  }
                />
              </Form.Group>
            </Col>
            <Col md={2} className="d-flex align-items-end">
              <Form.Check
                type="switch"
                label="Enabled"
                checked={mock.enabled}
                onChange={(event) => setMock({ ...mock, enabled: event.target.checked })}
              />
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
            <Col md={4}>
              <Form.Group>
                <Form.Label>Path</Form.Label>
                <Form.Control
                  value={mock.match.path ?? ''}
                  onChange={(event) => setMock({ ...mock, match: { ...mock.match, path: event.target.value } })}
                />
              </Form.Group>
            </Col>
            {!isSoap && (
              <>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Methods (comma)</Form.Label>
                    <Form.Control
                      value={(mock.match.methods ?? []).join(',')}
                      onChange={(event) =>
                        setMock({
                          ...mock,
                          match: {
                            ...mock.match,
                            methods: event.target.value
                              .split(',')
                              .map((item) => item.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Path mode</Form.Label>
                    <Form.Select
                      value={mock.match.pathMode}
                      onChange={(event) => setMock({ ...mock, match: { ...mock.match, pathMode: event.target.value } })}
                    >
                      <option value="exact">exact</option>
                      <option value="prefix">prefix</option>
                      <option value="template">template</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Body contains</Form.Label>
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
                    <Form.Label>JSON path equals</Form.Label>
                    <InputGroup>
                      <Form.Control
                        placeholder="$.id"
                        value={mock.match.jsonPath ?? ''}
                        onChange={(event) => setMock({ ...mock, match: { ...mock.match, jsonPath: event.target.value } })}
                      />
                      <Form.Control
                        placeholder="value"
                        value={mock.match.jsonPathEquals ?? ''}
                        onChange={(event) =>
                          setMock({ ...mock, match: { ...mock.match, jsonPathEquals: event.target.value } })
                        }
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
              </>
            )}
            {isSoap && (
              <>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>SOAPAction</Form.Label>
                    <Form.Control
                      value={mock.match.soapAction ?? ''}
                      onChange={(event) =>
                        setMock({ ...mock, match: { ...mock.match, soapAction: event.target.value } })
                      }
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Operation</Form.Label>
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
                    <Form.Label>XPath</Form.Label>
                    <Form.Control
                      value={mock.match.xpath ?? ''}
                      onChange={(event) => setMock({ ...mock, match: { ...mock.match, xpath: event.target.value } })}
                    />
                  </Form.Group>
                </Col>
              </>
            )}
            <Col md={4}>
              <Form.Group>
                <Form.Label>Content type</Form.Label>
                <Form.Control
                  value={mock.response.contentType ?? ''}
                  onChange={(event) =>
                    setMock({ ...mock, response: { ...mock.response, contentType: event.target.value } })
                  }
                />
              </Form.Group>
            </Col>
            <Col md={8}>
              <Form.Group>
                <Form.Label>Body file</Form.Label>
                <Form.Control
                  value={mock.response.bodyFile ?? ''}
                  onChange={(event) =>
                    setMock({ ...mock, response: { ...mock.response, bodyFile: event.target.value } })
                  }
                />
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Response body</Form.Label>
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
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            Save
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
