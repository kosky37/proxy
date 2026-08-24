import type { LogListItemDto } from '../store/types'
import { CopyButton } from './CopyButton'

export function soapActionText(action?: string | null) {
  return action?.trim() || 'no SOAPAction'
}

export function LogRequestLine({
  item,
}: {
  item: Pick<LogListItemDto, 'protocol' | 'method' | 'path' | 'query' | 'soapAction'>
}) {
  if (item.protocol === 'soap') {
    return (
      <div>
        <strong className="text-break">{soapActionText(item.soapAction)}</strong>
      </div>
    )
  }

  return (
    <div>
      <strong>{item.method}</strong> {item.path}
      {item.query ? <span className="text-secondary">?{item.query}</span> : null}
    </div>
  )
}

export function SoapActionTitle({ action }: { action?: string | null }) {
  const value = action?.trim()
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <span className="text-break">{soapActionText(action)}</span>
      {value ? <CopyButton value={value} label="Copy SOAPAction" /> : null}
    </span>
  )
}
