import type { LogDetailDto } from './store/types'

export interface HeaderRow {
  id: number
  name: string
  value: string
}

export interface SendDraft {
  protocol: 'rest' | 'soap'
  method: string
  path: string
  query: string
  headers: Record<string, string>
  body: string
  contentType: string
  soapAction: string
  authorization: string
}

const hopByHop = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
])

export function parseHeaders(raw?: string | null): Record<string, string> {
  if (!raw?.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, value == null ? '' : String(value)]),
      )
    }
  } catch {
    return {}
  }

  return {}
}

export function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return match?.[1]
}

export function omitHeaders(headers: Record<string, string>, names: string[]): Record<string, string> {
  const skip = new Set(names.map((name) => name.toLowerCase()))
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !hopByHop.has(key.toLowerCase()) && !skip.has(key.toLowerCase())),
  )
}

export function compactHeaders(headers: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!headers) {
    return null
  }

  const compact = Object.fromEntries(
    Object.entries(headers)
      .map(([key, value]) => [key.trim(), value] as const)
      .filter(([key]) => key.length > 0),
  )
  return Object.keys(compact).length > 0 ? compact : null
}

export function headersToRows(headers: Record<string, string> | null | undefined): HeaderRow[] {
  const entries = Object.entries(headers ?? {}).filter(([name]) => name.trim())
  if (entries.length === 0) {
    return [{ id: 1, name: '', value: '' }]
  }

  return entries.map(([name, value], index) => ({ id: index + 1, name, value }))
}

export function rowsToHeaders(rows: HeaderRow[]): Record<string, string> | null {
  return compactHeaders(Object.fromEntries(rows.map((row) => [row.name, row.value])))
}

export function stringifyHeaders(headers: Record<string, string> | null | undefined): string {
  const compact = compactHeaders(headers)
  return JSON.stringify(compact ?? {}, null, 2)
}

export function parseHeaderJson(text: string): { headers: Record<string, string> | null } | { error: string } {
  if (!text.trim()) {
    return { headers: null }
  }

  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: 'Headers JSON must be an object of name/value pairs.' }
    }

    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (value != null && typeof value === 'object') {
        return { error: 'Header values must be strings.' }
      }

      headers[key] = value == null ? '' : String(value)
    }

    return { headers: compactHeaders(headers) }
  } catch {
    return { error: 'Invalid JSON.' }
  }
}

export function sendFromLog(log: LogDetailDto): SendDraft {
  const isSoap = log.protocol === 'soap'
  const requestHeaders = parseHeaders(log.requestHeaders)
  const contentType = getHeader(requestHeaders, 'Content-Type') ?? (isSoap ? 'text/xml; charset=utf-8' : 'application/json')
  const soapAction = getSoapAction(requestHeaders) ?? ''
  const authorization = getHeader(requestHeaders, 'Authorization') ?? ''
  const headers = omitHeaders(requestHeaders, ['Content-Type', 'SOAPAction', 'Authorization', 'Accept-Encoding'])

  return {
    protocol: isSoap ? 'soap' : 'rest',
    method: isSoap ? 'POST' : log.method || 'GET',
    path: log.path || '/',
    query: log.query?.replace(/^\?/, '') ?? '',
    headers,
    body: log.requestBody ?? '',
    contentType,
    soapAction,
    authorization,
  }
}

export function getSoapAction(headers: Record<string, string>): string | undefined {
  const soapAction = getHeader(headers, 'SOAPAction')
  if (soapAction?.trim()) {
    return soapAction.trim().replace(/^"+|"+$/g, '')
  }

  const contentType = getHeader(headers, 'Content-Type')
  if (!contentType) {
    return undefined
  }

  for (const part of contentType.split(';')) {
    const trimmed = part.trim()
    const equals = trimmed.indexOf('=')
    if (equals <= 0) {
      continue
    }

    if (trimmed.slice(0, equals).trim().toLowerCase() === 'action') {
      return trimmed.slice(equals + 1).trim().replace(/^"+|"+$/g, '')
    }
  }

  return undefined
}
