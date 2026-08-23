import { useEffect, useState, type FormEvent } from 'react'
import { Button, Col, Form, Modal, Row } from 'react-bootstrap'
import type { IgnoredPathDto } from '../store/types'

const blank = (): IgnoredPathDto => ({
  name: '',
  fileName: '',
  path: '',
  pathMode: 'exact',
  methods: [],
})

interface Props {
  show: boolean
  initial?: IgnoredPathDto | null
  onSave: (ignore: IgnoredPathDto) => Promise<void>
  onCancel: () => void
}

export function IgnoreEditor({ show, initial, onSave, onCancel }: Props) {
  const [ignore, setIgnore] = useState<IgnoredPathDto>(initial ?? blank())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (show) {
      setIgnore(initial ?? blank())
    }
  }, [initial, show])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave(ignore)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={show} onHide={onCancel}>
      <Form onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title>{initial?.name ? `Edit ${initial.name}` : 'New ignore'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control
                  required
                  value={ignore.name}
                  onChange={(event) => setIgnore({ ...ignore, name: event.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Path mode</Form.Label>
                <Form.Select
                  value={ignore.pathMode}
                  onChange={(event) => setIgnore({ ...ignore, pathMode: event.target.value })}
                >
                  <option value="exact">exact</option>
                  <option value="prefix">prefix</option>
                  <option value="template">template</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Path</Form.Label>
                <Form.Control
                  required
                  placeholder="/health"
                  value={ignore.path}
                  onChange={(event) => setIgnore({ ...ignore, path: event.target.value })}
                />
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Methods (optional, comma)</Form.Label>
                <Form.Control
                  placeholder="GET, POST"
                  value={(ignore.methods ?? []).join(', ')}
                  onChange={(event) =>
                    setIgnore({
                      ...ignore,
                      methods: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <Form.Text>Leave empty to ignore every method for this path.</Form.Text>
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            Save
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
