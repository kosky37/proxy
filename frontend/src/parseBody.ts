export interface ParsedField {
  name: string
  value: string
}

export function parseBody(raw?: string | null): ParsedField[] | null {
  if (!raw?.trim()) {
    return null
  }

  return tryParseJson(raw) ?? tryParseXml(raw)
}

function tryParseJson(raw: string): ParsedField[] | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null
  }

  try {
    const rows: ParsedField[] = []
    flattenJson(JSON.parse(trimmed), '', rows)
    return rows.length > 0 ? rows : null
  } catch {
    return null
  }
}

function flattenJson(value: unknown, path: string, rows: ParsedField[]) {
  if (value === null || value === undefined) {
    if (path) {
      rows.push({ name: path, value: '' })
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenJson(item, path ? `${path}[${index}]` : `[${index}]`, rows))
    return
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flattenJson(child, path ? `${path}.${key}` : key, rows)
    }
    return
  }

  rows.push({ name: path || 'value', value: String(value) })
}

function tryParseXml(raw: string): ParsedField[] | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('<')) {
    return null
  }

  const document = new DOMParser().parseFromString(trimmed, 'text/xml')
  if (document.querySelector('parsererror') || !document.documentElement) {
    return null
  }

  const rows: ParsedField[] = []
  const soap = soapPayload(document)
  if (soap) {
    if (soap.operation) {
      rows.push({ name: 'Operation', value: soap.operation })
    }
    for (const child of soap.roots) {
      flattenXml(child, '', rows)
    }
    return rows.length > 0 ? rows : null
  }

  flattenXml(document.documentElement, '', rows)
  return rows.length > 0 ? rows : null
}

function soapPayload(document: Document): { operation: string | null; roots: Element[] } | null {
  const envelope = findLocal(document, 'Envelope')
  if (!envelope) {
    return null
  }

  const body = findLocal(envelope, 'Body')
  const children = body ? [...body.children] : []
  if (children.length === 1) {
    const operation = children[0]
    return { operation: operation.localName, roots: [...operation.children] }
  }

  return { operation: null, roots: children }
}

function flattenXml(element: Element, prefix: string, rows: ParsedField[]) {
  const path = prefix ? `${prefix}.${element.localName}` : element.localName
  for (const attribute of element.attributes) {
    if (attribute.name.startsWith('xmlns')) {
      continue
    }

    rows.push({ name: `${path}@${attribute.localName}`, value: attribute.value })
  }

  const children = [...element.children]
  const text = [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ')

  if (children.length === 0) {
    rows.push({ name: path, value: text })
    return
  }

  if (text) {
    rows.push({ name: path, value: text })
  }

  for (const child of children) {
    flattenXml(child, path, rows)
  }
}

function findLocal(root: ParentNode, localName: string): Element | null {
  return Array.from(root.querySelectorAll('*')).find((element) => element.localName === localName) ?? null
}
