import { useState } from 'react'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import type { ParsedNode } from '../parseBody'
import { CopyButton } from './CopyButton'

export function BodyTree({ nodes, empty }: { nodes: ParsedNode[]; empty: string }) {
  if (nodes.length === 0) {
    return <div className="body-tree border rounded px-2 py-2 text-secondary">{empty}</div>
  }

  return (
    <div className="body-tree border rounded">
      <div className="body-tree-header">
        <span />
        <span>Name</span>
        <span>Value</span>
        <span />
      </div>
      {nodes.map((node) => (
        <TreeNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  )
}

function TreeNode({ node, depth }: { node: ParsedNode; depth: number }) {
  const children = node.children ?? []
  const nestable = children.length > 0
  const [open, setOpen] = useState(true)

  return (
    <div className="body-tree-block">
      <div
        className={`body-tree-row${nestable ? ' is-group' : ''}`}
        style={{ paddingLeft: `${0.45 + depth * 1.05}rem` }}
        onClick={nestable ? () => setOpen((value) => !value) : undefined}
        role={nestable ? 'button' : undefined}
        aria-expanded={nestable ? open : undefined}
      >
        {nestable ? (
          <i className={`bi ${open ? 'bi-chevron-down' : 'bi-chevron-right'} body-tree-chevron`} aria-hidden />
        ) : (
          <span />
        )}
        <span className="body-tree-name" title={node.name}>
          {node.name}
          {nestable && <span className="body-tree-count">({children.length})</span>}
        </span>
        <ValueCell value={node.value} />
        <span className="text-center" onClick={(event) => event.stopPropagation()}>
          <CopyButton value={node.value} label={`Copy ${node.name}`} />
        </span>
      </div>
      {nestable && open &&
        children.map((child) => <TreeNode key={child.id} node={child} depth={depth + 1} />)}
    </div>
  )
}

function ValueCell({ value }: { value?: string }) {
  if (value == null || value === '') {
    return <span />
  }

  return (
    <OverlayTrigger overlay={<Tooltip className="tooltip-wide">{value}</Tooltip>}>
      <code className="body-tree-value">{value}</code>
    </OverlayTrigger>
  )
}
