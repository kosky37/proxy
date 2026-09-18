import {
  CaretDownOutlined,
  CaretRightOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import {
  useDeleteCertificateMutation,
  useGenerateRootCertificateMutation,
  useLazyGetCertificateStoreStatusQuery,
} from "../store/proxyApi";
import type { CertificateDto, CertificateStoreStatusDto } from "../store/types";
import { HelpTooltip } from "./FieldHelp";

function apiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { message?: string } }).data;
    if (data?.message) {
      return data.message;
    }
  }
  return fallback;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

interface Props {
  certificates: CertificateDto[];
}

export function RootCertificatePanel({ certificates }: Props) {
  const { modal, message } = App.useApp();
  const roots = certificates.filter((item) => item.type === "root");
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const open = collapsed === null ? roots.length === 0 : !collapsed;
  const [showGenerate, setShowGenerate] = useState(false);
  const [statusByName, setStatusByName] = useState<Record<string, CertificateStoreStatusDto>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const [checkStore] = useLazyGetCertificateStoreStatusQuery();
  const [deleteCertificate] = useDeleteCertificateMutation();

  const refreshStatus = async (name: string) => {
    setChecking(name);
    try {
      const status = await checkStore(name).unwrap();
      setStatusByName((current) => ({ ...current, [name]: status }));
    } catch {
      message.error("Could not read the Windows certificate store.");
    } finally {
      setChecking(null);
    }
  };

  const confirmDelete = (certificate: CertificateDto) => {
    modal.confirm({
      title: `Delete root certificate ${certificate.name}?`,
      content:
        "Server certificates issued from this root stay on disk. The browser will no longer trust them once the root is removed.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: () => deleteCertificate(certificate.name),
    });
  };

  const columns: ColumnsType<CertificateDto> = [
    {
      title: "Name",
      dataIndex: "name",
      render: (name: string, certificate) => (
        <div>
          <div>{name}</div>
          {certificate.thumbprint && (
            <code className="app-code">{certificate.thumbprint}</code>
          )}
        </div>
      ),
    },
    {
      title: "Subject",
      dataIndex: "subject",
      render: (subject: string | null) => <code className="app-code">{subject || "—"}</code>,
    },
    {
      title: "Expires",
      dataIndex: "notAfterUtc",
      width: 120,
      render: (value: string | null) => formatDate(value),
    },
    {
      title: "Windows store",
      key: "store",
      width: 220,
      render: (_value, certificate) => {
        const status = statusByName[certificate.name];
        const installed = status?.installed ?? certificate.rootStoreInstalled === true;
        const locations = status?.locations ?? certificate.rootStoreLocations ?? [];
        return (
          <div>
            <Tag color={installed ? "green" : "orange"}>
              {installed ? "Installed" : "Not installed"}
            </Tag>
            {installed && locations.length > 0 && (
              <div className="app-subtle">
                {locations.map((item) => `${item.storeLocation}/${item.storeName}`).join(", ")}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 300,
      align: "right",
      render: (_value, certificate) => (
        <Space size={4}>
          <HelpTooltip help="Download the public `.cer` file. Installing it in the Windows **Trusted Root** store makes browsers and other clients trust the certificates this proxy generates.">
            <Button
              size="small"
              icon={<DownloadOutlined />}
              href={`/api/certificates/${encodeURIComponent(certificate.name)}/public`}
              download={`${certificate.name}.cer`}
            >
              Download
            </Button>
          </HelpTooltip>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={checking === certificate.name}
            onClick={() => void refreshStatus(certificate.name)}
          >
            Check store
          </Button>
          <Button size="small" danger onClick={() => confirmDelete(certificate)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        size="small"
        style={{ marginBottom: 20 }}
        title={
          <Space size={12}>
            <Button
              type="text"
              size="small"
              onClick={() => setCollapsed(open)}
              icon={open ? <CaretDownOutlined /> : <CaretRightOutlined />}
            >
              Root certificate
            </Button>
            {roots.length > 0 && (
              <span className="app-subtle">
                {roots.length} {roots.length === 1 ? "certificate" : "certificates"}
              </span>
            )}
          </Space>
        }
        extra={
          <Button type="primary" ghost onClick={() => setShowGenerate(true)}>
            Generate root certificate
          </Button>
        }
      >
        {open && (
          <>
            <Typography.Text className="app-subtle">
              Generate a local CA, download it, and install it in the Windows Trusted Root store.
              HTTPS server certificates can then be issued from it.
            </Typography.Text>
            {roots.length === 0 ? (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 12 }}
                message="No root certificate yet"
                description="Generate one to sign HTTPS listener certificates."
              />
            ) : (
              <Table<CertificateDto>
                rowKey="name"
                size="small"
                style={{ marginTop: 12 }}
                columns={columns}
                dataSource={roots}
                pagination={false}
              />
            )}
          </>
        )}
      </Card>
      <GenerateRootModal open={showGenerate} onClose={() => setShowGenerate(false)} />
    </>
  );
}

function GenerateRootModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const [name, setName] = useState("ProxyMockTool Root CA");
  const [subject, setSubject] = useState("");
  const [password, setPassword] = useState("");
  const [validityYears, setValidityYears] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generateRoot] = useGenerateRootCertificateMutation();

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await generateRoot({
        name,
        subject: subject.trim() || null,
        password,
        validityYears,
      }).unwrap();
      message.success(`Generated ${name}. Install it in the Trusted Root store to avoid warnings.`);
      setName("ProxyMockTool Root CA");
      setSubject("");
      setPassword("");
      setValidityYears(10);
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught, "Could not generate the root certificate."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Generate root certificate"
      width={640}
      okText="Generate"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      <Row gutter={[16, 12]}>
        <Col span={24}>
          <Typography.Text>Name</Typography.Text>
          <Input
            style={{ marginTop: 4 }}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Typography.Text className="app-subtle">Catalog name shown on this page.</Typography.Text>
        </Col>
        <Col span={24}>
          <Typography.Text>Subject (CN)</Typography.Text>
          <Input
            style={{ marginTop: 4 }}
            placeholder={name || "ProxyMockTool Root CA"}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
          <Typography.Text className="app-subtle">Leave empty to use the name.</Typography.Text>
        </Col>
        <Col xs={24} md={12}>
          <Typography.Text>Validity (years)</Typography.Text>
          <Input
            type="number"
            min={1}
            max={30}
            style={{ marginTop: 4 }}
            value={validityYears}
            onChange={(event) => setValidityYears(Number(event.target.value))}
          />
        </Col>
        <Col xs={24} md={12}>
          <Typography.Text>Password</Typography.Text>
          <Input.Password
            style={{ marginTop: 4 }}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Typography.Text className="app-subtle">
            Protects the generated private key file.
          </Typography.Text>
        </Col>
      </Row>
    </Modal>
  );
}
