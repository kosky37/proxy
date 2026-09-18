import { Col, Divider, Input, InputNumber, Modal, Row, Segmented, Space, Switch, Typography } from "antd";
import { useEffect, useState } from "react";
import type { MockDto, MockMatchDto } from "../store/types";
import { HeaderEditor } from "./HeaderEditor";
import { FieldHelp, FieldLabel, pathModeHelp, type HelpDoc } from "./FieldHelp";
import { ContentTypeSelect, MethodSelect } from "./Selects";

const humanizeHelp: HelpDoc = {
  summary: "Plain text search in the raw body.",
  points: [
    { text: "No JSON or XML parsing and no case sensitivity." },
    { label: "REST example", code: '"status":"open"' },
    { label: "SOAP example", code: "<AccountId>42</AccountId>" },
  ],
};

const SOAP_ACTION_HELP: HelpDoc = {
  summary: "Selects the mock by the `SOAPAction` header.",
  points: [
    { text: "The URL path is ignored unless matching by URL is switched on below." },
  ],
  note: "Examples: GetAccount, or the full \"http://example.com/GetAccount\".",
};

const JSON_PATH_HELP: HelpDoc = {
  summary: "Compares one value inside a JSON body.",
  points: [
    { text: "The path is JSONPath; the value is compared as text." },
    { label: "Match", code: "$.user.id = 42  →  {\"user\":{\"id\":42}}" },
    { text: "Leave the value empty to only require that the path exists." },
  ],
};

const XML_XPATH_HELP: HelpDoc = {
  summary: "Matches when an XPath query finds something in an XML body.",
  points: [
    { label: "Exists", code: "//Account" },
    { label: "Has text", code: "//AccountId[text()='42']" },
  ],
};

const SOAP_OPERATION_HELP: HelpDoc = {
  summary: "The first element inside the SOAP Body, i.e. the operation name.",
  points: [{ label: "Example", code: "GetAccount" }],
  note: "Use it when SOAPAction is missing or unreliable. Requires parsing the XML envelope.",
};

const SOAP_XPATH_HELP: HelpDoc = {
  summary: "Matches when an XPath query finds something in the SOAP envelope.",
  points: [
    { label: "Exists", code: "//GetAccount" },
    { label: "Has text", code: "//AccountId[text()='42']" },
  ],
  note: "Requires parsing the XML envelope.",
};

const pathModeOptions = [
  { value: "exact", label: "exact — this path only" },
  { value: "prefix", label: "prefix — this path and below" },
  { value: "template", label: "template — {placeholders}" },
];

const blank = (type: string): MockDto => ({
  name: "",
  fileName: "",
  enabled: true,
  type,
  match: { pathMode: "exact", methods: type === "rest" ? ["GET"] : ["POST"] },
  response: {
    statusCode: 200,
    delayMs: 0,
    contentType: type === "soap" ? "text/xml" : "application/json",
  },
});

interface Props {
  open: boolean;
  initial?: MockDto | null;
  defaultType: string;
  isNew?: boolean;
  onSave: (mock: MockDto) => Promise<void>;
  onCancel: () => void;
}

export function MockEditor({ open, initial, defaultType, isNew = true, onSave, onCancel }: Props) {
  const [mock, setMock] = useState<MockDto>(initial ?? blank(defaultType));
  const [useDelay, setUseDelay] = useState(false);
  const [useHeaderMatch, setUseHeaderMatch] = useState(false);
  const [useUrlMatch, setUseUrlMatch] = useState(false);
  const [useAdvanced, setUseAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const next = initial ?? blank(defaultType);
    setMock(next);
    setUseDelay((next.response.delayMs ?? 0) > 0);
    setUseHeaderMatch(hasHeaderMatch(next.match));
    setUseUrlMatch(hasUrlMatch(next.match, next.type === "soap"));
    setUseAdvanced(hasExtraFilters(next.match, next.type === "soap"));
    setError(null);
  }, [defaultType, initial, open]);

  const isSoap = mock.type === "soap";
  const headerResetKey = `${open}:${initial?.name ?? "new"}:${initial?.fileName ?? ""}:${initial?.type ?? defaultType}`;
  const patch = (next: Partial<MockDto>) => setMock((current) => ({ ...current, ...next }));
  const patchMatch = (next: Partial<MockMatchDto>) =>
    setMock((current) => ({ ...current, match: { ...current.match, ...next } }));

  const submit = async () => {
    if (!mock.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (isSoap && !useAdvanced && !mock.match.soapAction?.trim()) {
      setError("SOAPAction is required unless advanced matching or URL matching is used.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...mock,
        match: persistMatch(mock.match, isSoap, useAdvanced, useHeaderMatch, useUrlMatch),
        response: { ...mock.response, delayMs: useDelay ? mock.response.delayMs : 0 },
      });
    } catch {
      setError("Could not save the mock.");
    } finally {
      setSaving(false);
    }
  };

  const queryText = mock.match.query
    ? Object.entries(mock.match.query)
        .map(([key, value]) => `${key}=${value}`)
        .join("&")
    : "";

  return (
    <Modal
      open={open}
      title={!isNew && initial?.name ? `Edit ${initial.name}` : "New mock"}
      width={880}
      okText="Save"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={onCancel}
      destroyOnHidden
    >
      {error && (
        <Typography.Text type="danger" style={{ display: "block", marginBottom: 12 }}>
          {error}
        </Typography.Text>
      )}
      <Row gutter={[16, 12]}>
        <Col xs={24} md={6}>
          <FieldLabel help="REST answers HTTP requests. SOAP answers XML envelope requests, usually carrying a `SOAPAction` header.">
            Type
          </FieldLabel>
          <Segmented
            block
            style={{ marginTop: 4 }}
            value={mock.type}
            options={[
              { value: "rest", label: "REST" },
              { value: "soap", label: "SOAP" },
            ]}
            onChange={(value) =>
              patch({
                type: String(value),
                match:
                  value === "soap"
                    ? { ...mock.match, path: null, pathMode: "exact" }
                    : mock.match,
              })
            }
          />
        </Col>
        <Col xs={24} md={12}>
          <FieldLabel help="Shown in the mock list and in request logs when this mock answers.">
            Name
          </FieldLabel>
          <Input
            style={{ marginTop: 4 }}
            value={mock.name}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </Col>
        <Col xs={24} md={6}>
          <FieldLabel help="Disabled mocks are kept on disk but never match.">Enabled</FieldLabel>
          <div style={{ marginTop: 8 }}>
            <Switch checked={mock.enabled} onChange={(enabled) => patch({ enabled })} />
          </div>
        </Col>

        <Col span={24}>
          <Divider orientation="horizontal" titlePlacement="left" style={{ margin: "4px 0" }}>
            Match
          </Divider>
        </Col>

        {isSoap ? (
          <>
            <Col xs={24} md={12}>
              <FieldLabel help={SOAP_ACTION_HELP}>
                SOAPAction
              </FieldLabel>
              <Input
                style={{ marginTop: 4 }}
                value={mock.match.soapAction ?? ""}
                onChange={(event) => patchMatch({ soapAction: event.target.value })}
              />
            </Col>
            <Col xs={24} md={12}>
              <div style={{ marginTop: 22 }}>
                <Switch
                  size="small"
                  checked={useUrlMatch}
                  onChange={setUseUrlMatch}
                  style={{ marginRight: 8 }}
                />
                <span>Match by URL path and query</span>
              </div>
            </Col>
            {useUrlMatch && (
              <>
                <Col xs={24} md={12}>
                  <FieldLabel help="The URL path after the host, without the query string.">
                    Path
                  </FieldLabel>
                  <Input
                    style={{ marginTop: 4 }}
                    placeholder="/endpoint"
                    value={mock.match.path ?? ""}
                    onChange={(event) => patchMatch({ path: event.target.value })}
                  />
                </Col>
                <Col xs={24} md={12}>
                  <FieldLabel help="Query parameters to match. Leave empty to ignore the query string.">
                    Query
                  </FieldLabel>
                  <Input
                    style={{ marginTop: 4 }}
                    placeholder="key=value&other=param"
                    value={queryText}
                    onChange={(event) => patchMatch({ query: parseQuery(event.target.value) })}
                  />
                </Col>
              </>
            )}
          </>
        ) : (
          <>
            <Col xs={24} md={8}>
              <FieldLabel help="The URL path after the host, without the query string. Leave empty to match any path.">
                Path
              </FieldLabel>
              <Input
                style={{ marginTop: 4 }}
                placeholder="/accounts"
                value={mock.match.path ?? ""}
                onChange={(event) => patchMatch({ path: event.target.value })}
              />
            </Col>
            <Col xs={24} md={8}>
              <FieldLabel help={pathModeHelp}>Path mode</FieldLabel>
              <div style={{ marginTop: 4 }}>
                <Segmented
                  block
                  value={mock.match.pathMode}
                  options={[
                    { value: "exact", label: "exact" },
                    { value: "prefix", label: "prefix" },
                    { value: "template", label: "template" },
                  ]}
                  onChange={(value) => patchMatch({ pathMode: String(value) })}
                />
              </div>
              <Typography.Text className="app-subtle">
                {pathModeOptions.find((item) => item.value === mock.match.pathMode)?.label}
              </Typography.Text>
            </Col>
            <Col xs={24} md={8}>
              <FieldLabel help="HTTP methods this mock accepts. Leave empty to match any method.">
                Methods
              </FieldLabel>
              <div style={{ marginTop: 4 }}>
                <MethodSelect
                  multiple
                  value={mock.match.methods ?? []}
                  onChange={(methods) => patchMatch({ methods })}
                  placeholder="Any method"
                />
              </div>
            </Col>
          </>
        )}

        <Col xs={24}>
          <Switch
            size="small"
            checked={useHeaderMatch}
            onChange={setUseHeaderMatch}
            style={{ marginRight: 8 }}
          />
          <span>Match by headers</span>
          <Typography.Text className="app-subtle" style={{ marginLeft: 8 }}>
            Require these request headers. Names and values are case-insensitive.
          </Typography.Text>
        </Col>
        {useHeaderMatch && (
          <Col xs={24}>
            <HeaderEditor
              resetKey={`${headerResetKey}:match`}
              label="Request headers"
              help="The request must include these headers with these values. Names and values are case-insensitive."
              value={mock.match.headers}
              onChange={(headers) => patchMatch({ headers })}
            />
          </Col>
        )}

        <Col xs={24}>
          <Switch
            size="small"
            checked={useAdvanced}
            onChange={setUseAdvanced}
            style={{ marginRight: 8 }}
          />
          <span>Advanced matching</span>
          <Typography.Text className="app-subtle" style={{ marginLeft: 8 }}>
            {isSoap
              ? "Match on the SOAP body as well as SOAPAction."
              : "Match on the request body as well as the path."}
          </Typography.Text>
        </Col>

        {useAdvanced && !isSoap && (
          <>
            <Col xs={24}>
              <FieldLabel help={humanizeHelp}>Body contains</FieldLabel>
              <Input
                style={{ marginTop: 4 }}
                value={mock.match.bodyContains ?? ""}
                onChange={(event) => patchMatch({ bodyContains: event.target.value })}
              />
            </Col>
            <Col xs={24} md={12}>
              <FieldLabel help={JSON_PATH_HELP}>
                JSON path equals
              </FieldLabel>
              <Space.Compact style={{ width: "100%", marginTop: 4 }}>
                <Input
                  placeholder="$.user.id"
                  value={mock.match.jsonPath ?? ""}
                  onChange={(event) => patchMatch({ jsonPath: event.target.value })}
                />
                <Input
                  placeholder="42"
                  style={{ width: "35%" }}
                  value={mock.match.jsonPathEquals ?? ""}
                  onChange={(event) => patchMatch({ jsonPathEquals: event.target.value })}
                />
              </Space.Compact>
            </Col>
            <Col xs={24} md={12}>
              <FieldLabel help={useAdvanced && isSoap ? SOAP_XPATH_HELP : XML_XPATH_HELP}>
                XML XPath
              </FieldLabel>
              <Input
                style={{ marginTop: 4 }}
                placeholder="//AccountId"
                value={mock.match.xpath ?? ""}
                onChange={(event) => patchMatch({ xpath: event.target.value })}
              />
            </Col>
          </>
        )}

        {useAdvanced && isSoap && (
          <>
            <Col xs={24} md={12}>
              <FieldLabel help={humanizeHelp}>
                Body contains
              </FieldLabel>
              <Input
                style={{ marginTop: 4 }}
                value={mock.match.bodyContains ?? ""}
                onChange={(event) => patchMatch({ bodyContains: event.target.value })}
              />
            </Col>
            <Col xs={24} md={12}>
              <FieldLabel help={SOAP_OPERATION_HELP}>
                Operation
              </FieldLabel>
              <Input
                style={{ marginTop: 4 }}
                value={mock.match.operation ?? ""}
                onChange={(event) => patchMatch({ operation: event.target.value })}
              />
            </Col>
            <Col span={24}>
              <FieldLabel help={SOAP_XPATH_HELP}>
                XML XPath
              </FieldLabel>
              <Input
                style={{ marginTop: 4 }}
                placeholder="//GetAccount"
                value={mock.match.xpath ?? ""}
                onChange={(event) => patchMatch({ xpath: event.target.value })}
              />
            </Col>
          </>
        )}

        <Col span={24}>
          <Divider orientation="horizontal" titlePlacement="left" style={{ margin: "4px 0" }}>
            Response
          </Divider>
        </Col>
        <Col xs={24}>
          <Switch
            size="small"
            checked={mock.response.block ?? false}
            onChange={(block) => setMock((current) => ({ ...current, response: { ...current.response, block } }))}
            style={{ marginRight: 8 }}
          />
          <span>Block request (do not respond)</span>
          {mock.response.block && (
            <Typography.Text className="app-subtle" style={{ marginLeft: 8 }}>
              The client waits until it times out. Status and body are not sent.
            </Typography.Text>
          )}
        </Col>
        <Col xs={24} md={6}>
          <FieldLabel help="HTTP status sent back to the client. Ignored when the request is blocked.">
            Status
          </FieldLabel>
          <InputNumber
            style={{ width: "100%", marginTop: 4 }}
            value={mock.response.statusCode}
            onChange={(value) =>
              setMock((current) => ({
                ...current,
                response: { ...current.response, statusCode: Number(value ?? 200) },
              }))
            }
          />
        </Col>
        <Col xs={24} md={10}>
          <FieldLabel help="Content-Type of the mocked response. Pick a common type or type your own, e.g. `application/json`.">
            Content type
          </FieldLabel>
          <div style={{ marginTop: 4 }}>
            <ContentTypeSelect
              value={mock.response.contentType}
              onChange={(contentType) =>
                setMock((current) => ({ ...current, response: { ...current.response, contentType } }))
              }
            />
          </div>
        </Col>
        <Col xs={24} md={8}>
          <FieldLabel help="Wait this many milliseconds before sending the response, to simulate a slow service.">
            Delay response
          </FieldLabel>
          <div className="app-row" style={{ gap: 8, marginTop: 4 }}>
            <Switch
              checked={useDelay}
              onChange={(enabled) => {
                setUseDelay(enabled);
                if (enabled && (mock.response.delayMs ?? 0) <= 0) {
                  setMock((current) => ({ ...current, response: { ...current.response, delayMs: 250 } }));
                }
              }}
            />
            {useDelay && (
              <InputNumber
                min={0}
                addonAfter="ms"
                value={mock.response.delayMs}
                onChange={(value) =>
                  setMock((current) => ({
                    ...current,
                    response: { ...current.response, delayMs: Number(value ?? 0) },
                  }))
                }
              />
            )}
          </div>
        </Col>
        <Col span={24}>
          <HeaderEditor
            resetKey={`${headerResetKey}:response`}
            label="Response headers"
            help="Extra headers sent with the mocked response. Content-Type is set above; you can still override it here."
            value={mock.response.headers}
            onChange={(headers) =>
              setMock((current) => ({ ...current, response: { ...current.response, headers } }))
            }
            collapsible
          />
        </Col>
        <Col span={24}>
          <FieldLabel help="The body sent back to the client. For REST this is often JSON; for SOAP it is the XML envelope.">
            Response body
          </FieldLabel>
          <Input.TextArea
            style={{ marginTop: 4, fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 12 }}
            rows={6}
            value={mock.response.body ?? ""}
            onChange={(event) =>
              setMock((current) => ({
                ...current,
                response: { ...current.response, body: event.target.value },
              }))
            }
          />
        </Col>
      </Row>
      <div style={{ marginTop: 12 }}>
        <FieldHelp text="Switched-off groups are cleared on save, so a disabled header or body rule never lingers in the mock file." />
      </div>
    </Modal>
  );
}

function parseQuery(text: string): Record<string, string> | null {
  const query: Record<string, string> = {};
  for (const pair of text.split("&").filter(Boolean)) {
    const eq = pair.indexOf("=");
    if (eq === -1) {
      query[pair] = "";
    } else {
      query[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
  }
  return Object.keys(query).length > 0 ? query : null;
}

function hasHeaderMatch(match: MockMatchDto): boolean {
  return Boolean(match.headers && Object.keys(match.headers).length > 0);
}

function hasUrlMatch(match: MockMatchDto, isSoap: boolean): boolean {
  if (!isSoap) {
    return false;
  }
  return Boolean(match.path && match.path.trim());
}

function persistMatch(
  match: MockMatchDto,
  isSoap: boolean,
  useAdvanced: boolean,
  useHeaderMatch: boolean,
  useUrlMatch: boolean,
): MockMatchDto {
  const next: MockMatchDto = {
    ...(useAdvanced ? match : basicMatch(match)),
    headers: useHeaderMatch ? match.headers : null,
  };
  if (!isSoap) {
    return next;
  }

  return {
    ...next,
    methods: null,
    query: useUrlMatch ? next.query : null,
    path: useUrlMatch ? next.path : null,
  };
}

function hasExtraFilters(match: MockMatchDto, isSoap = false): boolean {
  if (isSoap && match.pathMode && match.pathMode !== "exact") {
    return true;
  }

  if (match.query && Object.keys(match.query).length > 0) {
    return true;
  }

  if (isSoap && match.path && match.path.trim()) {
    return true;
  }

  return Boolean(
    match.bodyContains ||
    match.bodyRegex ||
    match.jsonPath ||
    match.jsonPathEquals ||
    match.operation ||
    match.xpath,
  );
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
  };
}
