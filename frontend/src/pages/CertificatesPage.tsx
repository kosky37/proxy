import { useState } from "react";
import { Badge, Button, Stack, Table } from "react-bootstrap";
import { CertificateEditor } from "../components/CertificateEditor";
import { RootCertificatePanel } from "../components/RootCertificatePanel";
import {
  useCreateCertificateMutation,
  useDeleteCertificateMutation,
  useGetCertificatesQuery,
  useUpdateCertificateMutation,
} from "../store/proxyApi";
import type { CertificateDto } from "../store/types";

export function CertificatesPage() {
  const certificates = useGetCertificatesQuery();
  const [editing, setEditing] = useState<CertificateDto | null | undefined>(undefined);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [createCertificate] = useCreateCertificateMutation();
  const [updateCertificate] = useUpdateCertificateMutation();
  const [deleteCertificate] = useDeleteCertificateMutation();
  const catalog = certificates.data ?? [];
  const leafCertificates = catalog.filter((item) => item.type !== "root");

  const save = async (certificate: CertificateDto) => {
    if (editing?.name) {
      await updateCertificate({ name: editing.name, body: certificate }).unwrap();
    } else {
      await createCertificate(certificate).unwrap();
    }
    setEditing(undefined);
  };

  const locationLabel = (certificate: CertificateDto) => {
    if (certificate.source === "windowsStore") {
      return `${certificate.storeLocation ?? "CurrentUser"}/${certificate.storeName ?? "My"}`;
    }
    return certificate.pfxPath || "—";
  };

  return (
    <>
      <Stack direction="horizontal" className="mb-3">
        <div>
          <h1 className="h3 mb-0">Certificates</h1>
          <div>Shared catalog. Select a certificate when creating or editing a proxy.</div>
        </div>
        <Button className="ms-auto" onClick={() => setEditing(null)}>
          Add certificate
        </Button>
      </Stack>

      <RootCertificatePanel certificates={catalog} />

      <h2 className="h5 mb-3">Client and server certificates</h2>
      <Table striped responsive className="align-middle">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Source</th>
            <th>Location</th>
            <th>Password</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {leafCertificates.map((certificate) => {
            const isStore = certificate.source === "windowsStore";
            const showSecret = revealed[certificate.name] === true;
            return (
              <tr key={certificate.name}>
                <td>{certificate.name}</td>
                <td>
                  <Badge
                    bg={certificate.type === "server" ? "warning" : "primary"}
                    text={certificate.type === "server" ? "dark" : undefined}
                  >
                    {certificate.type === "server" ? "Server" : "Client"}
                  </Badge>
                </td>
                <td>{isStore ? "Windows store" : "File"}</td>
                <td>
                  <code>{locationLabel(certificate)}</code>
                </td>
                <td>
                  {isStore ? (
                    <span className="row-meta">n/a</span>
                  ) : certificate.password ? (
                    <Stack direction="horizontal" gap={2} className="align-items-center">
                      <code>{showSecret ? certificate.password : "••••••••"}</code>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0"
                        onClick={() =>
                          setRevealed((current) => ({
                            ...current,
                            [certificate.name]: !showSecret,
                          }))
                        }
                      >
                        {showSecret ? "Hide" : "Show"}
                      </Button>
                    </Stack>
                  ) : (
                    <span className="row-meta">none</span>
                  )}
                </td>
                <td className="text-end">
                  <Stack direction="horizontal" gap={1} className="justify-content-end">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => setEditing(certificate)}
                    >
                      Edit
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
            );
          })}
          {leafCertificates.length === 0 && (
            <tr>
              <td colSpan={6}>
                No client or server certificates yet. Add one here, or generate a server certificate
                from a root CA.
              </td>
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
  );
}
