import type { ReactNode } from "react";
import { FieldHelp, type HelpContent } from "./FieldHelp";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="app-page-header">
      <div style={{ minWidth: 0, flex: "1 1 320px" }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>{title}</h1>
        {description ? <div className="app-subtle">{description}</div> : null}
      </div>
      {actions ? <div className="app-wrap">{actions}</div> : null}
    </div>
  );
}

export function TabToolbar({ help, children }: { help: HelpContent; children: ReactNode }) {
  return (
    <div className="app-row" style={{ gap: 8, marginBottom: 12 }}>
      {children}
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
        <FieldHelp text={help} placement="left" />
      </span>
    </div>
  );
}
