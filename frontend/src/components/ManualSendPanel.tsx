import { SendOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Input,
  Row,
  Segmented,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { getHeader, parseHeaders, type SendDraft } from "../headers";
import { looksLikeHtml } from "../looksLikeHtml";
import { modeColor, statusColor } from "../logColors";
import { useSendManualRequestMutation } from "../store/proxyApi";
import type { LogDetailDto } from "../store/types";
import { CopyButton } from "./CopyButton";
import { FieldHelp, FieldLabel } from "./FieldHelp";
import { HeaderEditor } from "./HeaderEditor";
import { HtmlBodyPreview } from "./HtmlBodyPreview";
import { ProtocolTag } from "./LogBits";
import { ContentTypeSelect, MethodSelect } from "./Selects";

const soapTemplate = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
  </s:Body>
</s:Envelope>`;

interface AuthState {
  token: string;
  scheme: "Bearer" | "Raw";
}

function authKey(proxyId: string) {
  return `proxy-send-auth-${proxyId}`;
}

function readAuth(proxyId: string): AuthState {
  try {
    const raw = sessionStorage.getItem(authKey(proxyId));
    if (!raw) {
      return { token: "", scheme: "Bearer" };
    }

    const parsed = JSON.parse(raw) as AuthState;
    return {
      token: parsed.token ?? "",
      scheme: parsed.scheme === "Raw" ? "Raw" : "Bearer",
    };
  } catch {
    return { token: "", scheme: "Bearer" };
  }
}

function authFromHeader(value: string): AuthState {
  if (/^bearer\s/i.test(value)) {
    return { scheme: "Bearer", token: value.replace(/^bearer\s+/i, "") };
  }

  return { scheme: "Raw", token: value };
}

interface Props {
  proxyId: string;
  destination: string;
  pathPrefix?: string | null;
  draft?: SendDraft | null;
  onDraftConsumed?: () => void;
  onOpenLog: (id: number) => void;
}

export function ManualSendPanel({
  proxyId,
  destination,
  pathPrefix,
  draft,
  onDraftConsumed,
  onOpenLog,
}: Props) {
  const [protocol, setProtocol] = useState<"rest" | "soap">("rest");
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/");
  const [query, setQuery] = useState("");
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [headerResetKey, setHeaderResetKey] = useState("blank");
  const [body, setBody] = useState("");
  const [soapAction, setSoapAction] = useState("");
  const [contentType, setContentType] = useState("application/json");
  const [auth, setAuth] = useState<AuthState>(() => readAuth(proxyId));
  const [result, setResult] = useState<LogDetailDto | null>(null);
  const [htmlPreview, setHtmlPreview] = useState(false);
  const [send, sendState] = useSendManualRequestMutation();

  useEffect(() => {
    setAuth(readAuth(proxyId));
    setResult(null);
    setHtmlPreview(false);
  }, [proxyId]);

  useEffect(() => {
    sessionStorage.setItem(authKey(proxyId), JSON.stringify(auth));
  }, [auth, proxyId]);

  useEffect(() => {
    if (!draft) {
      return;
    }

    setProtocol(draft.protocol);
    setMethod(draft.method);
    setPath(draft.path);
    setQuery(draft.query);
    setHeaders(draft.headers);
    setHeaderResetKey(`draft-${draft.method}-${draft.path}-${Date.now()}`);
    setBody(draft.body);
    setSoapAction(draft.soapAction);
    setContentType(draft.contentType);
    if (draft.authorization.trim()) {
      setAuth(authFromHeader(draft.authorization));
    }
    setResult(null);
    setHtmlPreview(false);
    onDraftConsumed?.();
  }, [draft]);

  useEffect(() => {
    if (protocol === "soap") {
      setMethod("POST");
      setContentType((current) =>
        current === "application/json" ? "text/xml; charset=utf-8" : current,
      );
      setBody((current) => (current.trim() === "" ? soapTemplate : current));
      return;
    }

    setContentType((current) => (current.startsWith("text/xml") ? "application/json" : current));
  }, [protocol]);

  const submit = async () => {
    const outgoing: Record<string, string> = { ...(headers ?? {}) };

    if (contentType.trim()) {
      outgoing["Content-Type"] = contentType.trim();
    }

    if (protocol === "soap" && soapAction.trim()) {
      outgoing.SOAPAction = `"${soapAction.trim().replace(/^"+|"+$/g, "")}"`;
    }

    if (protocol === "rest" && auth.token.trim()) {
      const token = auth.token.trim();
      outgoing.Authorization =
        auth.scheme === "Bearer" && !/^bearer\s/i.test(token) ? `Bearer ${token}` : token;
    }

    try {
      const log = await send({
        proxyId,
        body: {
          method,
          path,
          query: query.trim() || null,
          headers: outgoing,
          body: body.trim() === "" ? null : body,
          protocol,
        },
      }).unwrap();
      setHtmlPreview(false);
      setResult(log);
    } catch {
      setResult(null);
    }
  };

  const resultHtml = result
    ? looksLikeHtml(
        result.responseBody,
        getHeader(parseHeaders(result.responseHeaders), "Content-Type"),
      )
    : false;

  return (
    <>
      <div className="app-row" style={{ gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <Segmented
          value={protocol}
          options={[
            { value: "rest", label: "REST" },
            { value: "soap", label: "SOAP" },
          ]}
          onChange={(value) => setProtocol(value as "rest" | "soap")}
        />
        <FieldHelp
          text={`Sends directly to \`${destination}\`${
            pathPrefix ? ` (the listen prefix \`${pathPrefix}\` is stripped)` : ""
          }.\nThe request is logged as **manual**.`}
        />
      </div>

      {protocol === "rest" && (
        <Collapse
          style={{ marginBottom: 16 }}
          items={[
            {
              key: "auth",
              label: (
                <span className="app-row" style={{ gap: 8 }}>
                  <strong>Authentication</strong>
                  <span className="app-subtle">{auth.token.trim() ? "filled" : "empty"}</span>
                </span>
              ),
              children: (
                <div className="send-auth-panel">
                  <Row gutter={[16, 8]}>
                    <Col xs={24} md={6}>
                      <FieldLabel help={"`Bearer` prefixes the token with the scheme; `Raw` sends the value exactly as typed."}>
                        Scheme
                      </FieldLabel>
                      <Segmented
                        block
                        style={{ marginTop: 4 }}
                        value={auth.scheme}
                        options={[
                          { value: "Bearer", label: "Bearer" },
                          { value: "Raw", label: "Raw" },
                        ]}
                        onChange={(value) => setAuth({ ...auth, scheme: value as "Bearer" | "Raw" })}
                      />
                    </Col>
                    <Col xs={24} md={18}>
                      <FieldLabel help={"Sent as the `Authorization` header. It is kept in this browser tab and never stored on the server."}>
                        Token
                      </FieldLabel>
                      <Input.Password
                        style={{ marginTop: 4 }}
                        autoComplete="off"
                        value={auth.token}
                        placeholder={auth.scheme === "Bearer" ? "eyJ..." : "Bearer eyJ..."}
                        onChange={(event) => setAuth({ ...auth, token: event.target.value })}
                      />
                    </Col>
                  </Row>
                </div>
              ),
            },
          ]}
        />
      )}

      <Row gutter={[16, 12]}>
        <Col xs={24} md={4}>
          <FieldLabel help="HTTP method of the outgoing request. SOAP always uses `POST`.">Method</FieldLabel>
          <div style={{ marginTop: 4 }}>
            <MethodSelect
              value={[method]}
              disabled={protocol === "soap"}
              onChange={(methods) => setMethod(methods[0] ?? "GET")}
            />
          </div>
        </Col>
        <Col xs={24} md={10}>
          <FieldLabel help="Path sent to the destination, without the listen prefix.">Path</FieldLabel>
          <Input
            style={{ marginTop: 4 }}
            value={path}
            placeholder="/resource"
            onChange={(event) => setPath(event.target.value)}
          />
        </Col>
        <Col xs={24} md={10}>
          <FieldLabel help="Query string of the outgoing URL, without the leading `?`.">Query</FieldLabel>
          <Input
            style={{ marginTop: 4 }}
            value={query}
            placeholder="id=1&active=true"
            onChange={(event) => setQuery(event.target.value)}
          />
        </Col>
        {protocol === "soap" && (
          <Col xs={24} md={12}>
            <FieldLabel help="Sent as the quoted `SOAPAction` header.">SOAPAction</FieldLabel>
            <Input
              style={{ marginTop: 4 }}
              value={soapAction}
              placeholder="GetAccount"
              onChange={(event) => setSoapAction(event.target.value)}
            />
          </Col>
        )}
        <Col xs={24} md={protocol === "soap" ? 12 : 24}>
          <FieldLabel help="`Content-Type` of the outgoing request.">Content type</FieldLabel>
          <div style={{ marginTop: 4 }}>
            <ContentTypeSelect value={contentType} onChange={setContentType} />
          </div>
        </Col>
        <Col span={24}>
          <HeaderEditor
            resetKey={`${proxyId}:${headerResetKey}`}
            label="Headers"
            help={
              "Additional request headers.\n- `Content-Type`, `SOAPAction`, and `Authorization` are set by the fields above when those apply."
            }
            value={headers}
            onChange={setHeaders}
            collapsible
          />
        </Col>
        <Col span={24}>
          <FieldLabel help="Body sent to the destination. SOAP starts from an envelope template.">
            {protocol === "soap" ? "SOAP envelope" : "Body"}
          </FieldLabel>
          <Input.TextArea
            style={{
              marginTop: 4,
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
              fontSize: 12,
            }}
            rows={protocol === "soap" ? 10 : 6}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </Col>
        <Col span={24}>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={sendState.isLoading}
            onClick={() => void submit()}
          >
            {sendState.isLoading ? "Sending…" : "Send"}
          </Button>
        </Col>
      </Row>

      {sendState.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 16 }}
          message="Could not send the request."
          description="The destination may be unreachable. The attempt is still logged."
        />
      )}

      {result && (
        <Card
          style={{ marginTop: 16 }}
          size="small"
          title={
            <Space wrap size={12}>
              <ProtocolTag protocol={result.protocol} />
              <Tag color={modeColor("manual")}>Manual</Tag>
              <Tag color={statusColor(result.statusCode)}>{result.statusCode ?? "-"}</Tag>
              <span className="app-subtle">{result.durationMs} ms</span>
              {result.error && <Tag color="red">{result.error}</Tag>}
            </Space>
          }
          extra={
            <Button size="small" onClick={() => onOpenLog(result.id)}>
              Open log
            </Button>
          }
        >
          <Row gutter={[16, 12]}>
            <Col xs={24} lg={12}>
              <div className="app-row" style={{ marginBottom: 8 }}>
                <strong>Request body</strong>
                <div style={{ marginLeft: "auto" }}>
                  <CopyButton value={result.requestBody ?? ""} label="Copy request body" />
                </div>
              </div>
              <pre className="app-code app-prewrap log-body-scroll" style={{ padding: 8, margin: 0 }}>
                {result.requestBody || "(empty)"}
              </pre>
            </Col>
            <Col xs={24} lg={12}>
              <div className="app-row" style={{ gap: 12, marginBottom: 8 }}>
                <strong>Response body</strong>
                <div className="app-row" style={{ gap: 8, marginLeft: "auto" }}>
                  {resultHtml && (
                    <span className="app-row" style={{ gap: 6 }}>
                      <Switch size="small" checked={htmlPreview} onChange={setHtmlPreview} id="send-html-preview" />
                      <label htmlFor="send-html-preview">HTML preview</label>
                    </span>
                  )}
                  <CopyButton value={result.responseBody ?? ""} label="Copy response body" />
                </div>
              </div>
              {htmlPreview && result.responseBody ? (
                <HtmlBodyPreview html={result.responseBody} />
              ) : (
                <pre className="app-code app-prewrap log-body-scroll" style={{ padding: 8, margin: 0 }}>
                  {result.responseBody || result.error || "(empty)"}
                </pre>
              )}
            </Col>
          </Row>
          <Typography.Text className="app-subtle">
            Stored as log entry #{result.id}. Open it to see the full headers and to create a mock
            from this response.
          </Typography.Text>
        </Card>
      )}
    </>
  );
}
