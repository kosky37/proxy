import { CaretDownOutlined, CaretRightOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { ParsedNode } from "../parseBody";
import { CopyButton } from "./CopyButton";
import { ValueTooltip } from "./FieldHelp";

interface Row {
  node: ParsedNode;
  depth: number;
  expandable: boolean;
  expanded: boolean;
}

export function BodyTree({ nodes, empty }: { nodes: ParsedNode[]; empty: string }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (nodes.length === 0) {
    return (
      <div className="body-tree app-subtle" style={{ padding: "8px 10px" }}>
        {empty}
      </div>
    );
  }

  const rows: Row[] = [];
  const walk = (list: ParsedNode[], depth: number) => {
    for (const node of list) {
      const expandable = (node.children?.length ?? 0) > 0;
      const expanded = !collapsed[node.id];
      rows.push({ node, depth, expandable, expanded });
      if (expandable && expanded) {
        walk(node.children ?? [], depth + 1);
      }
    }
  };
  walk(nodes, 0);

  return (
    <div className="body-tree">
      <div className="body-tree-header">
        <span />
        <span>Name</span>
        <span>Value</span>
        <span />
      </div>
      {rows.map((row) => (
        <div
          key={row.node.id}
          className={`body-tree-row${row.expandable ? " is-group" : ""}`}
          style={{ paddingLeft: 8 + row.depth * 16 }}
          role={row.expandable ? "button" : undefined}
          onClick={
            row.expandable
              ? () => setCollapsed((current) => ({ ...current, [row.node.id]: !current[row.node.id] }))
              : undefined
          }
        >
          {row.expandable ? (
            row.expanded ? (
              <CaretDownOutlined />
            ) : (
              <CaretRightOutlined />
            )
          ) : (
            <span />
          )}
          <span className="body-tree-name" title={row.node.name}>
            {row.node.name}
            {row.expandable && <span className="body-tree-count">({row.node.children?.length})</span>}
          </span>
          {row.node.value ? (
            <ValueTooltip value={row.node.value} className="body-tree-value">
              {row.node.value}
            </ValueTooltip>
          ) : (
            <span />
          )}
          <span onClick={(event) => event.stopPropagation()}>
            <CopyButton value={row.node.value} label={`Copy ${row.node.name}`} />
          </span>
        </div>
      ))}
    </div>
  );
}
