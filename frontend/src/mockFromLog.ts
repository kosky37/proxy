import type { IgnoredPathDto, LogDetailDto, MockDto } from './store/types'

export function mockFromLog(log: LogDetailDto): MockDto {
  const isSoap = log.protocol === 'soap'
  const headers = parseHeaders(log.requestHeaders)
  const soapAction = getSoapAction(headers)
  const operation = isSoap ? getSoapOperation(log.requestBody) : undefined
  const pathPart = log.path.replace(/\/+$/, '').split('/').filter(Boolean).at(-1) || 'request'
  const rawName = isSoap ? operation || localName(soapAction) || pathPart : `${log.method}-${pathPart}`

  return {
    name: sanitizeName(rawName),
    fileName: '',
    enabled: true,
    type: isSoap ? 'soap' : 'rest',
    match: {
      pathMode: 'exact',
      path: log.path,
      methods: [log.method],
      soapAction: soapAction ?? null,
      operation: operation ?? null,
    },
    response: {
      statusCode: 200,
      delayMs: 0,
      contentType: isSoap ? 'text/xml' : 'application/json',
      block: false,
    },
  }
}

export function ignoreFromLog(log: LogDetailDto): IgnoredPathDto {
  const pathPart = log.path.replace(/\/+$/, '').split('/').filter(Boolean).at(-1) || 'request'
  return {
    name: sanitizeName(`${log.method}-${pathPart}`),
    fileName: '',
    path: log.path,
    pathMode: 'exact',
    methods: log.method ? [log.method] : [],
  }
}

function parseHeaders(raw?: string | null): Record<string, string> {
  if (!raw) {
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

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return match?.[1]
}

function getSoapAction(headers: Record<string, string>): string | undefined {
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

function getSoapOperation(body?: string | null): string | undefined {
  if (!body) {
    return undefined
  }

  try {
    const document = new DOMParser().parseFromString(body, 'text/xml')
    if (document.querySelector('parsererror')) {
      return undefined
    }

    const envelope = findLocal(document, 'Envelope')
    const soapBody = envelope ? findLocal(envelope, 'Body') : null
    return soapBody?.children[0]?.localName
  } catch {
    return undefined
  }
}

function findLocal(root: ParentNode, localName: string): Element | null {
  return Array.from(root.querySelectorAll('*')).find((element) => element.localName === localName) ?? null
}

function localName(action?: string): string | undefined {
  if (!action) {
    return undefined
  }

  const slash = action.lastIndexOf('/')
  const hash = action.lastIndexOf('#')
  const index = Math.max(slash, hash)
  return index >= 0 && index < action.length - 1 ? action.slice(index + 1) : action
}

function sanitizeName(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '-') || 'mock'
}
