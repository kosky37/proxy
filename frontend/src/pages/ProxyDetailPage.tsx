import { PauseCircleOutlined, PlayCircleOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Segmented,
  Space,
  Switch,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { IgnoreEditor } from "../components/IgnoreEditor";
import { HelpTooltip, type HelpDoc } from "../components/FieldHelp";
import { LogDetailModal } from "../components/LogDetailModal";
import { LogsPanel } from "../components/LogsPanel";
import { ManualSendPanel } from "../components/ManualSendPanel";
import { MockEditor } from "../components/MockEditor";
import { MockSetEditor } from "../components/MockSetEditor";
import { TabToolbar } from "../components/PageHeader";
import { hasAdvancedMatch } from "../format";
import { sendFromLog, type SendDraft } from "../headers";
import { ignoreFromLog, mockFromLog } from "../mockFromLog";
import {
  useApplyMockSetMutation,
  useCreateIgnoreMutation,
  useCreateMockMutation,
  useCreateMockSetMutation,
  useDeleteIgnoreMutation,
  useDeleteMockMutation,
  useDeleteMockSetMutation,
  useGetIgnoresQuery,
  useGetLogQuery,
  useGetMocksQuery,
  useGetMockSetsQuery,
  useGetProxyQuery,
  useSetMocksEnabledMutation,
  useToggleMockMutation,
  useUpdateIgnoreMutation,
  useUpdateMockMutation,
  useUpdateMockSetMutation,
} from "../store/proxyApi";
import type { IgnoredPathDto, LogDetailDto, MockDto, MockSetDto } from "../store/types";

type Tab = "logs" | "mock-sets" | "rest" | "soap" | "ignores" | "send";

const TABS: { key: Tab; label: string }[] = [
  { key: "logs", label: "Logs" },
  { key: "mock-sets", label: "Mock sets" },
  { key: "rest", label: "REST mocks" },
  { key: "soap", label: "SOAP mocks" },
  { key: "ignores", label: "Ignores" },
  { key: "send", label: "Send" },
];

const REST_MOCK_HELP: HelpDoc = {
  summary: "Answer matching REST requests instead of forwarding them.",
  points: [
    {
      label: "Match",
      text: "Path, method, query, headers, and body rules must all match.",
    },
    {
      label: "Response",
      text: "The configured status, headers, and body go back to the client and the request is logged as `mock`.",
    },
  ],
};

const SOAP_MOCK_HELP: HelpDoc = {
  summary: "Answer matching SOAP requests instead of forwarding them.",
  points: [
    {
      label: "Match",
      text: "The `SOAPAction` header or the operation inside the envelope, plus any optional body rules.",
    },
    {
      label: "Response",
      text: "The configured XML envelope goes back to the client and the request is logged as `mock`.",
    },
  ],
};

const MOCK_SET_HELP: HelpDoc = {
  summary: "Applying a set switches the proxy to a testing scenario.",
  points: [
    { label: "Listed mocks", text: "Enabled." },
    { label: "All other mocks", text: "Disabled." },
  ],
  note: "Applying an empty set disables every mock in the proxy.",
};

const IGNORE_HELP: HelpDoc = {
  summary: "Matching requests are handled normally but stay out of the log.",
  points: [
    { label: "Traffic", text: "The request is still mocked or forwarded as usual." },
    { label: "Log", text: "Nothing is written for a matching path, which keeps noisy polling endpoints out of the list." },
  ],
};

function mockTabHelp(tab: Tab): HelpDoc {
  return tab === "soap" ? SOAP_MOCK_HELP : REST_MOCK_HELP;
}

export function ProxyDetailPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { modal, message } = App.useApp();
  const proxy = useGetProxyQuery(id);
  const mocks = useGetMocksQuery(id);
  const ignores = useGetIgnoresQuery(id);
  const mockSets = useGetMockSetsQuery(id);
  const [tab, setTab] = useState<Tab>("logs");
  const [editing, setEditing] = useState<MockDto | null | undefined>(undefined);
  const [editingExisting, setEditingExisting] = useState(false);
  const [editingIgnore, setEditingIgnore] = useState<IgnoredPathDto | null | undefined>(undefined);
  const [editingSet, setEditingSet] = useState<MockSetDto | null | undefined>(undefined);
  const [logId, setLogId] = useState<number | null>(null);
  const [sendDraft, setSendDraft] = useState<SendDraft | null>(null);
  const logDetail = useGetLogQuery({ proxyId: id, entryId: logId ?? 0 }, { skip: logId == null });
  const [setMocksEnabled] = useSetMocksEnabledMutation();
  const [createMock] = useCreateMockMutation();
  const [updateMock] = useUpdateMockMutation();
  const [deleteMock] = useDeleteMockMutation();
  const [toggleMock] = useToggleMockMutation();
  const [createIgnore] = useCreateIgnoreMutation();
  const [updateIgnore] = useUpdateIgnoreMutation();
  const [deleteIgnore] = useDeleteIgnoreMutation();
  const [createMockSet] = useCreateMockSetMutation();
  const [updateMockSet] = useUpdateMockSetMutation();
  const [deleteMockSet] = useDeleteMockSetMutation();
  const [applyMockSet] = useApplyMockSetMutation();

  const mockList = useMemo(() => mocks.data ?? [], [mocks.data]);
  const openExistingMock = useCallback((mock: MockDto) => {
    setEditingExisting(true);
    setEditing(mock);
    setTab(mock.type === "soap" ? "soap" : "rest");
    setLogId(null);
  }, []);

  useEffect(() => {
    const state = location.state as {
      fromLog?: { action: "mock" | "send"; log: LogDetailDto };
      openMock?: MockDto;
    } | null;
    if (state?.openMock) {
      setEditingExisting(true);
      setEditing(state.openMock);
      setTab(state.openMock.type === "soap" ? "soap" : "rest");
      setLogId(null);
    } else if (state?.fromLog) {
      const fromLog = state.fromLog;
      if (fromLog.action === "send") {
        setSendDraft(sendFromLog(fromLog.log));
        setTab("send");
        setLogId(null);
      } else {
        setEditingExisting(false);
        setEditing(mockFromLog(fromLog.log));
        setTab(fromLog.log.protocol === "soap" ? "soap" : "rest");
        setLogId(null);
      }
    } else {
      return;
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  if (proxy.isLoading || !proxy.data) {
    return <Alert type="info" showIcon message="Loading proxy…" />;
  }
  if (proxy.isError) {
    return <Alert type="error" showIcon message="Proxy not found." />;
  }

  const saveMock = async (mock: MockDto) => {
    if (editingExisting && editing?.name) {
      await updateMock({ proxyId: id, name: editing.name, body: mock }).unwrap();
      message.success(`Saved ${mock.name}.`);
    } else {
      await createMock({ proxyId: id, body: mock }).unwrap();
      message.success(`Created ${mock.name}.`);
    }
    setEditing(undefined);
  };

  const saveIgnore = async (ignore: IgnoredPathDto) => {
    const existingName = editingIgnore?.name;
    const exists = Boolean(
      existingName &&
      ignores.data?.some((item) => item.name.toLowerCase() === existingName.toLowerCase()),
    );
    if (exists && existingName) {
      await updateIgnore({ proxyId: id, name: existingName, body: ignore }).unwrap();
    } else {
      await createIgnore({ proxyId: id, body: ignore }).unwrap();
    }
    message.success(`Saved ignore ${ignore.name}.`);
    setEditingIgnore(undefined);
  };

  const saveMockSet = async (set: MockSetDto) => {
    const existingName = editingSet?.name;
    const exists = Boolean(
      existingName &&
      mockSets.data?.some((item) => item.name.toLowerCase() === existingName.toLowerCase()),
    );
    if (exists && existingName) {
      await updateMockSet({ proxyId: id, name: existingName, body: set }).unwrap();
    } else {
      await createMockSet({ proxyId: id, body: set }).unwrap();
    }
    message.success(`Saved mock set ${set.name}.`);
    setEditingSet(undefined);
  };

  const openMockFromSet = (mock: MockDto) => {
    setEditingExisting(true);
    setEditing(mock);
  };

  const createMockFromLog = (log: LogDetailDto) => {
    setEditingExisting(false);
    setEditing(mockFromLog(log));
    setTab(log.protocol === "soap" ? "soap" : "rest");
    setLogId(null);
  };

  const createSendFromLog = (log: LogDetailDto) => {
    setSendDraft(sendFromLog(log));
    setTab("send");
    setLogId(null);
  };

  const createIgnoreFromLog = (log: LogDetailDto) => {
    setEditingIgnore(ignoreFromLog(log));
    setTab("ignores");
    setLogId(null);
  };

  const ignoreIsNew =
    editingIgnore == null ||
    !ignores.data?.some((item) => item.name.toLowerCase() === editingIgnore.name.toLowerCase());

  const setIsNew =
    editingSet == null ||
    !mockSets.data?.some((item) => item.name.toLowerCase() === editingSet.name.toLowerCase());

  const existingLogMock = logDetail.data?.mockName
    ? mocks.data?.find((item) => item.name.toLowerCase() === logDetail.data?.mockName?.toLowerCase())
    : undefined;

  const restMocks = mocks.data?.filter((item) => item.type === "rest") ?? [];
  const soapMocks = mocks.data?.filter((item) => item.type === "soap") ?? [];

  const confirmDeleteMock = (mock: MockDto) => {
    modal.confirm({
      title: `Delete mock ${mock.name}?`,
      content: "The mock file is removed from the proxy folder.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: () => deleteMock({ proxyId: id, name: mock.name }),
    });
  };

  const confirmDeleteIgnore = (ignore: IgnoredPathDto) => {
    modal.confirm({
      title: `Delete ignore ${ignore.name}?`,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: () => deleteIgnore({ proxyId: id, name: ignore.name }),
    });
  };

  const confirmDeleteSet = (set: MockSetDto) => {
    modal.confirm({
      title: `Delete mock set ${set.name}?`,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: () => deleteMockSet({ proxyId: id, name: set.name }),
    });
  };

  const mockColumns = (): ColumnsType<MockDto> => [
    {
      title: "Name",
      dataIndex: "name",
      width: 220,
      render: (name: string, mock) => (
        <div>
          <div>{name}</div>
          <div className="app-subtle">{mock.fileName}</div>
        </div>
      ),
    },
    {
      title: "Methods",
      key: "methods",
      width: 150,
      render: (_value, mock) => {
        const methods = mock.match.methods?.filter(Boolean) ?? [];
        return methods.length > 0 ? (
          <Space size={4} wrap>
            {methods.map((method) => (
              <Tag key={method}>{method}</Tag>
            ))}
          </Space>
        ) : (
          <span className="app-subtle">any</span>
        );
      },
    },
    {
      title: "Match",
      key: "match",
      render: (_value, mock) => (
        <div>
          <code className="app-code">
            {mock.type === "soap"
              ? mock.match.soapAction || mock.match.operation || "*"
              : mock.match.path || "*"}
          </code>
          {mock.type !== "soap" && mock.match.pathMode && mock.match.pathMode !== "exact" && (
            <div className="app-subtle">{mock.match.pathMode}</div>
          )}
        </div>
      ),
    },
    {
      title: "Flags",
      key: "flags",
      width: 240,
      render: (_value, mock) => <MockFlags mock={mock} />,
    },
    {
      title: "Status",
      key: "status",
      width: 90,
      render: (_value, mock) =>
        mock.response.block === true ? <Tag color="red">Block</Tag> : <span>{mock.response.statusCode}</span>,
    },
    {
      title: "",
      key: "actions",
      width: 230,
      align: "right",
      render: (_value, mock) => (
        <Space size={4}>
          <HelpTooltip
            help={
              mock.enabled
                ? "Pause this mock. It stays on disk but **stops matching** until it is enabled again."
                : "Let this mock match requests again."
            }
          >
            <Button
              size="small"
              icon={mock.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => void toggleMock({ proxyId: id, name: mock.name })}
            >
              {mock.enabled ? "Disable" : "Enable"}
            </Button>
          </HelpTooltip>
          <Button
            size="small"
            onClick={() => {
              setEditingExisting(true);
              setEditing(mock);
            }}
          >
            Edit
          </Button>
          <Button size="small" danger onClick={() => confirmDeleteMock(mock)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  const setColumns: ColumnsType<MockSetDto> = [
    {
      title: "Name",
      dataIndex: "name",
      render: (name: string, set) => (
        <div>
          <div>{name}</div>
          <div className="app-subtle">{set.fileName}</div>
        </div>
      ),
    },
    {
      title: "Mocks",
      key: "mocks",
      render: (_value, set) => {
        if (set.mockNames.length === 0) {
          return <span className="app-subtle">none (apply disables all mocks)</span>;
        }

        return (
          <Space size={8} wrap>
            {set.mockNames.map((name) => {
              const mock = mocks.data?.find(
                (item) => item.name.toLowerCase() === name.toLowerCase(),
              );
              return mock ? (
                <Button
                  key={name}
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => openMockFromSet(mock)}
                >
                  {name}
                </Button>
              ) : (
                <span key={name} className="app-subtle">
                  {name}
                </span>
              );
            })}
          </Space>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: (_value, set) =>
        isMockSetActive(set, mocks.data ?? []) ? <Tag color="green">Active</Tag> : null,
    },
    {
      title: "",
      key: "actions",
      width: 220,
      align: "right",
      render: (_value, set) => (
        <Space size={4}>
          <HelpTooltip
            help={{
              summary: "Enable exactly these mocks and disable every other mock.",
              note: "Use it to switch the proxy between testing scenarios.",
            }}
          >
            <Button
              size="small"
              type="primary"
              onClick={() => void applyMockSet({ proxyId: id, name: set.name })}
            >
              Apply
            </Button>
          </HelpTooltip>
          <Button size="small" onClick={() => setEditingSet(set)}>
            Edit
          </Button>
          <Button size="small" danger onClick={() => confirmDeleteSet(set)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  const ignoreColumns: ColumnsType<IgnoredPathDto> = [
    { title: "Name", dataIndex: "name", width: 200 },
    {
      title: "Path",
      dataIndex: "path",
      render: (path: string) => <code className="app-code">{path}</code>,
    },
    { title: "Mode", dataIndex: "pathMode", width: 110 },
    {
      title: "Methods",
      key: "methods",
      width: 150,
      render: (_value, ignore) =>
        ignore.methods?.length ? ignore.methods.join(", ") : <span className="app-subtle">any</span>,
    },
    {
      title: "",
      key: "actions",
      width: 170,
      align: "right",
      render: (_value, ignore) => (
        <Space size={4}>
          <Button size="small" onClick={() => setEditingIgnore(ignore)}>
            Edit
          </Button>
          <Button size="small" danger onClick={() => confirmDeleteIgnore(ignore)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="app-page-header">
        <Breadcrumb
          items={[
            { title: <Link to="/">Proxies</Link> },
            { title: proxy.data.name },
          ]}
        />
        <div className="app-row" style={{ gap: 12, marginLeft: "auto", flexWrap: "wrap" }}>
          <span className="app-row" style={{ gap: 6 }}>
            <Switch
              size="small"
              checked={proxy.data.mocksEnabled}
              onChange={(mocksEnabled) => void setMocksEnabled({ id, mocksEnabled })}
            />
            <span>Mocks enabled</span>
          </span>
          <span className="app-subtle">
            {proxy.data.listen.url}
            {proxy.data.listen.pathPrefix ? ` (prefix ${proxy.data.listen.pathPrefix})` : ""} →{" "}
            {proxy.data.destination.address}
          </span>
        </div>
      </div>

      <Segmented
        style={{ marginBottom: 16 }}
        value={tab}
        options={TABS.map((item) => ({ value: item.key, label: item.label }))}
        onChange={(value) => setTab(value as Tab)}
      />

      {tab === "send" && (
        <ManualSendPanel
          proxyId={id}
          destination={proxy.data.destination.address}
          pathPrefix={proxy.data.listen.pathPrefix}
          draft={sendDraft}
          onDraftConsumed={() => setSendDraft(null)}
          onOpenLog={setLogId}
        />
      )}

      {(tab === "rest" || tab === "soap") && (
        <>
          <TabToolbar help={mockTabHelp(tab)}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingExisting(false);
                setEditing(null);
              }}
            >
              Add {tab === "soap" ? "SOAP" : "REST"} mock
            </Button>
          </TabToolbar>
          <Table<MockDto>
            rowKey="name"
            size="small"
            loading={mocks.isLoading}
            columns={mockColumns()}
            dataSource={tab === "rest" ? restMocks : soapMocks}
            pagination={false}
            tableLayout="fixed"
            rowClassName={(mock) => (mock.enabled ? "" : "mock-row-disabled")}
            locale={{
              emptyText:
                tab === "rest"
                  ? "No REST mocks yet. Add one to answer requests without the destination."
                  : "No SOAP mocks yet. Add one to answer XML envelope requests.",
            }}
          />
        </>
      )}

      {tab === "mock-sets" && (
        <>
          <TabToolbar help={MOCK_SET_HELP}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditingSet(null)}>
              Add mock set
            </Button>
          </TabToolbar>
          <Table<MockSetDto>
            rowKey="name"
            size="small"
            loading={mockSets.isLoading}
            columns={setColumns}
            dataSource={mockSets.data ?? []}
            pagination={false}
            tableLayout="fixed"
            locale={{ emptyText: "No mock sets yet. Add one to enable a group of mocks in a single click." }}
          />
        </>
      )}

      {tab === "ignores" && (
        <>
          <TabToolbar help={IGNORE_HELP}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditingIgnore(null)}>
              Add ignore
            </Button>
          </TabToolbar>
          <Table<IgnoredPathDto>
            rowKey="name"
            size="small"
            loading={ignores.isLoading}
            columns={ignoreColumns}
            dataSource={ignores.data ?? []}
            pagination={false}
            tableLayout="fixed"
            locale={{
              emptyText: "No ignored paths. Add one to keep noisy requests out of the log.",
            }}
          />
        </>
      )}

      {tab === "logs" && (
        <LogsPanel
          proxyId={id}
          active
          mocks={mockList}
          onOpenLog={setLogId}
          onOpenMock={openExistingMock}
        />
      )}

      <LogDetailModal
        open={logId != null}
        loading={logDetail.isFetching}
        log={logDetail.data ?? null}
        existingMock={existingLogMock}
        onClose={() => setLogId(null)}
        onOpenMock={openExistingMock}
        onCreateMock={createMockFromLog}
        onCreateSend={createSendFromLog}
        onCreateIgnore={createIgnoreFromLog}
      />

      <MockSetEditor
        open={editingSet !== undefined}
        initial={editingSet}
        isNew={setIsNew}
        mocks={mocks.data ?? []}
        onSave={saveMockSet}
        onCancel={() => setEditingSet(undefined)}
      />

      <IgnoreEditor
        open={editingIgnore !== undefined}
        initial={editingIgnore}
        isNew={ignoreIsNew}
        onSave={saveIgnore}
        onCancel={() => setEditingIgnore(undefined)}
      />

      <MockEditor
        open={editing !== undefined}
        initial={editing}
        isNew={!editingExisting}
        defaultType={editing?.type ?? (tab === "soap" ? "soap" : "rest")}
        onSave={saveMock}
        onCancel={() => setEditing(undefined)}
      />
    </>
  );
}

function isMockSetActive(set: MockSetDto, mocks: MockDto[]) {  const enabled = mocks
    .filter((mock) => mock.enabled)
    .map((mock) => mock.name.toLowerCase())
    .sort();
  const selected = set.mockNames.map((name) => name.toLowerCase()).sort();
  return enabled.length === selected.length && enabled.every((name, index) => name === selected[index]);
}

function MockFlags({ mock }: { mock: MockDto }) {
  const delayed = (mock.response.delayMs ?? 0) > 0;
  const blocked = mock.response.block === true;
  const advanced = hasAdvancedMatch(mock.match);
  const flags: string[] = [];
  if (delayed) {
    flags.push(`delay ${mock.response.delayMs} ms`);
  }
  if (blocked) {
    flags.push("blocks request");
  }
  if (advanced) {
    flags.push("extra match rules");
  }

  return (
    <Space size={4} wrap>
      <Tag color={mock.enabled ? "green" : "default"}>
        {mock.enabled ? "enabled" : "disabled"}
      </Tag>
      {flags.map((flag) => (
        <Tag key={flag} color={blocked && flag === "blocks request" ? "red" : "blue"}>
          {flag}
        </Tag>
      ))}
      {flags.length === 0 && <span className="app-subtle">path only</span>}
    </Space>
  );
}
