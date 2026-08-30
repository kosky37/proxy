import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Col,
  Form,
  Modal,
  OverlayTrigger,
  Row,
  Stack,
  Table,
  Tooltip,
} from "react-bootstrap";
import { formatBytes } from "../format";
import { modeClass, statusClass } from "../logColors";
import { modeBadge } from "../modeBadge";
import { parseBody, type ParsedField } from "../parseBody";
import { protocolBadge } from "../protocolBadge";
import type { LogDetailDto, MockDto } from "../store/types";
import { BodyTree } from "./BodyTree";
import { CopyButton } from "./CopyButton";
import { LogRequestLine } from "./SoapActionBanner";

interface Props {
  show: boolean;
  log: LogDetailDto | null;
  existingMock?: MockDto;
  onClose: () => void;
  onOpenMock?: (mock: MockDto) => void;
  onCreateMock?: (log: LogDetailDto) => void;
  onCreateSend?: (log: LogDetailDto) => void;
  onCreateIgnore?: (log: LogDetailDto) => void;
}

export function LogDetailModal({
  show,
  log,
  existingMock,
  onClose,
  onOpenMock,
  onCreateMock,
  onCreateSend,
  onCreateIgnore,
}: Props) {
  const [raw, setRaw] = useState(false);
  const kind = protocolBadge(log?.protocol ?? "");

  return (
    <Modal
      show={show}
      onHide={onClose}
      dialogClassName="log-detail-modal"
      scrollable
      onExited={() => setRaw(false)}
    >
      <Modal.Header closeButton>
        <Modal.Title>
          {log ? <LogRequestLine item={log} showSoapAction /> : null}
        </Modal.Title>
      </Modal.Header>
      {log && (
        <Modal.Body>
          <Stack direction="horizontal" gap={2} className="mb-3 flex-wrap">
            <Badge bg={kind.bg} text={kind.text}>
              {kind.label}
            </Badge>
            <span className={`badge ${modeClass(log.mode)}`}>
              {modeBadge(log.mode).label}
            </span>
            <span className={`badge ${statusClass(log.statusCode)}`}>
              {log.statusCode ?? "-"}
            </span>
            <span>{log.durationMs} ms</span>
            {log.proxyName && <span>{log.proxyName}</span>}
            {log.mockName && <span>Mock: {log.mockName}</span>}
            {log.error && <Badge bg="danger">{log.error}</Badge>}
            <div className="ms-auto">
              <Form.Check
                type="switch"
                id="log-raw-view"
                label="Raw view"
                checked={raw}
                onChange={(event) => setRaw(event.currentTarget.checked)}
              />
            </div>
          </Stack>
          <Row className="g-3">
            <Col lg={6}>
              <HttpMessage
                title="Request"
                headers={log.requestHeaders}
                query={log.query}
                body={log.requestBody}
                truncated={log.requestBodyTruncated ?? false}
                originalBytes={log.requestBytes}
                raw={raw}
              />
            </Col>
            <Col lg={6}>
              <HttpMessage
                title="Response"
                headers={log.responseHeaders}
                body={log.responseBody}
                truncated={log.responseBodyTruncated ?? false}
                originalBytes={log.responseBytes}
                raw={raw}
              />
            </Col>
          </Row>
        </Modal.Body>
      )}
      <Modal.Footer>
        {existingMock && onOpenMock && (
          <Button variant="primary" onClick={() => onOpenMock(existingMock)}>
            Open mock
          </Button>
        )}
        {!existingMock && log && onCreateMock && (
          <Button variant="primary" onClick={() => onCreateMock(log)}>
            Create mock
          </Button>
        )}
        {log && onCreateSend && (
          <Button variant="outline-primary" onClick={() => onCreateSend(log)}>
            Send similar
          </Button>
        )}
        {log && onCreateIgnore && (
          <Button variant="outline-primary" onClick={() => onCreateIgnore(log)}>
            Create ignore
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
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
}: {
  title: string;
  headers?: string | null;
  query?: string | null;
  body?: string | null;
  truncated: boolean;
  originalBytes?: number;
  raw: boolean;
}) {
  const headerFields = Object.entries(parseHeaders(headers)).map(
    ([name, value]) => ({ name, value }),
  );
  const bodyNodes = raw ? null : parseBody(body);

  return (
    <Stack gap={3}>
      <h2 className="h5 mb-0">{title}</h2>
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
        <Stack direction="horizontal" className="mb-2">
          <strong>Body</strong>
          {truncated && (
            <Badge bg="warning" text="dark" className="ms-2">
              exceeded limit
            </Badge>
          )}
          <div className="ms-auto">
            <CopyButton value={body ?? ""} label="Copy body" />
          </div>
        </Stack>
        {raw || !bodyNodes ? (
          <pre className="border rounded p-2 mb-0">
            {body ||
              (truncated
                ? `Body not stored. Original size: ${formatBytes(originalBytes)}.`
                : "(empty)")}
          </pre>
        ) : (
          <BodyTree nodes={bodyNodes} empty="(empty)" />
        )}
      </div>
    </Stack>
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
    <div>
      <Stack direction="horizontal" className="mb-2">
        <button
          type="button"
          className="log-collapse-toggle"
          onClick={() => setOpen((value) => !value)}
        >
          <i
            className={`bi ${open ? "bi-chevron-down" : "bi-chevron-right"}`}
            aria-hidden
          />
          <strong>{title}</strong>
          <span className="row-meta">{fields.length}</span>
        </button>
        <div className="ms-auto">
          <CopyButton value={rawText ?? ""} label={copyLabel} />
        </div>
      </Stack>
      {open &&
        (raw ? (
          <pre className="border rounded p-2 mb-0">{rawText || "(none)"}</pre>
        ) : (
          <FieldTable fields={fields} empty={empty} />
        ))}
    </div>
  );
}

function FieldTable({
  fields,
  empty,
}: {
  fields: ParsedField[];
  empty: string;
}) {
  return (
    <Table bordered size="sm" className="log-headers-table mb-0">
      <colgroup>
        <col className="log-headers-name" />
        <col />
        <col className="log-headers-copy" />
      </colgroup>
      <thead>
        <tr>
          <th>Name</th>
          <th>Value</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr key={`${field.name}:${field.value}`}>
            <td className="log-headers-value">
              <TruncatedText value={field.name} />
            </td>
            <td className="log-headers-value">
              <TruncatedText value={field.value} code />
            </td>
            <td className="text-center">
              <CopyButton value={field.value} label={`Copy ${field.name}`} />
            </td>
          </tr>
        ))}
        {fields.length === 0 && (
          <tr>
            <td colSpan={3}>{empty}</td>
          </tr>
        )}
      </tbody>
    </Table>
  );
}

function TruncatedText({
  value,
  code = false,
}: {
  value: string;
  code?: boolean;
}) {
  const content = code ? <code>{value}</code> : value;
  if (!value) {
    return content;
  }

  return (
    <OverlayTrigger
      overlay={<Tooltip className="tooltip-wide">{value}</Tooltip>}
    >
      <span className="log-headers-text">{content}</span>
    </OverlayTrigger>
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
        Object.entries(parsed).map(([key, value]) => [
          key,
          value == null ? "" : String(value),
        ]),
      );
    }
  } catch {
    return { Raw: raw };
  }

  return { Raw: raw };
}
