import { useEffect, useState, type FormEvent } from "react";
import { Alert, Badge, Button, Form, Modal, Stack, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import { CopyButton } from "../components/CopyButton";
import { ProxySettingsFields } from "../components/ProxySettingsFields";
import {
  useCreateProxyMutation,
  useDeleteProxyMutation,
  useGetCertificatesQuery,
  useGetProxyQuery,
  useGetProxiesQuery,
  useSetMocksEnabledMutation,
  useUpdateProxyMutation,
} from "../store/proxyApi";
import type { UpsertProxyRequest } from "../store/types";

const emptyForm: UpsertProxyRequest = {
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
  const { data, isLoading, error, refetch } = useGetProxiesQuery();
  const certificates = useGetCertificatesQuery();
  const [createProxy, createState] = useCreateProxyMutation();
  const [updateProxy, updateState] = useUpdateProxyMutation();
  const [deleteProxy] = useDeleteProxyMutation();
  const [setMocksEnabled] = useSetMocksEnabledMutation();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const editingProxy = useGetProxyQuery(editId ?? "", { skip: !editId });

  useEffect(() => {
    if (showCreate) {
      setForm(emptyForm);
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

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    await createProxy({
      ...form,
      id: form.id || undefined,
    }).unwrap();
    setShowCreate(false);
  };

  const onSaveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editId) {
      return;
    }
    await updateProxy({ id: editId, body: form }).unwrap();
    setEditId(null);
  };

  return (
    <>
      <Stack direction="horizontal" className="mb-3">
        <h1 className="h3 mb-0">Proxies</h1>
        <div className="ms-auto d-flex gap-2">
          <Button variant="outline-secondary" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button onClick={() => setShowCreate(true)}>New proxy</Button>
        </div>
      </Stack>

      {isLoading && <Alert variant="secondary">Loading…</Alert>}
      {error && (
        <Alert variant="danger">Could not load proxies. Is the API running on port 5050?</Alert>
      )}

      <Table striped hover responsive className="align-middle proxies-table">
        <colgroup>
          <col className="proxies-col-name" />
          <col className="proxies-col-listen" />
          <col className="proxies-col-destination" />
          <col className="proxies-col-mocks" />
          <col className="proxies-col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th>Name</th>
            <th>Listen</th>
            <th>Destination</th>
            <th>Mocks</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data?.map((proxy) => (
            <tr key={proxy.id}>
              <td>
                <Link to={`/proxies/${proxy.id}`}>{proxy.name}</Link>
                {!proxy.enabled && (
                  <Badge bg="secondary" className="ms-2">
                    disabled
                  </Badge>
                )}
              </td>
              <td>
                <div className="copyable-cell">
                  <code>{proxy.listenUrl}</code>
                  <CopyButton value={proxy.listenUrl} label="Copy listen URL" />
                </div>
                {proxy.listenPathPrefix && <div className="row-meta">{proxy.listenPathPrefix}</div>}
              </td>
              <td>
                <div className="copyable-cell">
                  <code>{proxy.destinationAddress}</code>
                  <CopyButton value={proxy.destinationAddress} label="Copy destination URL" />
                </div>
              </td>
              <td className="proxies-mocks-cell">
                <Form.Check
                  type="switch"
                  id={`mocks-${proxy.id}`}
                  checked={proxy.mocksEnabled}
                  label={`${proxy.enabledMockCount}/${proxy.mockCount} enabled`}
                  onChange={(event) =>
                    setMocksEnabled({
                      id: proxy.id,
                      mocksEnabled: event.target.checked,
                    })
                  }
                />
              </td>
              <td className="text-end">
                <Stack direction="horizontal" gap={1} className="justify-content-end">
                  <Button variant="outline-primary" size="sm" onClick={() => setEditId(proxy.id)}>
                    Edit
                  </Button>
                  <Button variant="outline-danger" size="sm" onClick={() => deleteProxy(proxy.id)}>
                    Delete
                  </Button>
                </Stack>
              </td>
            </tr>
          ))}
          {data?.length === 0 && (
            <tr>
              <td colSpan={5}>No proxy folders found.</td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>New proxy</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form id="proxy-create-form" onSubmit={onCreate}>
            <ProxySettingsFields
              form={form}
              onChange={setForm}
              certificates={certificates.data}
              showId
              showAdvanced={false}
            />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
          <Button type="submit" form="proxy-create-form" disabled={createState.isLoading}>
            Create
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(editId)} onHide={() => setEditId(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit {editingProxy.data?.name ?? "proxy"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingProxy.isLoading && <Alert variant="secondary">Loading…</Alert>}
          {editingProxy.isError && <Alert variant="danger">Could not load proxy settings.</Alert>}
          {editingProxy.data && (
            <Form id="proxy-edit-form" onSubmit={onSaveEdit}>
              <ProxySettingsFields
                form={form}
                onChange={setForm}
                certificates={certificates.data}
                showAdvanced
              />
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setEditId(null)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="proxy-edit-form"
            disabled={updateState.isLoading || !editingProxy.data}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
