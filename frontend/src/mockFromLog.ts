import type { IgnoredPathDto, LogDetailDto, MockDto } from './store/types'
import { compactHeaders, getHeader, getSoapAction, omitHeaders, parseHeaders } from './headers'

export function mockFromLog(log: LogDetailDto): MockDto {
  const isSoap = log.protocol === 'soap'
  const requestHeaders = parseHeaders(log.requestHeaders)
  const responseHeaders = parseHeaders(log.responseHeaders)
  const soapAction = getSoapAction(requestHeaders)
  const operation = isSoap ? getSoapOperation(log.requestBody) : undefined
  const pathPart = log.path.replace(/\/+$/, '').split('/').filter(Boolean).at(-1) || 'request'
  const rawName = isSoap ? operation || localName(soapAction) || pathPart : `${log.method}-${pathPart}`
  const responseType =
    contentTypeOnly(getHeader(responseHeaders, 'Content-Type')) ?? (isSoap ? 'text/xml' : 'application/json')

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
      headers: compactHeaders(
        omitHeaders(requestHeaders, [
          ...(isSoap ? ['SOAPAction'] : []),
          'Accept',
          'Accept-Encoding',
          'Accept-Language',
          'User-Agent',
          'Cookie',
          'Origin',
          'Referer',
        ]),
      ),
    },
    response: {
      statusCode: log.statusCode ?? 200,
      delayMs: 0,
      contentType: responseType,
      headers: compactHeaders(omitHeaders(responseHeaders, ['Content-Type'])),
      body: log.responseBody ?? '',
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

function contentTypeOnly(value?: string): string | undefined {
  if (!value?.trim()) {
    return undefined
  }

  return value.split(';', 2)[0]?.trim() || undefined
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
