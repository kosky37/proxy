import { useState } from 'react'
import { Badge, Button, Stack, Table } from 'react-bootstrap'
import { CertificateEditor } from '../components/CertificateEditor'
import {
  useCreateCertificateMutation,
  useDeleteCertificateMutation,
  useGetCertificatesQuery,
  useUpdateCertificateMutation,
} from '../store/proxyApi'
import type { CertificateDto } from '../store/types'

export function CertificatesPage() {
  const certificates = useGetCertificatesQuery()
  const [editing, setEditing] = useState<CertificateDto | null | undefined>(undefined)
  const [createCertificate] = useCreateCertificateMutation()
  const [updateCertificate] = useUpdateCertificateMutation()
  const [deleteCertificate] = useDeleteCertificateMutation()

  const save = async (certificate: CertificateDto) => {
    if (editing?.name) {
      await updateCertificate({ name: editing.name, body: certificate }).unwrap()
    } else {
      await createCertificate(certificate).unwrap()
    }
    setEditing(undefined)
  }

  return (
    <>
      <Stack direction="horizontal" className="mb-3">
        <div>
          <h1 className="h3 mb-0">Certificates</h1>
          <div>Shared catalog. Select a certificate on each proxy's Settings page.</div>
        </div>
        <Button className="ms-auto" onClick={() => setEditing(null)}>
          Add certificate
        </Button>
      </Stack>

      <Table striped responsive className="align-middle">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>File</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {certificates.data?.map((certificate) => (
            <tr key={certificate.name}>
              <td>{certificate.name}</td>
              <td>
                <Badge
                  bg={certificate.type === 'server' ? 'warning' : 'primary'}
                  text={certificate.type === 'server' ? 'dark' : undefined}
                >
                  {certificate.type === 'server' ? 'Server' : 'Client'}
                </Badge>
              </td>
              <td>
                <code>{certificate.pfxPath}</code>
              </td>
              <td className="text-end">
                <Stack direction="horizontal" gap={1} className="justify-content-end">
                  <Button variant="outline-primary" size="sm" onClick={() => setEditing(certificate)}>
                    Edit
                  </Button>
                  <Button variant="outline-danger" size="sm" onClick={() => deleteCertificate(certificate.name)}>
                    Delete
                  </Button>
                </Stack>
              </td>
            </tr>
          ))}
          {certificates.data?.length === 0 && (
            <tr>
              <td colSpan={4}>No certificates defined. Add one here, then select it on a proxy.</td>
            </tr>
          )}
        </tbody>
      </Table>
      <CertificateEditor
        show={editing !== undefined}
        initial={editing}
        onSave={save}
        onCancel={() => setEditing(undefined)}
      />
    </>
  )
}
