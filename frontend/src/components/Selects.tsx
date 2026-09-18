import { Select } from "antd";

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

interface MethodSelectProps {
  id?: string;
  value: string[];
  onChange: (methods: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function MethodSelect({
  id,
  value,
  onChange,
  multiple = false,
  disabled = false,
  placeholder,
}: MethodSelectProps) {
  const options = httpMethods.map((method) => ({ value: method, label: method }));

  if (multiple) {
    return (
      <Select
        id={id}
        mode="tags"
        allowClear
        disabled={disabled}
        style={{ width: "100%" }}
        placeholder={placeholder ?? "Any method"}
        value={value}
        options={options}
        tokenSeparators={[",", " "]}
        onChange={(next: string[]) => onChange(normalizeMethods(next))}
      />
    );
  }

  return (
    <Select
      id={id}
      disabled={disabled}
      style={{ width: "100%" }}
      placeholder={placeholder ?? "Method"}
      value={value[0]}
      options={options}
      showSearch
      onChange={(next: string) => onChange(normalizeMethods([next]))}
    />
  );
}

interface ContentTypeSelectProps {
  id?: string;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ContentTypeSelect({
  id,
  value,
  onChange,
  placeholder = "application/json",
}: ContentTypeSelectProps) {
  return (
    <Select
      id={id}
      style={{ width: "100%" }}
      placeholder={placeholder}
      mode="tags"
      maxCount={1}
      value={value ? [value] : []}
      options={contentTypes.map((item) => ({ value: item, label: item }))}
      onChange={(next: string[]) => onChange(next.at(-1)?.trim() ?? "")}
    />
  );
}

function normalizeMethods(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim().toUpperCase()).filter(Boolean))];
}
