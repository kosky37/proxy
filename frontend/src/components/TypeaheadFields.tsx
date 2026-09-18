import { Typeahead } from "react-bootstrap-typeahead";

export const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export const contentTypes = [
  "application/json",
  "application/xml",
  "text/xml",
  "application/soap+xml",
  "text/plain",
  "text/html",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "application/problem+json",
  "application/octet-stream",
];

export function MethodTypeahead({
  id,
  selected,
  onChange,
  multiple = false,
  disabled = false,
  placeholder,
}: {
  id: string;
  selected: string[];
  onChange: (methods: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Typeahead
      id={id}
      multiple={multiple}
      options={httpMethods}
      selected={selected}
      allowNew
      newSelectionPrefix="Use "
      placeholder={placeholder ?? (multiple ? "Any method" : "Method")}
      positionFixed
      flip
      disabled={disabled}
      onChange={(items) => onChange(uniqueUpper(optionLabels(items)))}
    />
  );
}

export function ContentTypeTypeahead({
  id,
  value,
  onChange,
  placeholder = "application/json",
}: {
  id: string;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Typeahead
      id={id}
      options={contentTypes}
      selected={value ? [value] : []}
      allowNew
      newSelectionPrefix="Use "
      placeholder={placeholder}
      positionFixed
      flip
      onChange={(items) => onChange(optionLabels(items)[0] ?? "")}
    />
  );
}

function optionLabels(selected: Array<string | { label?: string }>): string[] {
  return selected
    .map((item) => (typeof item === "string" ? item : String(item.label ?? "")))
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueUpper(values: string[]): string[] {
  return [...new Set(values.map((item) => item.toUpperCase()))];
}
