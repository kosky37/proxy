import { useState } from 'react'
import { Badge, Button, Col, Form, Modal, Row, Stack, Table } from 'react-bootstrap'
import { modeBadge } from '../modeBadge'
import type { LogDetailDto, MockDto } from '../store/types'
import { CopyButton } from './CopyButton'

interface Props {
  show: boolean
  log: LogDetailDto | null
  existingMock?: MockDto
  onClose: () => void
  onOpenMock?: (mock: MockDto) => void
  onCreateMock?: (log: LogDetailDto) => void
}

export function LogDetailModal({ show, log, existingMock, onClose, onOpenMock, onCreateMock }: Props) {
  const [raw, setRaw] = useState(false)

  return (
    <Modal show={show} onHide={onClose} size="xl" scrollable onExited={() => setRaw(false)}>
      <Modal.Header closeButton>
        <Modal.Title>
          {log?.method} {log?.path}
        </Modal.Title>
      </Modal.Header>
      {log && (
        <Modal.Body>
          <Stack direction="horizontal" gap={2} className="mb-3 flex-wrap">
            <Badge bg={log.protocol === 'soap' ? 'warning' : 'primary'} text={log.protocol === 'soap' ? 'dark' : undefined}>
              {log.protocol === 'soap' ? 'SOAP' : 'REST'}
            </Badge>
            <Badge bg={modeBadge(log.mode).bg}>{modeBadge(log.mode).label}</Badge>
            <Badge bg={statusVariant(log.statusCode)}>{log.statusCode ?? '-'}</Badge>
            <span>{log.durationMs} ms</span>
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
                body={log.requestBody}
                truncated={log.requestBodyTruncated ?? false}
                raw={raw}
              />
            </Col>
            <Col lg={6}>
              <HttpMessage
                title="Response"
                headers={log.responseHeaders}
                body={log.responseBody}
                truncated={log.responseBodyTruncated ?? false}
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
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

function HttpMessage({
  title,
  headers,
  body,
  truncated,
  raw,
}: {
  title: string
  headers?: string | null
  body?: string | null
  truncated: boolean
  raw: boolean
}) {
  const parsed = parseHeaders(headers)

  return (
    <Stack gap={3}>
      <h2 className="h5 mb-0">{title}</h2>
      <div>
        <Stack direction="horizontal" className="mb-2">
          <strong>Headers</strong>
          <div className="ms-auto">
            <CopyButton value={headers ?? ''} label="Copy headers" />
          </div>
        </Stack>
        {raw ? (
          <pre className="border rounded p-2 mb-0">{headers || '(none)'}</pre>
        ) : (
          <Table bordered size="sm" responsive>
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(parsed).map(([name, value]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>
                    <code>{value}</code>
                  </td>
                  <td>
                    <CopyButton value={value} />
                  </td>
                </tr>
              ))}
              {Object.keys(parsed).length === 0 && (
                <tr>
                  <td colSpan={3}>No headers</td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </div>
      <div>
        <Stack direction="horizontal" className="mb-2">
          <strong>Body</strong>
          {truncated && <Badge bg="warning" text="dark">truncated</Badge>}
          <div className="ms-auto">
            <CopyButton value={body ?? ''} label="Copy body" />
          </div>
        </Stack>
        <pre className="border rounded p-2 mb-0">{body || '(empty)'}</pre>
      </div>
    </Stack>
  )
}

function parseHeaders(raw?: string | null): Record<string, string> {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, value == null ? '' : String(value)]),
      )
    }
  } catch {
    return { Raw: raw }
  }

  return { Raw: raw }
}

function statusVariant(status?: number | null) {
  if (!status) {
    return 'secondary'
  }
  if (status < 300) {
    return 'success'
  }
  if (status < 400) {
    return 'info'
  }
  if (status < 500) {
    return 'warning'
  }
  return 'danger'
}
