import { CaretDownOutlined, CaretRightOutlined } from "@ant-design/icons";
import { Button, Modal, Space, Switch, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import type { ColumnsType } from "antd/es/table";
import { formatBytes } from "../format";
import { getHeader, parseHeaders as parseHeaderMap } from "../headers";
import { looksLikeHtml } from "../looksLikeHtml";
import { modeColor, protocolColor, statusColor } from "../logColors";
import { modeBadge } from "../modeBadge";
import { parseBody, type ParsedField } from "../parseBody";
import { protocolBadge } from "../protocolBadge";
import type { LogDetailDto, MockDto } from "../store/types";
import { BodyTree } from "./BodyTree";
import { CopyButton } from "./CopyButton";
import { ValueTooltip } from "./FieldHelp";
import { HtmlBodyPreview } from "./HtmlBodyPreview";
import { LogRequestLine } from "./LogBits";

interface Props {
  open: boolean;
  log: LogDetailDto | null;
  existingMock?: MockDto;
  loading?: boolean;
  onClose: () => void;
  onOpenMock?: (mock: MockDto) => void;
  onCreateMock?: (log: LogDetailDto) => void;
  onCreateSend?: (log: LogDetailDto) => void;
  onCreateIgnore?: (log: LogDetailDto) => void;
}

export function LogDetailModal({
  open,
  log,
  existingMock,
  loading,
  onClose,
  onOpenMock,
  onCreateMock,
  onCreateSend,
  onCreateIgnore,
}: Props) {
  const [raw, setRaw] = useState(false);

  useEffect(() => {
    if (!open) {
      setRaw(false);
    }
  }, [open]);

  const kind = protocolBadge(log?.protocol ?? "");

  return (
    <Modal
      open={open}
      className="log-detail-modal"
      width="min(1600px, 96vw)"
      title={log ? <LogRequestLine item={log} /> : "Log entry"}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Space wrap>
          {existingMock && onOpenMock && (
            <Button type="primary" onClick={() => onOpenMock(existingMock)}>
              Edit mock
            </Button>
          )}
          {!existingMock && log && onCreateMock && (
            <Button type="primary" onClick={() => onCreateMock(log)}>
              Create mock
            </Button>
          )}
          {log && onCreateSend && <Button onClick={() => onCreateSend(log)}>Resend</Button>}
          {log && onCreateIgnore && (
            <Button danger onClick={() => onCreateIgnore(log)}>
              Ignore
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </Space>
      }
    >
      {loading && !log && <Typography.Text>Loading…</Typography.Text>}
      {log && (
        <>
          <div className="log-detail-meta">
            <Tag color={protocolColor(log.protocol)}>{kind.label}</Tag>
            <Tag color={modeColor(log.mode)}>{modeBadge(log.mode).label}</Tag>
            <Tag color={statusColor(log.statusCode)}>{log.statusCode ?? "-"}</Tag>
            <span className="app-subtle">{log.durationMs} ms</span>
            {log.proxyName && <span className="app-subtle">Proxy: {log.proxyName}</span>}
            {log.mockName && (
              <span className="app-subtle">
                Mock:{" "}
                {existingMock && onOpenMock ? (
                  <Button type="link" size="small" onClick={() => onOpenMock(existingMock)}>
                    {log.mockName}
                  </Button>
                ) : (
                  log.mockName
                )}
              </span>
            )}
            {log.error && <Tag color="red">{log.error}</Tag>}
            <span className="log-detail-meta-raw">
              <Switch size="small" checked={raw} onChange={setRaw} id="log-raw-view" />
              <label htmlFor="log-raw-view">Raw view</label>
            </span>
          </div>

          <div className="log-detail-grid">
            <HttpMessage
              title="Request"
              headers={log.requestHeaders}
              query={log.query}
              body={log.requestBody}
              truncated={log.requestBodyTruncated ?? false}
              originalBytes={log.requestBytes}
              raw={raw}
            />
            <HttpMessage
              title="Response"
              headers={log.responseHeaders}
              body={log.responseBody}
              truncated={log.responseBodyTruncated ?? false}
              originalBytes={log.responseBytes}
              raw={raw}
              allowHtmlPreview
            />
          </div>
        </>
      )}
    </Modal>
  );
}

function HttpMessage({
  title,
  headers,
  query,
  body,
  truncated,
  originalBytes,
  raw,
  allowHtmlPreview = false,
}: {
  title: string;
  headers?: string | null;
  query?: string | null;
  body?: string | null;
  truncated: boolean;
  originalBytes?: number;
  raw: boolean;
  allowHtmlPreview?: boolean;
}) {
  const [htmlPreview, setHtmlPreview] = useState(false);
  const headerFields = Object.entries(parseHeaders(headers)).map(([name, value]) => ({
    name,
    value,
  }));
  const contentType = getHeader(parseHeaderMap(headers), "Content-Type");
  const html = allowHtmlPreview && looksLikeHtml(body, contentType);
  const bodyNodes = raw || htmlPreview ? null : parseBody(body);

  useEffect(() => {
    setHtmlPreview(false);
  }, [body]);

  return (
    <div className="log-detail-pane">
      <h2 className="log-detail-pane-title">{title}</h2>
      <FieldBlock
        title="Headers"
        rawText={headers}
        fields={headerFields}
        raw={raw}
        empty="No headers"
        copyLabel="Copy headers"
        defaultOpen={false}
      />
      {query?.trim() ? (
        <FieldBlock
          title="Query"
          rawText={query}
          fields={parseQuery(query)}
          raw={raw}
          empty="(none)"
          copyLabel="Copy query"
        />
      ) : null}
      <div>
        <div className="log-body-head">
          <strong>Body</strong>
          {truncated && <Tag color="orange">exceeded limit</Tag>}
          <div className="log-body-head-actions">
            {html && (
              <span className="log-inline-switch">
                <Switch
                  size="small"
                  checked={htmlPreview}
                  onChange={setHtmlPreview}
                  id={`html-preview-${title}`}
                />
                <label htmlFor={`html-preview-${title}`}>HTML preview</label>
              </span>
            )}
            <CopyButton value={body ?? ""} label="Copy body" />
          </div>
        </div>
        <div className="log-body-scroll">
          {html && htmlPreview ? (
            <HtmlBodyPreview html={body ?? ""} />
          ) : raw || !bodyNodes ? (
            <pre className="app-code app-prewrap log-raw-text">
              {body ||
                (truncated
                  ? `Body not stored. Original size: ${formatBytes(originalBytes)}.`
                  : "(empty)")}
            </pre>
          ) : (
            <BodyTree nodes={bodyNodes} empty="(empty)" />
          )}
        </div>
      </div>
    </div>
  );
}

function FieldBlock({
  title,
  rawText,
  fields,
  raw,
  empty,
  copyLabel,
  defaultOpen = true,
}: {
  title: string;
  rawText?: string | null;
  fields: ParsedField[];
  raw: boolean;
  empty: string;
  copyLabel: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [rawText, defaultOpen]);

  return (
    <div className="log-field-block">
      <div className="log-field-head">
        <button
          type="button"
          className="log-collapse-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
          <span className="log-collapse-toggle-label">{title}</span>
          <span className="app-subtle">{fields.length}</span>
        </button>
        <CopyButton value={rawText ?? ""} label={copyLabel} />
      </div>
      {open && (
        <div className="log-field-body">
          {raw ? (
            <pre className="app-code app-prewrap log-raw-text">{rawText || "(none)"}</pre>
          ) : (
            <FieldTable fields={fields} empty={empty} />
          )}
        </div>
      )}
    </div>
  );
}

function FieldTable({ fields, empty }: { fields: ParsedField[]; empty: string }) {
  const columns: ColumnsType<ParsedField> = [
    {
      title: "Name",
      dataIndex: "name",
      width: "32%",
      render: (value: string) => <TruncatedText value={value} />,
    },
    {
      title: "Value",
      dataIndex: "value",
      render: (value: string) => <TruncatedText value={value} code />,
    },
    {
      title: "",
      key: "copy",
      width: 44,
      align: "center",
      render: (_value, field) => (
        <CopyButton value={field.value} label={`Copy ${field.name}`} />
      ),
    },
  ];

  return (
    <Table<ParsedField>
      rowKey={(field) => `${field.name}:${field.value}`}
      size="small"
      bordered
      className="log-field-table"
      tableLayout="fixed"
      columns={columns}
      dataSource={fields}
      pagination={false}
      locale={{ emptyText: empty }}
    />
  );
}

function TruncatedText({ value, code = false }: { value: string; code?: boolean }) {
  if (!value) {
    return null;
  }

  return (
    <ValueTooltip value={value}>
      {code ? <code className="app-code">{value}</code> : value}
    </ValueTooltip>
  );
}

function parseQuery(raw?: string | null): ParsedField[] {
  if (!raw?.trim()) {
    return [];
  }

  const fields: ParsedField[] = [];
  for (const pair of raw.split("&")) {
    if (!pair) {
      continue;
    }
    const eq = pair.indexOf("=");
    if (eq === -1) {
      fields.push({ name: pair, value: "" });
    } else {
      fields.push({ name: pair.slice(0, eq), value: pair.slice(eq + 1) });
    }
  }
  return fields;
}

function parseHeaders(raw?: string | null): Record<string, string> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, value == null ? "" : String(value)]),
      );
    }
  } catch {
    return { Raw: raw };
  }

  return { Raw: raw };
}
