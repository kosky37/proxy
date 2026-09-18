import { CheckOutlined, CopyOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useState } from "react";
import { HelpTooltip } from "./FieldHelp";

interface Props {
  value?: string | null;
  label?: string;
  text?: string;
}

export function CopyButton({ value, label = "Copy", text }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value ?? "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <HelpTooltip help={copied ? "Copied." : label}>
      <Button
        type="text"
        size="small"
        aria-label={copied ? "Copied" : label}
        disabled={!value}
        icon={copied ? <CheckOutlined /> : <CopyOutlined />}
        onClick={(event) => {
          event.stopPropagation();
          void copy();
        }}
      >
        {text}
      </Button>
    </HelpTooltip>
  );
}
