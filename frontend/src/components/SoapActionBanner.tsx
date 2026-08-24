import { Stack } from 'react-bootstrap'
import { CopyButton } from './CopyButton'

export function SoapActionBanner({ action, compact = false }: { action?: string | null; compact?: boolean }) {
  const value = action?.trim() || 'none'

  if (compact) {
    return (
      <div className="soap-action-line">
        <span className="soap-action-label">SOAPAction</span>
        <strong>{value}</strong>
      </div>
    )
  }

  return (
    <div className="soap-action-bar">
      <Stack direction="horizontal" gap={2} className="flex-wrap align-items-center">
        <span className="soap-action-label mb-0">SOAPAction</span>
        <code className="soap-action-value">{value}</code>
        {action?.trim() ? <CopyButton value={action.trim()} label="Copy SOAPAction" /> : null}
      </Stack>
    </div>
  )
}
