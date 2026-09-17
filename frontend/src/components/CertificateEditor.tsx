import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, Button, Col, Form, InputGroup, Modal, Row, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import {
  useGenerateServerCertificateMutation,
  useGetCertificatesQuery,
  useGetWindowsStoreCertificatesQuery,
  useUploadCertificateMutation,
} from '../store/proxyApi'
import type { CertificateDto } from '../store/types'

const blank = (): CertificateDto => ({
  name: '',
  fileName: '',
  type: 'client',
  source: 'file',
  pfxPath: '',
  password: '',
  storeName: 'My',
  storeLocation: 'CurrentUser',
  thumbprint: '',
})

interface Props {
  show: boolean
  initial?: CertificateDto | null
  onSave: (certificate: CertificateDto) => Promise<void>
  onCancel: () => void
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) {
      return data.message
    }
  }
  return fallback
}

export function CertificateEditor({ show, initial, onSave, onCancel }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [certificate, setCertificate] = useState<CertificateDto>(initial ?? blank())
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hosts, setHosts] = useState('localhost\n127.0.0.1')
  const [rootCertificateName, setRootCertificateName] = useState('')
  const [validityYears, setValidityYears] = useState(2)
  const [upload, uploadState] = useUploadCertificateMutation()
  const [generateServer] = useGenerateServerCertificateMutation()
  const isNew = !initial?.name
  const source = certificate.source === 'windowsStore'
    ? 'windowsStore'
    : certificate.source === 'generate'
      ? 'generate'
      : 'file'
  const windowsStore = useGetWindowsStoreCertificatesQuery(
    { location: certificate.storeLocation ?? 'CurrentUser', store: certificate.storeName ?? 'My' },
    { skip: !show || source !== 'windowsStore' },
  )
  const catalog = useGetCertificatesQuery(undefined, { skip: !show || source !== 'generate' })
  const roots = catalog.data?.filter((item) => item.type === 'root') ?? []

  useEffect(() => {
    if (show) {
      setCertificate(initial ?? blank())
      setShowPassword(false)
      setError(null)
      setHosts('localhost\n127.0.0.1')
      setRootCertificateName('')
      setValidityYears(2)
    }
  }, [initial, show])

  const pickFile = async (file: File | undefined) => {
    if (!file) {
      return
    }

    const uploaded = await upload({ file, name: certificate.name }).unwrap()
    setCertificate((current) => ({ ...current, pfxPath: uploaded.pfxPath ?? '', source: 'file' }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (source === 'generate') {
        if (!rootCertificateName) {
          setError('Select a root certificate.')
          return
        }

        await generateServer({
          name: certificate.name,
          rootCertificateName,
          hosts: hosts
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean),
          password: certificate.password,
          validityYears,
        }).unwrap()
        onCancel()
        return
      }

      await onSave({
        ...certificate,
        source,
        pfxPath: source === 'file' ? certificate.pfxPath : null,
        password: source === 'file' ? certificate.password : null,
        storeName: source === 'windowsStore' ? certificate.storeName || 'My' : null,
        storeLocation: source === 'windowsStore' ? certificate.storeLocation || 'CurrentUser' : null,
        thumbprint: source === 'windowsStore' ? certificate.thumbprint : null,
      })
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Could not save the certificate.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={show} onHide={onCancel} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{initial?.name ? `Edit ${initial.name}` : 'New certificate'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form id="certificate-form" onSubmit={submit}>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}
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
                  onChange={(event) => {
                    const type = event.target.value
                    setCertificate({
                      ...certificate,
                      type,
                      source: type !== 'server' && source === 'generate' ? 'file' : certificate.source,
                    })
                  }}
                >
                  <option value="client">Client</option>
                  <option value="server">Server</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Source</Form.Label>
                <Form.Select
                  value={source}
                  onChange={(event) =>
                    setCertificate({
                      ...certificate,
                      source: event.target.value,
                      type: event.target.value === 'generate' ? 'server' : certificate.type,
                    })
                  }
                >
                  <option value="file">Certificate file</option>
                  <option value="windowsStore">Windows certificate store</option>
                  {isNew && <option value="generate">Generate from root CA</option>}
                </Form.Select>
              </Form.Group>
            </Col>

            {source === 'file' ? (
              <>
                <Col xs={12}>
                  <Form.Group>
                    <Form.Label>Certificate file</Form.Label>
                    <InputGroup>
                      <Form.Control
                        required
                        placeholder="client.pfx"
                        value={certificate.pfxPath ?? ''}
                        onChange={(event) =>
                          setCertificate({ ...certificate, pfxPath: event.target.value })
                        }
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
                    <InputGroup>
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        value={certificate.password ?? ''}
                        onChange={(event) =>
                          setCertificate({ ...certificate, password: event.target.value })
                        }
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
              </>
            ) : source === 'generate' ? (
              <>
                <Col xs={12}>
                  <Form.Group>
                    <Form.Label>Root CA</Form.Label>
                    {catalog.isLoading && (
                      <div>
                        <Spinner animation="border" size="sm" /> Loading root certificates…
                      </div>
                    )}
                    <Form.Select
                      required
                      value={rootCertificateName}
                      onChange={(event) => setRootCertificateName(event.target.value)}
                    >
                      <option value="">Select a root certificate…</option>
                      {roots.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </Form.Select>
                    {roots.length === 0 && !catalog.isLoading && (
                      <Form.Text>
                        Generate a root certificate on the{' '}
                        <Link to="/certificates">Certificates</Link> page first.
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col xs={12}>
                  <Form.Group>
                    <Form.Label>Host names</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={hosts}
                      onChange={(event) => setHosts(event.target.value)}
                    />
                    <Form.Text>
                      One DNS name or IP per line. Added as Subject Alternative Names. Defaults to
                      localhost if empty.
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Validity (years)</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      max={10}
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
                        value={certificate.password ?? ''}
                        onChange={(event) =>
                          setCertificate({ ...certificate, password: event.target.value })
                        }
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
                    <Form.Text>Protects the generated private key file.</Form.Text>
                  </Form.Group>
                </Col>
              </>
            ) : (
              <>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Store location</Form.Label>
                    <Form.Select
                      value={certificate.storeLocation ?? 'CurrentUser'}
                      onChange={(event) =>
                        setCertificate({
                          ...certificate,
                          storeLocation: event.target.value,
                          thumbprint: '',
                        })
                      }
                    >
                      <option value="CurrentUser">Current user</option>
                      <option value="LocalMachine">Local machine</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Store name</Form.Label>
                    <Form.Select
                      value={certificate.storeName ?? 'My'}
                      onChange={(event) =>
                        setCertificate({
                          ...certificate,
                          storeName: event.target.value,
                          thumbprint: '',
                        })
                      }
                    >
                      <option value="My">Personal (My)</option>
                      <option value="Root">Trusted Root</option>
                      <option value="CertificateAuthority">Intermediate CA</option>
                      <option value="TrustedPeople">Trusted People</option>
                      <option value="TrustedPublisher">Trusted Publisher</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12}>
                  <Form.Group>
                    <Form.Label>Certificate</Form.Label>
                    {windowsStore.isLoading && (
                      <div>
                        <Spinner animation="border" size="sm" /> Loading store…
                      </div>
                    )}
                    {windowsStore.isError && (
                      <Form.Text className="text-danger">
                        Could not read the Windows certificate store.
                      </Form.Text>
                    )}
                    <Form.Select
                      required
                      value={certificate.thumbprint ?? ''}
                      onChange={(event) =>
                        setCertificate({ ...certificate, thumbprint: event.target.value })
                      }
                    >
                      <option value="">Select a certificate…</option>
                      {windowsStore.data?.map((item) => (
                        <option key={item.thumbprint} value={item.thumbprint}>
                          {(item.friendlyName || item.subject) +
                            (item.hasPrivateKey ? '' : ' (no private key)') +
                            ` — ${item.thumbprint.slice(0, 8)}…`}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text>
                      Uses the certificate already installed on this Windows machine. No password is
                      stored.
                    </Form.Text>
                  </Form.Group>
                </Col>
              </>
            )}
          </Row>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" form="certificate-form" disabled={saving}>
          {source === 'generate' ? 'Generate' : 'Save'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
