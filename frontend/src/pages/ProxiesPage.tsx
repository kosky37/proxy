import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { CopyButton } from "../components/CopyButton";
import { PageHeader } from "../components/PageHeader";
import { ProxySettingsFields } from "../components/ProxySettingsFields";
import {
  useCreateProxyMutation,
  useDeleteProxyMutation,
  useGetCertificatesQuery,
  useGetProxiesQuery,
  useGetProxyQuery,
  useSetMocksEnabledMutation,
  useUpdateProxyMutation,
} from "../store/proxyApi";
import type { ProxyListItemDto, UpsertProxyRequest } from "../store/types";

export const emptyProxyForm: UpsertProxyRequest = {
  id: "",
  name: "Gateway",
  enabled: true,
  listen: { url: "https://127.0.0.1:8085", serverCertificateId: null },
  destination: {
    address: "https://domain-gateway.uat.mille.pl:8085",
    acceptAnyServerCertificate: false,
    clientCertificateId: null,
  },
  mocksEnabled: true,
  passthroughDelayMs: 0,
  logRetentionDays: 7,
  bodyLogLimitBytes: 1_048_576,
};

export function ProxiesPage() {
  const { modal, message } = App.useApp();
  const { data, isLoading, error, refetch, isFetching } = useGetProxiesQuery();
  const certificates = useGetCertificatesQuery();
  const [createProxy, createState] = useCreateProxyMutation();
  const [updateProxy, updateState] = useUpdateProxyMutation();
  const [deleteProxy] = useDeleteProxyMutation();
  const [setMocksEnabled] = useSetMocksEnabledMutation();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertProxyRequest>(emptyProxyForm);
  const editingProxy = useGetProxyQuery(editId ?? "", { skip: !editId });

  useEffect(() => {
    if (showCreate) {
      setForm(emptyProxyForm);
    }
  }, [showCreate]);

  useEffect(() => {
    if (editingProxy.data) {
      setForm({
        name: editingProxy.data.name,
        enabled: editingProxy.data.enabled,
        listen: editingProxy.data.listen,
        destination: editingProxy.data.destination,
        mocksEnabled: editingProxy.data.mocksEnabled,
        passthroughDelayMs: editingProxy.data.passthroughDelayMs,
        logRetentionDays: editingProxy.data.logRetentionDays ?? 7,
        bodyLogLimitBytes: editingProxy.data.bodyLogLimitBytes ?? 1_048_576,
      });
    }
  }, [editingProxy.data]);

  const create = async () => {
    if (!form.name.trim() || !form.listen.url.trim() || !form.destination.address.trim()) {
      message.error("Name, listen URL, and destination URL are required.");
      return;
    }

    try {
      await createProxy({ ...form, id: form.id || undefined }).unwrap();
      message.success(`Created ${form.name}.`);
      setShowCreate(false);
    } catch {
      message.error("Could not create the proxy.");
    }
  };

  const saveEdit = async () => {
    if (!editId) {
      return;
    }

    try {
      await updateProxy({ id: editId, body: form }).unwrap();
      message.success("Proxy settings saved.");
      setEditId(null);
    } catch {
      message.error("Could not save the proxy settings.");
    }
  };

  const confirmDelete = (proxy: ProxyListItemDto) => {
    modal.confirm({
      title: `Delete ${proxy.name}?`,
      content: "The proxy folder, its mocks, ignores, and mock sets are removed. This cannot be undone.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteProxy(proxy.id).unwrap();
          message.success(`Deleted ${proxy.name}.`);
        } catch {
          message.error("Could not delete the proxy.");
        }
      },
    });
  };

  const columns: ColumnsType<ProxyListItemDto> = [
    {
      title: "Name",
      dataIndex: "name",
      width: 200,
      render: (_value, proxy) => (
        <Space size={6} wrap>
          <Link to={`/proxies/${proxy.id}`}>{proxy.name}</Link>
          {!proxy.enabled && <Tag>disabled</Tag>}
        </Space>
      ),
    },
    {
      title: "Listen",
      dataIndex: "listenUrl",
      render: (_value, proxy) => (
        <div>
          <div className="app-row" style={{ gap: 4 }}>
            <code className="app-code">{proxy.listenUrl}</code>
            <CopyButton value={proxy.listenUrl} label="Copy listen URL" />
          </div>
          {proxy.listenPathPrefix && (
            <div className="app-subtle">prefix {proxy.listenPathPrefix}</div>
          )}
        </div>
      ),
    },
    {
      title: "Destination",
      dataIndex: "destinationAddress",
      render: (_value, proxy) => (
        <div className="app-row" style={{ gap: 4 }}>
          <code className="app-code">{proxy.destinationAddress}</code>
          <CopyButton value={proxy.destinationAddress} label="Copy destination URL" />
        </div>
      ),
    },
    {
      title: "Mocks",
      key: "mocks",
      width: 190,
      render: (_value, proxy) => (
        <Space size={6}>
          <Switch
            size="small"
            checked={proxy.mocksEnabled}
            aria-label={`Mocks enabled for ${proxy.name}`}
            onChange={(mocksEnabled) =>
              void setMocksEnabled({ id: proxy.id, mocksEnabled })
            }
          />
          <span className="app-subtle">
            {proxy.enabledMockCount}/{proxy.mockCount} enabled
          </span>
        </Space>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 170,
      align: "right",
      render: (_value, proxy) => (
        <Space size={6}>
          <Button size="small" onClick={() => setEditId(proxy.id)}>
            Edit
          </Button>
          <Button size="small" danger onClick={() => confirmDelete(proxy)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Proxies"
        description="Each folder under proxies/ is a listener with its own mocks, ignores, and log store."
        actions={
          <>
            <Button
              icon={<ReloadOutlined />}
              loading={isFetching}
              onClick={() => void refetch()}
            >
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>
              New proxy
            </Button>
          </>
        }
      />

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Could not load proxies"
          description="Is the API running on port 9310?"
        />
      )}

      <Table<ProxyListItemDto>
        rowKey="id"
        size="small"
        loading={isLoading}
        columns={columns}
        dataSource={data ?? []}
        pagination={false}
        locale={{ emptyText: "No proxy folders found." }}
      />

      <Modal
        open={showCreate}
        title="New proxy"
        width={880}
        okText="Create"
        confirmLoading={createState.isLoading}
        onOk={() => void create()}
        onCancel={() => setShowCreate(false)}
        destroyOnHidden
      >
        <ProxySettingsFields
          form={form}
          onChange={setForm}
          certificates={certificates.data}
          showId
          showAdvanced={false}
        />
      </Modal>

      <Modal
        open={Boolean(editId)}
        title={`Edit ${editingProxy.data?.name ?? "proxy"}`}
        width={880}
        okText="Save"
        okButtonProps={{ disabled: !editingProxy.data }}
        confirmLoading={updateState.isLoading}
        onOk={() => void saveEdit()}
        onCancel={() => setEditId(null)}
        destroyOnHidden
      >
        {editingProxy.isLoading && <Typography.Text>Loading…</Typography.Text>}
        {editingProxy.isError && (
          <Alert type="error" showIcon message="Could not load proxy settings." />
        )}
        {editingProxy.data && (
          <ProxySettingsFields
            form={form}
            onChange={setForm}
            certificates={certificates.data}
            showAdvanced
          />
        )}
      </Modal>
    </>
  );
}
