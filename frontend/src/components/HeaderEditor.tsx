import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Segmented, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import {
  compactHeaders,
  headersToRows,
  parseHeaderJson,
  rowsToHeaders,
  stringifyHeaders,
  type HeaderRow,
} from "../headers";
import { FieldLabel, type HelpContent } from "./FieldHelp";

interface Props {
  resetKey: string;
  label: string;
  help: HelpContent;
  value: Record<string, string> | null | undefined;
  onChange: (value: Record<string, string> | null) => void;
  collapsible?: boolean;
  /** Singular noun for buttons and JSON errors, e.g. "header" or "query parameter". */
  itemNoun?: string;
  namePlaceholder?: string;
  valuePlaceholder?: string;
}

export function HeaderEditor({
  resetKey,
  label,
  help,
  value,
  onChange,
  collapsible = false,
  itemNoun = "header",
  namePlaceholder = "Name",
  valuePlaceholder = "Value",
}: Props) {
  const [mode, setMode] = useState<"fields" | "json">("fields");
  const [open, setOpen] = useState(!collapsible);
  const [rows, setRows] = useState<HeaderRow[]>(() => headersToRows(value));
  const [jsonText, setJsonText] = useState(() => stringifyHeaders(value));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setMode("fields");
    setOpen(!collapsible);
    setRows(headersToRows(value));
    setJsonText(stringifyHeaders(value));
    setJsonError(null);
  }, [resetKey, collapsible]);

  const count = Object.keys(compactHeaders(value) ?? {}).length;

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
    const parsed = parseHeaderJson(jsonText, itemNoun);
    if ("error" in parsed) {
      setJsonError(parsed.error);
      return;
    }

    setRows(headersToRows(parsed.headers));
    onChange(parsed.headers);
    setJsonError(null);
    setMode("fields");
  };

  const body = (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      {mode === "fields" ? (
        <>
          {rows.map((row) => (
            <Space.Compact key={row.id} style={{ width: "100%" }}>
              <Input
                placeholder={namePlaceholder}
                style={{ width: "35%" }}
                value={row.name}
                onChange={(event) =>
                  setFieldRows(
                    rows.map((item) =>
                      item.id === row.id ? { ...item, name: event.target.value } : item,
                    ),
                  )
                }
              />
              <Input
                placeholder={valuePlaceholder}
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
                icon={<DeleteOutlined />}
                aria-label={`Remove ${itemNoun}`}
                onClick={() => setFieldRows(rows.filter((item) => item.id !== row.id))}
              />
            </Space.Compact>
          ))}
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() =>
              setFieldRows([
                ...rows,
                { id: rows.reduce((max, row) => Math.max(max, row.id), 0) + 1, name: "", value: "" },
              ])
            }
          >
            Add {itemNoun}
          </Button>
        </>
      ) : (
        <>
          <Input.TextArea
            rows={8}
            value={jsonText}
            status={jsonError ? "error" : undefined}
            style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 12 }}
            onChange={(event) => {
              const text = event.target.value;
              setJsonText(text);
              const parsed = parseHeaderJson(text, itemNoun);
              if ("error" in parsed) {
                setJsonError(parsed.error);
                return;
              }

              setJsonError(null);
              onChange(parsed.headers);
            }}
          />
          {jsonError && <Alert type="error" message={jsonError} showIcon />}
          <Typography.Text className="app-subtle">
            Object of {itemNoun}s, for example {'{ "X-Test": "1" }'}
          </Typography.Text>
        </>
      )}
    </Space>
  );

  if (collapsible) {
    return (
      <div>
        <div className="app-row" style={{ gap: 8, marginBottom: 8 }}>
          <Button
            type="text"
            size="small"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
          >
            <FieldLabel help={help}>{label}</FieldLabel>
            {count > 0 && <span className="app-subtle">({count})</span>}
          </Button>
          <div style={{ marginLeft: "auto" }} />
        </div>
        {open && (
          <>
            <div style={{ marginBottom: 8 }}>
              <Segmented
                size="small"
                value={mode}
                options={[
                  { label: "Fields", value: "fields" },
                  { label: "JSON", value: "json" },
                ]}
                onChange={(next) => (next === "json" ? switchToJson() : switchToFields())}
              />
            </div>
            {body}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="app-row" style={{ gap: 8, marginBottom: 8 }}>
        <FieldLabel help={help}>{label}</FieldLabel>
        <div style={{ marginLeft: "auto" }}>
          <Segmented
            size="small"
            value={mode}
            options={[
              { label: "Fields", value: "fields" },
              { label: "JSON", value: "json" },
            ]}
            onChange={(next) => (next === "json" ? switchToJson() : switchToFields())}
          />
        </div>
      </div>
      {body}
    </div>
  );
}
