import { Card, Col, Form, Row, Stack } from "react-bootstrap";
import { Link } from "react-router-dom";
import type { CertificateDto, UpsertProxyRequest } from "../store/types";

interface Props {
  form: UpsertProxyRequest;
  onChange: (next: UpsertProxyRequest) => void;
  certificates?: CertificateDto[];
  /** Show folder id field (create only). */
  showId?: boolean;
  /** Show enabled switch, delays, and log settings (edit / full settings). */
  showAdvanced?: boolean;
}

export function ProxySettingsFields({
  form,
  onChange,
  certificates = [],
  showId = false,
  showAdvanced = true,
}: Props) {
  const set = (next: UpsertProxyRequest) => onChange(next);
  const serverCerts = certificates.filter((item) => item.type === "server");
  const clientCerts = certificates.filter((item) => item.type === "client");

  return (
    <Stack gap={3}>
      <Card>
        <Card.Body>
          <h2 className="h6 mb-3">Proxy</h2>
          <Row className="g-3 align-items-end">
            {showId && (
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Id</Form.Label>
                  <Form.Control
                    value={form.id ?? ""}
                    placeholder="folder-name"
                    onChange={(event) => set({ ...form, id: event.target.value })}
                  />
                  <Form.Text>Leave empty to derive it from the name.</Form.Text>
                </Form.Group>
              </Col>
            )}
            <Col md={showId ? 5 : 8}>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control
                  required
                  value={form.name}
                  onChange={(event) => set({ ...form, name: event.target.value })}
                />
              </Form.Group>
            </Col>
            {showAdvanced && (
              <Col md={showId ? 3 : 4} className="d-flex align-items-end pb-2">
                <Form.Check
                  type="switch"
                  id="proxy-enabled"
                  label="Enabled"
                  checked={form.enabled}
                  onChange={(event) => set({ ...form, enabled: event.target.checked })}
                />
              </Col>
            )}
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
                    required
                    value={form.listen.url}
                    onChange={(event) =>
                      set({ ...form, listen: { ...form.listen, url: event.target.value } })
                    }
                  />
                  <Form.Text>Scheme, host, and port this proxy binds.</Form.Text>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Path prefix</Form.Label>
                  <Form.Control
                    value={form.listen.pathPrefix ?? ""}
                    placeholder="/api"
                    onChange={(event) =>
                      set({
                        ...form,
                        listen: { ...form.listen, pathPrefix: event.target.value || null },
                      })
                    }
                  />
                  <Form.Text>
                    Optional. Share a port by giving each proxy a different prefix. Removed before
                    the request is forwarded.
                  </Form.Text>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Server certificate</Form.Label>
                  <Form.Select
                    value={form.listen.serverCertificateId ?? ""}
                    onChange={(event) =>
                      set({
                        ...form,
                        listen: {
                          ...form.listen,
                          serverCertificateId: event.target.value || null,
                        },
                      })
                    }
                  >
                    <option value="">None</option>
                    {serverCerts.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text>
                    HTTPS certificate for this listener. Defined on the{" "}
                    <Link to="/certificates">Certificates</Link> page.
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
                    required
                    value={form.destination.address}
                    onChange={(event) =>
                      set({
                        ...form,
                        destination: { ...form.destination, address: event.target.value },
                      })
                    }
                  />
                  <Form.Text>Upstream service used when no mock matches.</Form.Text>
                </Form.Group>
                {showAdvanced && (
                  <Form.Group>
                    <Form.Label>Passthrough delay ms</Form.Label>
                    <Form.Control
                      type="number"
                      value={form.passthroughDelayMs}
                      onChange={(event) =>
                        set({ ...form, passthroughDelayMs: Number(event.target.value) })
                      }
                    />
                    <Form.Text>Optional wait before forwarding an unmatched request.</Form.Text>
                  </Form.Group>
                )}
                <Form.Group>
                  <Form.Label>Client certificate</Form.Label>
                  <Form.Select
                    value={form.destination.clientCertificateId ?? ""}
                    onChange={(event) =>
                      set({
                        ...form,
                        destination: {
                          ...form.destination,
                          clientCertificateId: event.target.value || null,
                        },
                      })
                    }
                  >
                    <option value="">None</option>
                    {clientCerts.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text>
                    Presented to the destination. Defined on the{" "}
                    <Link to="/certificates">Certificates</Link> page.
                  </Form.Text>
                </Form.Group>
                <Form.Check
                  type="switch"
                  id="accept-any-cert"
                  label="Accept any server certificate"
                  checked={form.destination.acceptAnyServerCertificate}
                  onChange={(event) =>
                    set({
                      ...form,
                      destination: {
                        ...form.destination,
                        acceptAnyServerCertificate: event.target.checked,
                      },
                    })
                  }
                />
              </Stack>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {showAdvanced && (
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
                    onChange={(event) =>
                      set({ ...form, logRetentionDays: Number(event.target.value) })
                    }
                  />
                  <Form.Text>
                    0 keeps logs forever. Older entries are deleted automatically.
                  </Form.Text>
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
                      set({
                        ...form,
                        bodyLogLimitBytes: Math.max(1, Number(event.target.value)) * 1024,
                      })
                    }
                  />
                  <Form.Text>
                    Bodies larger than this are not stored; only the original size is logged.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
    </Stack>
  );
}
