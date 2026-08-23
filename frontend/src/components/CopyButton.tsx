import { useState } from 'react'
import { Button } from 'react-bootstrap'

interface Props {
  value?: string | null
  label?: string
}

export function CopyButton({ value, label = 'Copy' }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(value ?? '')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Button
      variant="link"
      size="sm"
      className="copy-icon-button p-0"
      onClick={copy}
      disabled={!value}
      title={copied ? 'Copied' : label}
      aria-label={copied ? 'Copied' : label}
    >
      <i className={`bi ${copied ? 'bi-check-lg' : 'bi-clipboard'}`} />
    </Button>
  )
}
