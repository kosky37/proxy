import { useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Stack, Table } from 'react-bootstrap'
import {
  useDeleteCertificateMutation,
  useGenerateRootCertificateMutation,
  useLazyGetCertificateStoreStatusQuery,
} from '../store/proxyApi'
import type { CertificateDto, CertificateStoreStatusDto } from '../store/types'

function apiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) {
      return data.message
    }
  }
  return fallback
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

interface Props {
  certificates: CertificateDto[]
}

export function RootCertificatePanel({ certificates }: Props) {
  const roots = certificates.filter((item) => item.type === 'root')
  const [showGenerate, setShowGenerate] = useState(false)
  const [statusByName, setStatusByName] = useState<Record<string, CertificateStoreStatusDto>>({})
  const [checking, setChecking] = useState<string | null>(null)
  const [checkStore] = useLazyGetCertificateStoreStatusQuery()
  const [deleteCertificate] = useDeleteCertificateMutation()

  const refreshStatus = async (name: string) => {
    setChecking(name)
    try {
      const status = await checkStore(name).unwrap()
      setStatusByName((current) => ({ ...current, [name]: status }))
    } finally {
      setChecking(null)
    }
  }

  return (
    <>
      <Card className="mb-4">
        <Card.Body>
          <Stack direction="horizontal" className="mb-3 align-items-start">
            <div>
              <h2 className="h5 mb-1">Root certificate</h2>
              <div className="row-meta">
                Generate a local CA, download it, and install it in the Windows Trusted Root store.
                HTTPS server certificates can then be issued from it.
              </div>
            </div>
            <Button className="ms-auto" variant="outline-primary" onClick={() => setShowGenerate(true)}>
              Generate root certificate
            </Button>
          </Stack>

          {roots.length === 0 ? (
            <div>No root certificate yet. Generate one to sign HTTPS listener certificates.</div>
          ) : (
            <Table striped responsive className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Subject</th>
                  <th>Expires</th>
                  <th>Windows store</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {roots.map((certificate) => {
                  const status = statusByName[certificate.name]
                  const installed = status?.installed ?? certificate.rootStoreInstalled === true
                  const locations = status?.locations ?? certificate.rootStoreLocations ?? []
                  return (
                    <tr key={certificate.name}>
                      <td>
                        <div>{certificate.name}</div>
                        {certificate.thumbprint && (
                          <code className="row-meta">{certificate.thumbprint}</code>
                        )}
                      </td>
                      <td>
                        <code>{certificate.subject || '—'}</code>
                      </td>
                      <td>{formatDate(certificate.notAfterUtc)}</td>
                      <td>
                        <Badge bg={installed ? 'success' : 'warning'} text={installed ? undefined : 'dark'}>
                          {installed ? 'Installed' : 'Not installed'}
                        </Badge>
                        {installed && locations.length > 0 && (
                          <div className="row-meta mt-1">
                            {locations.map((item) => `${item.storeLocation}/${item.storeName}`).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="text-end">
                        <Stack direction="horizontal" gap={1} className="justify-content-end">
                          <a
                            className="btn btn-outline-primary btn-sm"
                            href={`/api/certificates/${encodeURIComponent(certificate.name)}/public`}
                            download={`${certificate.name}.cer`}
                          >
                            Download
                          </a>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            disabled={checking === certificate.name}
                            onClick={() => void refreshStatus(certificate.name)}
                          >
                            {checking === certificate.name ? (
                              <>
                                <Spinner animation="border" size="sm" /> Checking
                              </>
                            ) : (
                              'Check store'
                            )}
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => deleteCertificate(certificate.name)}
                          >
                            Delete
                          </Button>
                        </Stack>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      <GenerateRootModal show={showGenerate} onHide={() => setShowGenerate(false)} />
    </>
  )
}

function GenerateRootModal({ show, onHide }: { show: boolean; onHide: () => void }) {
  const [name, setName] = useState('ProxyMockTool Root CA')
  const [subject, setSubject] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [validityYears, setValidityYears] = useState(10)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [generateRoot] = useGenerateRootCertificateMutation()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await generateRoot({
        name,
        subject: subject.trim() || null,
        password,
        validityYears,
      }).unwrap()
      setName('ProxyMockTool Root CA')
      setSubject('')
      setPassword('')
      setValidityYears(10)
      onHide()
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Could not generate the root certificate.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Generate root certificate</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form id="generate-root-form" onSubmit={submit}>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}
          <Row className="g-3">
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control required value={name} onChange={(event) => setName(event.target.value)} />
                <Form.Text>Catalog name shown on this page.</Form.Text>
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Subject (CN)</Form.Label>
                <Form.Control
                  placeholder={name || 'ProxyMockTool Root CA'}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
                <Form.Text>Leave empty to use the name.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Validity (years)</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={30}
                  value={validityYears}
                  onChange={(event) => setValidityYears(Number(event.target.value))}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Password</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                  <Button
                    variant="outline-secondary"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </Button>
                </InputGroup>
              </Form.Group>
            </Col>
          </Row>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button type="submit" form="generate-root-form" disabled={saving}>
          Generate
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
