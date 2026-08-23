import { useState } from 'react'
import { Button } from 'react-bootstrap'

interface Props {
  value?: string | null
  label?: string
  size?: 'sm'
}

export function CopyButton({ value, label = 'Copy', size = 'sm' }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(value ?? '')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Button variant="outline-secondary" size={size} onClick={copy} disabled={!value}>
      {copied ? 'Copied' : label}
    </Button>
  )
}
