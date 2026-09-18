import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { CertificateEditor } from "../components/CertificateEditor";
import { PageHeader } from "../components/PageHeader";
import { RootCertificatePanel } from "../components/RootCertificatePanel";
import {
  useCreateCertificateMutation,
  useDeleteCertificateMutation,
  useGetCertificatesQuery,
  useUpdateCertificateMutation,
} from "../store/proxyApi";
import type { CertificateDto } from "../store/types";

export function CertificatesPage() {
  const { modal, message } = App.useApp();
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
      message.success(`Saved ${certificate.name}.`);
    } else {
      await createCertificate(certificate).unwrap();
      message.success(`Added ${certificate.name}.`);
    }
    setEditing(undefined);
  };

  const confirmDelete = (certificate: CertificateDto) => {
    modal.confirm({
      title: `Delete ${certificate.name}?`,
      content:
        "Proxies using this certificate fall back to no certificate until they are updated.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteCertificate(certificate.name).unwrap();
        message.success(`Deleted ${certificate.name}.`);
      },
    });
  };

  const locationLabel = (certificate: CertificateDto) => {
    if (certificate.source === "windowsStore") {
      return `${certificate.storeLocation ?? "CurrentUser"}/${certificate.storeName ?? "My"}`;
    }
    return certificate.pfxPath || "—";
  };

  const columns: ColumnsType<CertificateDto> = [
    { title: "Name", dataIndex: "name", width: 220 },
    {
      title: "Type",
      dataIndex: "type",
      width: 100,
      render: (type: string) =>
        type === "server" ? <Tag color="gold">Server</Tag> : <Tag color="blue">Client</Tag>,
    },
    {
      title: "Source",
      dataIndex: "source",
      width: 140,
      render: (source: string) => (source === "windowsStore" ? "Windows store" : "File"),
    },
    {
      title: "Location",
      dataIndex: "pfxPath",
      render: (_value, certificate) => (
        <code className="app-code">{locationLabel(certificate)}</code>
      ),
    },
    {
      title: "Password",
      key: "password",
      width: 200,
      render: (_value, certificate) => {
        if (certificate.source === "windowsStore") {
          return <span className="app-subtle">n/a</span>;
        }
        if (!certificate.password) {
          return <span className="app-subtle">none</span>;
        }
        const shown = revealed[certificate.name] === true;
        return (
          <Space size={8}>
            <code className="app-code">{shown ? certificate.password : "••••••••"}</code>
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              onClick={() =>
                setRevealed((current) => ({ ...current, [certificate.name]: !shown }))
              }
            >
              {shown ? "Hide" : "Show"}
            </Button>
          </Space>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 170,
      align: "right",
      render: (_value, certificate) => (
        <Space size={4}>
          <Button size="small" onClick={() => setEditing(certificate)}>
            Edit
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
      <PageHeader
        title="Certificates"
        description="Shared catalog. Select a certificate when creating or editing a proxy."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>
            Add certificate
          </Button>
        }
      />

      <RootCertificatePanel certificates={catalog} />

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Client and server certificates
      </Typography.Title>
      <Table<CertificateDto>
        rowKey="name"
        size="small"
        loading={certificates.isLoading}
        columns={columns}
        dataSource={leafCertificates}
        pagination={false}
        locale={{
          emptyText:
            "No client or server certificates yet. Add one here, or generate a server certificate from a root CA.",
        }}
      />

      <CertificateEditor
        open={editing !== undefined}
        initial={editing}
        onSave={save}
        onCancel={() => setEditing(undefined)}
      />
    </>
  );
}
