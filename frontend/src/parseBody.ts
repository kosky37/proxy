export interface ParsedField {
  name: string
  value: string
}

export interface ParsedNode {
  id: string
  name: string
  value?: string
  children?: ParsedNode[]
}

export function parseBody(raw?: string | null): ParsedNode[] | null {
  if (!raw?.trim()) {
    return null
  }

  return tryParseJson(raw) ?? tryParseXml(raw)
}

function tryParseJson(raw: string): ParsedNode[] | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      const nodes = parsed.map((item, index) => toJsonNode(`[${index + 1}]`, item, `[${index}]`))
      return nodes.length > 0 ? nodes : null
    }

    if (parsed && typeof parsed === 'object') {
      const nodes = Object.entries(parsed).map(([key, value]) => toJsonNode(key, value, key))
      return nodes.length > 0 ? nodes : null
    }

    return [{ id: 'value', name: 'value', value: String(parsed) }]
  } catch {
    return null
  }
}

function toJsonNode(name: string, value: unknown, id: string): ParsedNode {
  if (value === null || value === undefined) {
    return { id, name, value: '' }
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { id, name, value: '[]' }
    }

    return {
      id,
      name,
      children: value.map((item, index) => toJsonNode(`[${index + 1}]`, item, `${id}[${index}]`)),
    }
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      return { id, name, value: '{}' }
    }

    return {
      id,
      name,
      children: entries.map(([key, child]) => toJsonNode(key, child, `${id}.${key}`)),
    }
  }

  return { id, name, value: String(value) }
}

function tryParseXml(raw: string): ParsedNode[] | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('<')) {
    return null
  }

  const document = new DOMParser().parseFromString(trimmed, 'text/xml')
  if (document.querySelector('parsererror') || !document.documentElement) {
    return null
  }

  const soap = soapPayload(document)
  if (soap) {
    const nodes: ParsedNode[] = []
    if (soap.operation) {
      nodes.push({ id: 'Operation', name: 'Operation', value: soap.operation })
    }
    nodes.push(...elementsToNodes(soap.roots, 'soap'))
    return nodes.length > 0 ? nodes : null
  }

  return [elementToNode(document.documentElement, document.documentElement.localName)]
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

function elementsToNodes(elements: Element[], parentId: string): ParsedNode[] {
  const totals = new Map<string, number>()
  for (const element of elements) {
    totals.set(element.localName, (totals.get(element.localName) ?? 0) + 1)
  }

  const seen = new Map<string, number>()
  return elements.map((element) => {
    const total = totals.get(element.localName) ?? 1
    const index = (seen.get(element.localName) ?? 0) + 1
    seen.set(element.localName, index)
    const name = total > 1 ? `${element.localName} [${index}]` : element.localName
    return elementToNode(element, `${parentId}/${name}`, name)
  })
}

function elementToNode(element: Element, id: string, name = element.localName): ParsedNode {
  const children: ParsedNode[] = []
  for (const attribute of element.attributes) {
    if (attribute.name.startsWith('xmlns')) {
      continue
    }

    children.push({
      id: `${id}@${attribute.localName}`,
      name: `@${attribute.localName}`,
      value: attribute.value,
    })
  }

  children.push(...elementsToNodes([...element.children], id))
  const text = elementText(element)

  if (children.length === 0) {
    return { id, name, value: text }
  }

  return { id, name, value: text || undefined, children }
}

function elementText(element: Element): string {
  return [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
}

function findLocal(root: ParentNode, localName: string): Element | null {
  return Array.from(root.querySelectorAll('*')).find((element) => element.localName === localName) ?? null
}
