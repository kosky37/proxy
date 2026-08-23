const polishTime: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
}

const polishDate: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}

export function formatTime(value: string | number | Date) {
  return new Date(value).toLocaleTimeString('pl-PL', polishTime)
}

export function formatDate(value: string | number | Date) {
  return new Date(value).toLocaleDateString('pl-PL', polishDate)
}

export function formatDateTime(value: string | number | Date) {
  return `${formatTime(value)}, ${formatDate(value)}`
}

export type LogWindowPreset = '1h' | '6h' | '24h' | '7d' | 'all'

export function logWindow(preset: LogWindowPreset, nowMs: number): { from?: string; to?: string } {
  if (preset === 'all') {
    return {}
  }

  const to = new Date(nowMs)
  const from = new Date(to)
  if (preset === '1h') {
    from.setHours(from.getHours() - 1)
  } else if (preset === '6h') {
    from.setHours(from.getHours() - 6)
  } else if (preset === '7d') {
    from.setDate(from.getDate() - 7)
  } else {
    from.setDate(from.getDate() - 1)
  }

  return { from: from.toISOString(), to: to.toISOString() }
}

export function formatBytes(bytes?: number | null, truncated = false): string {
  const value = bytes ?? 0
  const units = ['B', 'KB', 'MB', 'GB']
  let amount = value
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024
    unit += 1
  }

  const text = unit === 0 ? `${amount} ${units[unit]}` : `${amount.toFixed(1)} ${units[unit]}`
  return truncated ? `${text} (exceeded)` : text
}

export function hasAdvancedMatch(match: {
  pathMode?: string
  query?: Record<string, string> | null
  headers?: Record<string, string> | null
  bodyContains?: string | null
  bodyRegex?: string | null
  jsonPath?: string | null
  jsonPathEquals?: string | null
  operation?: string | null
  xpath?: string | null
}): boolean {
  if (match.pathMode && match.pathMode !== 'exact') {
    return true
  }

  if (match.query && Object.keys(match.query).length > 0) {
    return true
  }

  if (match.headers && Object.keys(match.headers).length > 0) {
    return true
  }

  return Boolean(
    match.bodyContains ||
      match.bodyRegex ||
      match.jsonPath ||
      match.jsonPathEquals ||
      match.operation ||
      match.xpath,
  )
}
