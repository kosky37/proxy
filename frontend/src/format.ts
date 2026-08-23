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
  return truncated ? `${text}+` : text
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
