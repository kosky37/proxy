import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Col, Form, InputGroup, Modal, Row, Spinner } from 'react-bootstrap'
import { useUploadCertificateMutation } from '../store/proxyApi'
import type { CertificateDto } from '../store/types'

const blank = (): CertificateDto => ({
  name: '',
  fileName: '',
  type: 'client',
  pfxPath: '',
  password: '',
})

interface Props {
  show: boolean
  initial?: CertificateDto | null
  onSave: (certificate: CertificateDto) => Promise<void>
  onCancel: () => void
}

export function CertificateEditor({ show, initial, onSave, onCancel }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [certificate, setCertificate] = useState<CertificateDto>(initial ?? blank())
  const [saving, setSaving] = useState(false)
  const [upload, uploadState] = useUploadCertificateMutation()

  useEffect(() => {
    if (show) {
      setCertificate(initial ?? blank())
    }
  }, [initial, show])

  const pickFile = async (file: File | undefined) => {
    if (!file) {
      return
    }

    const uploaded = await upload({ file, name: certificate.name }).unwrap()
    setCertificate((current) => ({ ...current, pfxPath: uploaded.pfxPath ?? '' }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave(certificate)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={show} onHide={onCancel}>
      <Form onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title>{initial?.name ? `Edit ${initial.name}` : 'New certificate'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={8}>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control
                  required
                  value={certificate.name}
                  onChange={(event) => setCertificate({ ...certificate, name: event.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Type</Form.Label>
                <Form.Select
                  value={certificate.type}
                  onChange={(event) => setCertificate({ ...certificate, type: event.target.value })}
                >
                  <option value="client">Client</option>
                  <option value="server">Server</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Certificate file</Form.Label>
                <InputGroup>
                  <Form.Control
                    required
                    placeholder="client.pfx"
                    value={certificate.pfxPath ?? ''}
                    onChange={(event) => setCertificate({ ...certificate, pfxPath: event.target.value })}
                  />
                  <Button
                    variant="outline-secondary"
                    disabled={uploadState.isLoading}
                    onClick={() => fileInput.current?.click()}
                  >
                    Browse
                  </Button>
                </InputGroup>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pfx,.p12,.pem,.crt,.cer"
                  hidden
                  onChange={(event) => {
                    void pickFile(event.currentTarget.files?.[0])
                    event.currentTarget.value = ''
                  }}
                />
                {uploadState.isLoading && (
                  <Form.Text>
                    <Spinner animation="border" size="sm" /> Uploading…
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={certificate.password ?? ''}
                  onChange={(event) => setCertificate({ ...certificate, password: event.target.value })}
                />
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
