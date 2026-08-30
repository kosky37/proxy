import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Badge, Button, Col, Form, Modal, Row, Stack } from 'react-bootstrap'
import type { MockDto, MockSetDto } from '../store/types'

const blank = (): MockSetDto => ({
  name: '',
  fileName: '',
  mockNames: [],
})

type TypeFilter = 'all' | 'rest' | 'soap'

interface Props {
  show: boolean
  initial?: MockSetDto | null
  isNew?: boolean
  mocks: MockDto[]
  onSave: (set: MockSetDto) => Promise<void>
  onCancel: () => void
}

export function MockSetEditor({ show, initial, isNew = !initial?.name, mocks, onSave, onCancel }: Props) {
  const [set, setSet] = useState<MockSetDto>(initial ?? blank())
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (show) {
      setSet(initial ?? blank())
      setQuery('')
      setTypeFilter('all')
    }
  }, [initial, show])

  const selectedLookup = useMemo(() => new Set(set.mockNames.map((name) => name.toLowerCase())), [set.mockNames])
  const mocksByName = useMemo(() => {
    const map = new Map<string, MockDto>()
    for (const mock of mocks) {
      map.set(mock.name.toLowerCase(), mock)
    }
    return map
  }, [mocks])

  const selectedItems = useMemo(
    () =>
      set.mockNames.map((name) => ({
        name,
        mock: mocksByName.get(name.toLowerCase()),
      })),
    [mocksByName, set.mockNames],
  )
  const availableItems = useMemo(
    () =>
      mocks
        .filter((mock) => !selectedLookup.has(mock.name.toLowerCase()))
        .map((mock) => ({ name: mock.name, mock })),
    [mocks, selectedLookup],
  )

  const visibleSelected = useMemo(
    () => selectedItems.filter((item) => matchesPicker(item, query, typeFilter)).sort(comparePicker),
    [query, selectedItems, typeFilter],
  )
  const visibleAvailable = useMemo(
    () => availableItems.filter((item) => matchesPicker(item, query, typeFilter)).sort(comparePicker),
    [availableItems, query, typeFilter],
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave(set)
    } finally {
      setSaving(false)
    }
  }

  const addNames = (names: string[]) => {
    if (names.length === 0) {
      return
    }
    const next = new Set(set.mockNames)
    for (const name of names) {
      if (![...next].some((item) => item.toLowerCase() === name.toLowerCase())) {
        next.add(name)
      }
    }
    setSet({ ...set, mockNames: [...next] })
  }

  const removeNames = (names: string[]) => {
    const drop = new Set(names.map((name) => name.toLowerCase()))
    setSet({ ...set, mockNames: set.mockNames.filter((name) => !drop.has(name.toLowerCase())) })
  }

  const addVisible = () => addNames(visibleAvailable.map((item) => item.name))
  const removeVisible = () => removeNames(visibleSelected.map((item) => item.name))

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    const first = visibleAvailable[0]
    if (first) {
      addNames([first.name])
    }
  }

  return (
    <Modal show={show} onHide={onCancel} dialogClassName="mock-set-modal" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{isNew ? 'New mock set' : `Edit ${initial?.name}`}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form id="mock-set-form" onSubmit={submit}>
          <Row className="g-3">
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control
                  required
                  value={set.name}
                  onChange={(event) => setSet({ ...set, name: event.target.value })}
                />
                <Form.Text>Applying this set enables the mocks in the left list and disables every other mock.</Form.Text>
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Stack direction="horizontal" gap={2} className="flex-wrap align-items-center">
                <Form.Control
                  className="mock-set-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Search by name, path, method, or SOAP action"
                  aria-label="Search mocks"
                />
                <div className="mock-set-type-filter">
                  {(['all', 'rest', 'soap'] as const).map((value) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={typeFilter === value ? 'primary' : 'outline-secondary'}
                      onClick={() => setTypeFilter(value)}
                    >
                      {value === 'all' ? 'All' : value.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </Stack>
              <div className="row-meta mt-2">
                {mocks.length === 0
                  ? 'Create mocks first, then add them to a set.'
                  : 'Type to filter, click a mock to move it, or press Enter to add the first match.'}
              </div>
            </Col>
            <Col xs={12}>
              <div className="mock-set-picker">
                <PickerPane
                  title="In this set"
                  shown={visibleSelected.length}
                  total={selectedItems.length}
                  empty={
                    selectedItems.length === 0
                      ? 'No mocks selected. Apply would disable every mock.'
                      : 'No selected mocks match this search.'
                  }
                  actionLabel={query || typeFilter !== 'all' ? 'Remove matches' : 'Remove all'}
                  actionDisabled={visibleSelected.length === 0}
                  onAction={removeVisible}
                >
                  {visibleSelected.map((item) => (
                    <PickerRow key={item.name} item={item} action="remove" onClick={() => removeNames([item.name])} />
                  ))}
                </PickerPane>
                <PickerPane
                  title="Available"
                  shown={visibleAvailable.length}
                  total={availableItems.length}
                  empty={
                    availableItems.length === 0
                      ? mocks.length === 0
                        ? 'No mocks exist yet.'
                        : 'Every mock is already in this set.'
                      : 'No available mocks match this search.'
                  }
                  actionLabel={query || typeFilter !== 'all' ? 'Add matches' : 'Add all'}
                  actionDisabled={visibleAvailable.length === 0}
                  onAction={addVisible}
                >
                  {visibleAvailable.map((item) => (
                    <PickerRow key={item.name} item={item} action="add" onClick={() => addNames([item.name])} />
                  ))}
                </PickerPane>
              </div>
            </Col>
          </Row>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" form="mock-set-form" disabled={saving}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

interface PickerItem {
  name: string
  mock?: MockDto
}

function PickerPane({
  title,
  shown,
  total,
  empty,
  actionLabel,
  actionDisabled,
  onAction,
  children,
}: {
  title: string
  shown: number
  total: number
  empty: string
  actionLabel: string
  actionDisabled: boolean
  onAction: () => void
  children: ReactNode
}) {
  return (
    <div className="mock-set-pane">
      <div className="mock-set-pane-header">
        <div>
          <div className="editor-section-title mb-0">{title}</div>
          <div className="row-meta">
            {shown === total ? `${total}` : `${shown} of ${total}`}
          </div>
        </div>
        <Button type="button" size="sm" variant="outline-secondary" disabled={actionDisabled} onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
      <div className="mock-set-pane-list">
        {shown === 0 ? <div className="mock-set-empty">{empty}</div> : children}
      </div>
    </div>
  )
}

function PickerRow({
  item,
  action,
  onClick,
}: {
  item: PickerItem
  action: 'add' | 'remove'
  onClick: () => void
}) {
  const mock = item.mock
  const type = mock?.type === 'soap' ? 'SOAP' : 'REST'
  const summary = mockSummary(mock)

  return (
    <button type="button" className="mock-set-item" onClick={onClick}>
      <div className="mock-set-item-main">
        <div className="mock-set-item-title">
          <span>{item.name}</span>
          {mock ? (
            <Badge bg="secondary">{type}</Badge>
          ) : (
            <Badge bg="warning" text="dark">
              missing
            </Badge>
          )}
          {mock && !mock.enabled && <span className="row-meta">disabled</span>}
        </div>
        <div className="row-meta">{summary}</div>
      </div>
      <i className={`bi ${action === 'add' ? 'bi-plus-lg' : 'bi-x-lg'}`} aria-hidden />
    </button>
  )
}

function mockSummary(mock?: MockDto) {
  if (!mock) {
    return 'This mock no longer exists'
  }
  const methods = mock.match.methods?.filter(Boolean) ?? []
  const target =
    mock.type === 'soap'
      ? mock.match.soapAction || mock.match.operation || '*'
      : mock.match.path || '*'
  const method = mock.type === 'soap' ? 'SOAP' : methods.length > 0 ? methods.join(', ') : 'any'
  return `${method} ${target}`
}

function matchesPicker(item: PickerItem, query: string, typeFilter: TypeFilter) {
  const type = item.mock?.type === 'soap' ? 'soap' : item.mock ? 'rest' : null
  if (typeFilter !== 'all' && type !== typeFilter) {
    return false
  }

  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }

  const haystack = [
    item.name,
    item.mock?.fileName,
    item.mock?.type,
    item.mock?.match.path,
    item.mock?.match.soapAction,
    item.mock?.match.operation,
    ...(item.mock?.match.methods ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

function comparePicker(left: PickerItem, right: PickerItem) {
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
}
