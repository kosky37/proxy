import { useRef } from 'react'
import { Button, Form, InputGroup, Spinner } from 'react-bootstrap'
import { useUploadCertificateMutation } from '../store/proxyApi'
import type { CertificateDto } from '../store/types'

interface Props {
  label: string
  proxyId: string
  value?: CertificateDto | null
  onChange: (value: CertificateDto) => void
}

export function CertPathField({ label, proxyId, value, onChange }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [upload, uploadState] = useUploadCertificateMutation()

  const pickFile = async (file: File | undefined) => {
    if (!file) {
      return
    }

    const uploaded = await upload({ proxyId, file }).unwrap()
    onChange({
      pfxPath: uploaded.pfxPath,
      password: value?.password ?? '',
    })
  }

  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>{label}</Form.Label>
        <InputGroup>
          <Form.Control
            type="text"
            placeholder="certs/client.pfx"
            value={value?.pfxPath ?? ''}
            onChange={(event) => onChange({ ...value, pfxPath: event.target.value })}
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
        <Form.Text>
          Choose a certificate file or enter a path relative to the proxy folder.
          {uploadState.isLoading && (
            <>
              {' '}
              <Spinner animation="border" size="sm" /> Uploading…
            </>
          )}
        </Form.Text>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{label} password</Form.Label>
        <Form.Control
          type="password"
          value={value?.password ?? ''}
          onChange={(event) => onChange({ ...value, password: event.target.value })}
        />
      </Form.Group>
    </>
  )
}
