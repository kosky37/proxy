import { UploadOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Modal, Row, Segmented, Select, Typography, Upload } from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  useGenerateServerCertificateMutation,
  useGetCertificatesQuery,
  useGetWindowsStoreCertificatesQuery,
  useUploadCertificateMutation,
} from "../store/proxyApi";
import type { CertificateDto } from "../store/types";
import { FieldLabel } from "./FieldHelp";

const blank = (): CertificateDto => ({
  name: "",
  fileName: "",
  type: "client",
  source: "file",
  pfxPath: "",
  password: "",
  storeName: "My",
  storeLocation: "CurrentUser",
  thumbprint: "",
});

interface Props {
  open: boolean;
  initial?: CertificateDto | null;
  onSave: (certificate: CertificateDto) => Promise<void>;
  onCancel: () => void;
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { message?: string } }).data;
    if (data?.message) {
      return data.message;
    }
  }
  return fallback;
}

export function CertificateEditor({ open, initial, onSave, onCancel }: Props) {
  const [certificate, setCertificate] = useState<CertificateDto>(initial ?? blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hosts, setHosts] = useState("localhost\n127.0.0.1");
  const [rootCertificateName, setRootCertificateName] = useState("");
  const [validityYears, setValidityYears] = useState(2);
  const [upload, uploadState] = useUploadCertificateMutation();
  const [generateServer] = useGenerateServerCertificateMutation();
  const isNew = !initial?.name;

  const source =
    certificate.source === "windowsStore"
      ? "windowsStore"
      : certificate.source === "generate"
        ? "generate"
        : "file";

  const windowsStore = useGetWindowsStoreCertificatesQuery(
    { location: certificate.storeLocation ?? "CurrentUser", store: certificate.storeName ?? "My" },
    { skip: !open || source !== "windowsStore" },
  );
  const catalog = useGetCertificatesQuery(undefined, { skip: !open || source !== "generate" });
  const roots = catalog.data?.filter((item) => item.type === "root") ?? [];

  useEffect(() => {
    if (open) {
      setCertificate(initial ?? blank());
      setError(null);
      setHosts("localhost\n127.0.0.1");
      setRootCertificateName("");
      setValidityYears(2);
    }
  }, [initial, open]);

  const pickFile = async (file: File) => {
    try {
      const uploaded = await upload({ file, name: certificate.name }).unwrap();
      setCertificate((current) => ({ ...current, pfxPath: uploaded.pfxPath ?? "", source: "file" }));
    } catch (caught) {
      setError(apiErrorMessage(caught, "Could not upload the certificate file."));
    }
  };

  const submit = async () => {
    setError(null);
    if (!certificate.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    try {
      if (source === "generate") {
        if (!rootCertificateName) {
          setError("Select a root certificate.");
          return;
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
        }).unwrap();
        onCancel();
        return;
      }

      await onSave({
        ...certificate,
        source,
        pfxPath: source === "file" ? certificate.pfxPath : null,
        password: source === "file" ? certificate.password : null,
        storeName: source === "windowsStore" ? certificate.storeName || "My" : null,
        storeLocation:
          source === "windowsStore" ? certificate.storeLocation || "CurrentUser" : null,
        thumbprint: source === "windowsStore" ? certificate.thumbprint : null,
      });
    } catch (caught) {
      setError(apiErrorMessage(caught, "Could not save the certificate."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial?.name ? `Edit ${initial.name}` : "New certificate"}
      width={760}
      okText={source === "generate" ? "Generate" : "Save"}
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={onCancel}
      destroyOnHidden
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      <Row gutter={[16, 12]}>
        <Col xs={24} md={16}>
          <FieldLabel help="Catalog name used when selecting this certificate in a proxy.">
            Name
          </FieldLabel>
          <Input
            style={{ marginTop: 4 }}
            value={certificate.name}
            onChange={(event) => setCertificate({ ...certificate, name: event.target.value })}
          />
        </Col>
        <Col xs={24} md={8}>
          <FieldLabel
            help={{
              summary: "The two kinds are used in different directions.",
              points: [
                { label: "Server", text: "Secures an HTTPS listener; the client sees it." },
                {
                  label: "Client",
                  text: "Presented to the destination when this proxy calls it.",
                },
              ],
            }}
          >
            Type
          </FieldLabel>
          <Segmented
            block
            style={{ marginTop: 4 }}
            value={certificate.type}
            options={[
              { value: "client", label: "Client" },
              { value: "server", label: "Server" },
            ]}
            onChange={(value) => {
              const type = String(value);
              setCertificate({
                ...certificate,
                type,
                source: type !== "server" && source === "generate" ? "file" : certificate.source,
              });
            }}
          />
        </Col>
        <Col span={24}>
          <FieldLabel
            help={{
              summary: "Where the private key comes from.",
              points: [
                { label: "Certificate file", text: "A `.pfx` uploaded to the server." },
                { label: "Windows store", text: "A certificate already installed on this machine." },
                { label: "Generate from root CA", text: "A new server certificate signed by one of the root CAs below." },
              ],
            }}
          >
            Source
          </FieldLabel>
          <Select
            style={{ width: "100%", marginTop: 4 }}
            value={source}
            onChange={(value) =>
              setCertificate({
                ...certificate,
                source: value,
                type: value === "generate" ? "server" : certificate.type,
              })
            }
            options={[
              { value: "file", label: "Certificate file" },
              { value: "windowsStore", label: "Windows certificate store" },
              ...(isNew ? [{ value: "generate", label: "Generate from root CA" }] : []),
            ]}
          />
        </Col>

        {source === "file" && (
          <>
            <Col span={24}>
              <FieldLabel help={"Path of the uploaded `.pfx` on the server. **Browse** uploads a file and fills this in."}>
                Certificate file
              </FieldLabel>
              <div className="app-row" style={{ gap: 8, marginTop: 4 }}>
                <Input
                  placeholder="client.pfx"
                  value={certificate.pfxPath ?? ""}
                  onChange={(event) =>
                    setCertificate({ ...certificate, pfxPath: event.target.value })
                  }
                />
                <Upload
                  accept=".pfx,.p12,.pem,.crt,.cer"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    void pickFile(file as unknown as File);
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />} loading={uploadState.isLoading}>
                    Browse
                  </Button>
                </Upload>
              </div>
            </Col>
            <Col span={24}>
              <FieldLabel help="Password protecting the private key. Stored in the proxy catalog file.">
                Password
              </FieldLabel>
              <Input.Password
                style={{ marginTop: 4 }}
                autoComplete="new-password"
                value={certificate.password ?? ""}
                onChange={(event) =>
                  setCertificate({ ...certificate, password: event.target.value })
                }
              />
            </Col>
          </>
        )}

        {source === "generate" && (
          <>
            <Col span={24}>
              <FieldLabel help="Root CA used to sign the new server certificate.">Root CA</FieldLabel>
              <Select
                style={{ width: "100%", marginTop: 4 }}
                value={rootCertificateName || undefined}
                placeholder="Select a root certificate…"
                onChange={setRootCertificateName}
                options={roots.map((item) => ({ value: item.name, label: item.name }))}
              />
              {roots.length === 0 && !catalog.isLoading && (
                <Typography.Text className="app-subtle">
                  Generate a root certificate on the <Link to="/certificates">Certificates</Link> page
                  first.
                </Typography.Text>
              )}
            </Col>
            <Col span={24}>
              <FieldLabel
                help={
                  "One DNS name or IP per line.\n- Each entry is added as a Subject Alternative Name.\n- Defaults to `localhost` when left empty."
                }
              >
                Host names
              </FieldLabel>
              <Input.TextArea
                style={{ marginTop: 4 }}
                rows={3}
                value={hosts}
                onChange={(event) => setHosts(event.target.value)}
              />
            </Col>
            <Col xs={24} md={12}>
              <FieldLabel help="How long the certificate stays valid.">Validity (years)</FieldLabel>
              <Input
                type="number"
                min={1}
                max={10}
                style={{ marginTop: 4 }}
                value={validityYears}
                onChange={(event) => setValidityYears(Number(event.target.value))}
              />
            </Col>
            <Col xs={24} md={12}>
              <FieldLabel help="Protects the generated private key file.">Password</FieldLabel>
              <Input.Password
                style={{ marginTop: 4 }}
                autoComplete="new-password"
                value={certificate.password ?? ""}
                onChange={(event) =>
                  setCertificate({ ...certificate, password: event.target.value })
                }
              />
            </Col>
          </>
        )}

        {source === "windowsStore" && (
          <>
            <Col xs={24} md={12}>
              <FieldLabel
                help={{
                  summary: "Which certificates the store lookup can see.",
                  points: [
                    { label: "Current user", text: "Visible to this Windows account only." },
                    { label: "Local machine", text: "Shared by every user on this machine." },
                  ],
                }}
              >
                Store location
              </FieldLabel>
              <Select
                style={{ width: "100%", marginTop: 4 }}
                value={certificate.storeLocation ?? "CurrentUser"}
                onChange={(value) =>
                  setCertificate({ ...certificate, storeLocation: value, thumbprint: "" })
                }
                options={[
                  { value: "CurrentUser", label: "Current user" },
                  { value: "LocalMachine", label: "Local machine" },
                ]}
              />
            </Col>
            <Col xs={24} md={12}>
              <FieldLabel help="Which Windows store to read.">Store name</FieldLabel>
              <Select
                style={{ width: "100%", marginTop: 4 }}
                value={certificate.storeName ?? "My"}
                onChange={(value) =>
                  setCertificate({ ...certificate, storeName: value, thumbprint: "" })
                }
                options={[
                  { value: "My", label: "Personal (My)" },
                  { value: "Root", label: "Trusted Root" },
                  { value: "CertificateAuthority", label: "Intermediate CA" },
                  { value: "TrustedPeople", label: "Trusted People" },
                  { value: "TrustedPublisher", label: "Trusted Publisher" },
                ]}
              />
            </Col>
            <Col span={24}>
              <FieldLabel help={"Uses a certificate already installed on this Windows machine, so no password is stored."}>
                Certificate
              </FieldLabel>
              <Select
                style={{ width: "100%", marginTop: 4 }}
                value={certificate.thumbprint || undefined}
                placeholder="Select a certificate…"
                loading={windowsStore.isLoading}
                onChange={(value) => setCertificate({ ...certificate, thumbprint: value })}
                options={(windowsStore.data ?? []).map((item) => ({
                  value: item.thumbprint,
                  label: `${item.friendlyName || item.subject}${
                    item.hasPrivateKey ? "" : " (no private key)"
                  } — ${item.thumbprint.slice(0, 8)}…`,
                }))}
              />
              {windowsStore.isError && (
                <Typography.Text type="danger">
                  Could not read the Windows certificate store.
                </Typography.Text>
              )}
            </Col>
          </>
        )}
      </Row>
      <Typography.Text className="app-subtle">
        Certificates are shared across proxies; edit or delete them here and reassign them in the
        proxy settings.
      </Typography.Text>
    </Modal>
  );
}
