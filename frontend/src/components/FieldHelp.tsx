import type { ReactNode } from "react";
import { Form, OverlayTrigger, Stack, Tooltip } from "react-bootstrap";

export const pathModeHelp =
  "Exact: only this path. Example: /accounts matches /accounts, not /accounts/1. Prefix: this path and anything under it, so /accounts also matches /accounts/1. Template: {name} stands for one segment, so /accounts/{id} matches /accounts/42 but not /accounts/42/orders.";

export function FieldHelp({
  text,
  placement = "right",
}: {
  text: string;
  placement?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <OverlayTrigger
      placement={placement}
      overlay={<Tooltip className="tooltip-wide">{text}</Tooltip>}
    >
      <i className="bi bi-info-circle field-help" tabIndex={0} aria-label="More information" />
    </OverlayTrigger>
  );
}

export function TabToolbar({ help, children }: { help: string; children: ReactNode }) {
  return (
    <Stack direction="horizontal" className="mb-3 align-items-center gap-2">
      {children}
      <span className="ms-auto tab-help">
        <FieldHelp text={help} placement="left" />
      </span>
    </Stack>
  );
}

export function FieldLabel({ children, help }: { children: ReactNode; help: string }) {
  return (
    <Form.Label className="d-inline-flex align-items-center gap-1">
      <span>{children}</span>
      <FieldHelp text={help} />
    </Form.Label>
  );
}
