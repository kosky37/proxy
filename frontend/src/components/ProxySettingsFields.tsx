import { Card, Col, Form, Input, InputNumber, Row, Select, Switch, Typography } from "antd";
import { Link } from "react-router-dom";
import type { CertificateDto, UpsertProxyRequest } from "../store/types";
import { FieldHelp } from "./FieldHelp";

interface Props {
  form: UpsertProxyRequest;
  onChange: (next: UpsertProxyRequest) => void;
  certificates?: CertificateDto[];
  showId?: boolean;
  showAdvanced?: boolean;
}

export function ProxySettingsFields({
  form,
  onChange,
  certificates = [],
  showId = false,
  showAdvanced = true,
}: Props) {
  const set = (patch: Partial<UpsertProxyRequest>) => onChange({ ...form, ...patch });
  const serverCerts = certificates.filter((item) => item.type === "server");
  const clientCerts = certificates.filter((item) => item.type === "client");

  const certificateLink = (
    <Typography.Text className="app-subtle">
      Defined on the <Link to="/certificates">Certificates</Link> page.
    </Typography.Text>
  );

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Card size="small" title="Proxy">
          <Row gutter={[16, 8]}>
            {showId && (
              <Col xs={24} md={8}>
                <Form.Item
                  label="Id"
                  help="Leave empty to derive it from the name."
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    placeholder="folder-name"
                    value={form.id ?? ""}
                    onChange={(event) => set({ id: event.target.value })}
                  />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} md={showId ? 10 : 16}>
              <Form.Item label="Name" required style={{ marginBottom: 0 }}>
                <Input
                  value={form.name}
                  onChange={(event) => set({ name: event.target.value })}
                />
              </Form.Item>
            </Col>
            {showAdvanced && (
              <Col xs={24} md={showId ? 6 : 8}>
                <Form.Item label="Enabled" style={{ marginBottom: 0 }}>
                  <Switch
                    checked={form.enabled}
                    onChange={(enabled) => set({ enabled })}
                  />
                </Form.Item>
              </Col>
            )}
          </Row>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card size="small" title="Listen" style={{ height: "100%" }}>
          <Form.Item
            label="Listen URL"
            required
            help="Scheme, host, and port this proxy binds, e.g. https://127.0.0.1:8085."
          >
            <Input
              value={form.listen.url}
              onChange={(event) => set({ listen: { ...form.listen, url: event.target.value } })}
            />
          </Form.Item>
          <Form.Item
            label="Path prefix"
            help="Optional. Share a port by giving each proxy a different prefix. It is removed before the request is forwarded."
          >
            <Input
              placeholder="/api"
              value={form.listen.pathPrefix ?? ""}
              onChange={(event) =>
                set({ listen: { ...form.listen, pathPrefix: event.target.value || null } })
              }
            />
          </Form.Item>
          <Form.Item
            label={
              <span className="app-row" style={{ gap: 6 }}>
                <span>Server certificate</span>
                <FieldHelp text="HTTPS certificate for this listener. Used when the listen URL scheme is https." />
              </span>
            }
            help={certificateLink}
          >
            <Select
              style={{ width: "100%" }}
              value={form.listen.serverCertificateId ?? ""}
              onChange={(value) =>
                set({ listen: { ...form.listen, serverCertificateId: value || null } })
              }
              options={[
                { value: "", label: "None" },
                ...serverCerts.map((item) => ({ value: item.name, label: item.name })),
              ]}
            />
          </Form.Item>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card size="small" title="Destination" style={{ height: "100%" }}>
          <Form.Item
            label="Destination URL"
            required
            help="Upstream service used when no mock matches."
          >
            <Input
              value={form.destination.address}
              onChange={(event) =>
                set({ destination: { ...form.destination, address: event.target.value } })
              }
            />
          </Form.Item>
          {showAdvanced && (
            <Form.Item
              label="Passthrough delay ms"
              help="Optional wait before forwarding an unmatched request."
            >
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                value={form.passthroughDelayMs}
                onChange={(value) => set({ passthroughDelayMs: Number(value ?? 0) })}
              />
            </Form.Item>
          )}
          <Form.Item
            label={
              <span className="app-row" style={{ gap: 6 }}>
                <span>Client certificate</span>
                <FieldHelp text="Presented to the destination when this proxy calls it." />
              </span>
            }
            help={certificateLink}
          >
            <Select
              style={{ width: "100%" }}
              value={form.destination.clientCertificateId ?? ""}
              onChange={(value) =>
                set({ destination: { ...form.destination, clientCertificateId: value || null } })
              }
              options={[
                { value: "", label: "None" },
                ...clientCerts.map((item) => ({ value: item.name, label: item.name })),
              ]}
            />
          </Form.Item>
          <Form.Item label="Accept any server certificate" style={{ marginBottom: 0 }}>
            <Switch
              checked={form.destination.acceptAnyServerCertificate}
              onChange={(acceptAnyServerCertificate) =>
                set({
                  destination: { ...form.destination, acceptAnyServerCertificate },
                })
              }
            />
          </Form.Item>
        </Card>
      </Col>

      {showAdvanced && (
        <Col span={24}>
          <Card size="small" title="Logs">
            <Row gutter={[16, 8]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Retention (days)"
                  help="0 keeps logs forever; older entries are deleted automatically."
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber
                    min={0}
                    style={{ width: "100%" }}
                    value={form.logRetentionDays ?? 7}
                    onChange={(value) => set({ logRetentionDays: Number(value ?? 0) })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Max logged body (KB)"
                  help="Bodies larger than this are not stored; only the original size is logged."
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber
                    min={1}
                    style={{ width: "100%" }}
                    value={Math.round((form.bodyLogLimitBytes ?? 1_048_576) / 1024)}
                    onChange={(value) =>
                      set({ bodyLogLimitBytes: Math.max(1, Number(value ?? 1)) * 1024 })
                    }
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Col>
      )}
    </Row>
  );
}
