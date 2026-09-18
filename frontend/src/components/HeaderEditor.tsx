import { useEffect, useMemo, useState } from "react";
import { Button, ButtonGroup, Form, InputGroup } from "react-bootstrap";
import {
  compactHeaders,
  headersToRows,
  parseHeaderJson,
  rowsToHeaders,
  stringifyHeaders,
  type HeaderRow,
} from "../headers";
import { FieldHelp, FieldLabel } from "./FieldHelp";

interface Props {
  id: string;
  resetKey: string;
  label: string;
  help: string;
  value: Record<string, string> | null | undefined;
  onChange: (headers: Record<string, string> | null) => void;
  collapsible?: boolean;
}

export function HeaderEditor({
  id,
  resetKey,
  label,
  help,
  value,
  onChange,
  collapsible = false,
}: Props) {
  const [mode, setMode] = useState<"fields" | "json">("fields");
  const [open, setOpen] = useState(!collapsible);
  const [rows, setRows] = useState<HeaderRow[]>(() => headersToRows(value));
  const [jsonText, setJsonText] = useState(() => stringifyHeaders(value));
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setMode("fields");
    setOpen(!collapsible);
    setRows(headersToRows(value));
    setJsonText(stringifyHeaders(value));
    setJsonError(null);
  }, [resetKey, collapsible]);

  const nextId = useMemo(() => rows.reduce((max, row) => Math.max(max, row.id), 0) + 1, [rows]);
  const count = Object.keys(compactHeaders(value) ?? {}).length;
  const showEditor = !collapsible || open;

  const setFieldRows = (next: HeaderRow[]) => {
    setRows(next);
    onChange(rowsToHeaders(next));
  };

  const switchToJson = () => {
    setJsonText(stringifyHeaders(rowsToHeaders(rows)));
    setJsonError(null);
    setMode("json");
  };

  const switchToFields = () => {
    const parsed = parseHeaderJson(jsonText);
    if ("error" in parsed) {
      setJsonError(parsed.error);
      return;
    }

    setRows(headersToRows(parsed.headers));
    onChange(parsed.headers);
    setJsonError(null);
    setMode("fields");
  };

  return (
    <Form.Group>
      <div className="d-flex align-items-center gap-2 mb-2">
        {collapsible ? (
          <>
            <button
              type="button"
              className="log-collapse-toggle"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
            >
              <i className={`bi ${open ? "bi-chevron-down" : "bi-chevron-right"}`} aria-hidden />
              <strong>{label}</strong>
              {count > 0 && <span className="row-meta">{count}</span>}
            </button>
            <FieldHelp text={help} />
          </>
        ) : (
          <FieldLabel help={help}>{label}</FieldLabel>
        )}
        {showEditor && (
          <ButtonGroup size="sm" className="ms-auto">
            <Button
              type="button"
              variant={mode === "fields" ? "primary" : "outline-primary"}
              onClick={() => (mode === "json" ? switchToFields() : undefined)}
            >
              Fields
            </Button>
            <Button
              type="button"
              variant={mode === "json" ? "primary" : "outline-primary"}
              onClick={() => (mode === "fields" ? switchToJson() : undefined)}
            >
              JSON
            </Button>
          </ButtonGroup>
        )}
      </div>
      {showEditor &&
        (mode === "fields" ? (
          <>
            {rows.map((row) => (
              <InputGroup className="mb-2" key={row.id}>
                <Form.Control
                  placeholder="Name"
                  value={row.name}
                  onChange={(event) =>
                    setFieldRows(
                      rows.map((item) =>
                        item.id === row.id ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                />
                <Form.Control
                  placeholder="Value"
                  value={row.value}
                  onChange={(event) =>
                    setFieldRows(
                      rows.map((item) =>
                        item.id === row.id ? { ...item, value: event.target.value } : item,
                      ),
                    )
                  }
                />
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => setFieldRows(rows.filter((item) => item.id !== row.id))}
                >
                  Remove
                </Button>
              </InputGroup>
            ))}
            <Button
              variant="outline-secondary"
              size="sm"
              type="button"
              onClick={() => setFieldRows([...rows, { id: nextId, name: "", value: "" }])}
            >
              Add header
            </Button>
          </>
        ) : (
          <>
            <Form.Control
              id={`${id}-json`}
              as="textarea"
              rows={8}
              className="header-json"
              value={jsonText}
              isInvalid={Boolean(jsonError)}
              onChange={(event) => {
                const text = event.target.value;
                setJsonText(text);
                const parsed = parseHeaderJson(text);
                if ("error" in parsed) {
                  setJsonError(parsed.error);
                  return;
                }

                setJsonError(null);
                onChange(parsed.headers);
              }}
            />
            <Form.Control.Feedback type="invalid">{jsonError}</Form.Control.Feedback>
            <Form.Text>
              Object of header names to values, for example {`{ "X-Test": "1" }`}
            </Form.Text>
          </>
        ))}
    </Form.Group>
  );
}
