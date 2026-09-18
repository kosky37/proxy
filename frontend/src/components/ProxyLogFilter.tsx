import { Badge, Button, Col, Collapse, Input, Row, Select, Space } from "antd";
import { useState } from "react";
import { FieldLabel, type HelpContent } from "./FieldHelp";

export interface LogFilter {
  path: string;
  soapAction: string;
  body: string;
  mode: string;
  protocol: string;
}

export const emptyLogFilter: LogFilter = {
  path: "",
  soapAction: "",
  body: "",
  mode: "",
  protocol: "",
};

export function activeFilterCount(filter: LogFilter): number {
  return Object.values(filter).filter(Boolean).length;
}

const help: Record<"path" | "soapAction" | "body" | "mode" | "protocol", HelpContent> = {
  path: "Substring match on the request path, query string excluded.",
  soapAction:
    "Substring match on the `SOAPAction` header. Leave empty to match any action.",
  body:
    "Substring match on the stored request or response body.\n- Only the first part of a large body is stored, so a match late in the payload can be missed.",
  mode: "How the request was answered.",
  protocol: "Payload type detected from the request body and headers.",
};

interface Props {
  filter: LogFilter;
  onChange: (next: LogFilter) => void;
  onClear: () => void;
}

export function ProxyLogFilter({ filter, onChange, onClear }: Props) {
  const count = activeFilterCount(filter);
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<LogFilter>) => onChange({ ...filter, ...patch });

  return (
    <div className="app-panel app-filter-panel" style={{ marginBottom: 12 }}>
      <Collapse
        ghost
        activeKey={open ? ["filters"] : []}
        onChange={(keys) => setOpen(keys.length > 0)}
        items={[
          {
            key: "filters",
            label: (
              <Space size={8}>
                <strong>Filters</strong>
                {count > 0 ? <Badge count={count} color="var(--log-mode-mock)" /> : null}
              </Space>
            ),
            extra: (
              <Button
                size="small"
                type="link"
                disabled={count === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  onClear();
                }}
              >
                Clear
              </Button>
            ),
            children: (
              <Row gutter={[16, 8]}>
                <Col xs={24} md={8}>
                  <FieldLabel help={help.path}>Path contains</FieldLabel>
                  <Input
                    style={{ marginTop: 4 }}
                    value={filter.path}
                    onChange={(event) => set({ path: event.target.value })}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <FieldLabel help={help.soapAction}>SOAPAction contains</FieldLabel>
                  <Input
                    style={{ marginTop: 4 }}
                    value={filter.soapAction}
                    onChange={(event) => set({ soapAction: event.target.value })}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <FieldLabel help={help.body}>Body contains</FieldLabel>
                  <Input
                    style={{ marginTop: 4 }}
                    value={filter.body}
                    onChange={(event) => set({ body: event.target.value })}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <FieldLabel help={help.mode}>Mode</FieldLabel>
                  <Select
                    style={{ width: "100%", marginTop: 4 }}
                    value={filter.mode || ""}
                    onChange={(mode) => set({ mode })}
                    options={[
                      { value: "", label: "Any mode" },
                      { value: "mock", label: "Answered by a mock" },
                      { value: "passthrough", label: "Forwarded to the destination" },
                      { value: "manual", label: "Sent from the Send tab" },
                    ]}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <FieldLabel help={help.protocol}>Type</FieldLabel>
                  <Select
                    style={{ width: "100%", marginTop: 4 }}
                    value={filter.protocol || ""}
                    onChange={(protocol) => set({ protocol })}
                    options={[
                      { value: "", label: "Any type" },
                      { value: "json", label: "JSON" },
                      { value: "xml", label: "XML" },
                      { value: "soap", label: "SOAP" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  );
}
