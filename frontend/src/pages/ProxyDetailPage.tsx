import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Form,
  Nav,
  OverlayTrigger,
  Stack,
  Table,
  Tooltip,
} from 'react-bootstrap'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { TabToolbar } from '../components/FieldHelp'
import { IgnoreEditor } from '../components/IgnoreEditor'
import { LogDetailModal } from '../components/LogDetailModal'
import { LogsPanel } from '../components/LogsPanel'
import { ManualSendPanel } from '../components/ManualSendPanel'
import { MockEditor } from '../components/MockEditor'
import { MockSetEditor } from '../components/MockSetEditor'
import { hasAdvancedMatch } from '../format'
import { ignoreFromLog, mockFromLog } from '../mockFromLog'
import { sendFromLog, type SendDraft } from '../headers'
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
} from '../store/proxyApi'
import type { IgnoredPathDto, LogDetailDto, MockDto, MockSetDto } from '../store/types'

type Tab = 'send' | 'rest' | 'soap' | 'mock-sets' | 'ignores' | 'logs'

export function ProxyDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const proxy = useGetProxyQuery(id)
  const mocks = useGetMocksQuery(id)
  const ignores = useGetIgnoresQuery(id)
  const mockSets = useGetMockSetsQuery(id)
  const [tab, setTab] = useState<Tab>('logs')
  const [editing, setEditing] = useState<MockDto | null | undefined>(undefined)
  const [editingExisting, setEditingExisting] = useState(false)
  const [editingIgnore, setEditingIgnore] = useState<IgnoredPathDto | null | undefined>(undefined)
  const [editingSet, setEditingSet] = useState<MockSetDto | null | undefined>(undefined)
  const [logId, setLogId] = useState<number | null>(null)
  const [sendDraft, setSendDraft] = useState<SendDraft | null>(null)
  const logDetail = useGetLogQuery({ proxyId: id, entryId: logId ?? 0 }, { skip: logId == null })
  const [setMocksEnabled] = useSetMocksEnabledMutation()
  const [createMock] = useCreateMockMutation()
  const [updateMock] = useUpdateMockMutation()
  const [deleteMock] = useDeleteMockMutation()
  const [toggleMock] = useToggleMockMutation()
  const [createIgnore] = useCreateIgnoreMutation()
  const [updateIgnore] = useUpdateIgnoreMutation()
  const [deleteIgnore] = useDeleteIgnoreMutation()
  const [createMockSet] = useCreateMockSetMutation()
  const [updateMockSet] = useUpdateMockSetMutation()
  const [deleteMockSet] = useDeleteMockSetMutation()
  const [applyMockSet] = useApplyMockSetMutation()

  useEffect(() => {
    const state = location.state as {
      fromLog?: { action: 'mock' | 'send'; log: LogDetailDto }
      openMock?: MockDto
    } | null
    if (state?.openMock) {
      setEditingExisting(true)
      setEditing(state.openMock)
      setTab(state.openMock.type === 'soap' ? 'soap' : 'rest')
      setLogId(null)
    } else if (state?.fromLog) {
      const fromLog = state.fromLog
      if (fromLog.action === 'send') {
        setSendDraft(sendFromLog(fromLog.log))
        setTab('send')
        setLogId(null)
      } else {
        setEditingExisting(false)
        setEditing(mockFromLog(fromLog.log))
        setTab(fromLog.log.protocol === 'soap' ? 'soap' : 'rest')
        setLogId(null)
      }
    } else {
      return
    }

    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state, navigate])

  if (proxy.isLoading || !proxy.data) {
    return <Alert variant="secondary">Loading…</Alert>
  }
  if (proxy.isError) {
    return <Alert variant="danger">Proxy not found.</Alert>
  }


  const saveMock = async (mock: MockDto) => {
    if (editingExisting && editing?.name) {
      await updateMock({ proxyId: id, name: editing.name, body: mock }).unwrap()
    } else {
      await createMock({ proxyId: id, body: mock }).unwrap()
    }
    setEditing(undefined)
  }

  const saveIgnore = async (ignore: IgnoredPathDto) => {
    const existingName = editingIgnore?.name
    const exists = Boolean(
      existingName &&
        ignores.data?.some((item) => item.name.toLowerCase() === existingName.toLowerCase()),
    )
    if (exists && existingName) {
      await updateIgnore({ proxyId: id, name: existingName, body: ignore }).unwrap()
    } else {
      await createIgnore({ proxyId: id, body: ignore }).unwrap()
    }
    setEditingIgnore(undefined)
  }

  const saveMockSet = async (set: MockSetDto) => {
    const existingName = editingSet?.name
    const exists = Boolean(
      existingName &&
        mockSets.data?.some((item) => item.name.toLowerCase() === existingName.toLowerCase()),
    )
    if (exists && existingName) {
      await updateMockSet({ proxyId: id, name: existingName, body: set }).unwrap()
    } else {
      await createMockSet({ proxyId: id, body: set }).unwrap()
    }
    setEditingSet(undefined)
  }

  const openExistingMock = (mock: MockDto) => {
    setEditingExisting(true)
    setEditing(mock)
    setTab(mock.type === 'soap' ? 'soap' : 'rest')
    setLogId(null)
  }

  const openMockFromSet = (mock: MockDto) => {
    setEditingExisting(true)
    setEditing(mock)
  }

  const createMockFromLog = (log: LogDetailDto) => {
    setEditingExisting(false)
    setEditing(mockFromLog(log))
    setTab(log.protocol === 'soap' ? 'soap' : 'rest')
    setLogId(null)
  }

  const createSendFromLog = (log: LogDetailDto) => {
    setSendDraft(sendFromLog(log))
    setTab('send')
    setLogId(null)
  }

  const createIgnoreFromLog = (log: LogDetailDto) => {
    setEditingIgnore(ignoreFromLog(log))
    setTab('ignores')
    setLogId(null)
  }

  const ignoreIsNew =
    editingIgnore == null ||
    !ignores.data?.some((item) => item.name.toLowerCase() === editingIgnore.name.toLowerCase())

  const setIsNew =
    editingSet == null ||
    !mockSets.data?.some((item) => item.name.toLowerCase() === editingSet.name.toLowerCase())

  const existingLogMock = logDetail.data?.mockName
    ? mocks.data?.find((item) => item.name.toLowerCase() === logDetail.data?.mockName?.toLowerCase())
    : undefined

  const restMocks = mocks.data?.filter((item) => item.type === 'rest') ?? []
  const soapMocks = mocks.data?.filter((item) => item.type === 'soap') ?? []

  return (
    <>
      <Stack direction="horizontal" className="mb-3 align-items-center flex-wrap gap-2">
        <Breadcrumb className="mb-0">
          <Breadcrumb.Item linkAs={Link} linkProps={{ to: '/' }}>
            Proxies
          </Breadcrumb.Item>
          <Breadcrumb.Item active>{proxy.data?.name}</Breadcrumb.Item>
        </Breadcrumb>
        <Form.Check
          type="switch"
          id="mocks-enabled"
          className="ms-auto"
          label="Mocks enabled"
          checked={proxy.data?.mocksEnabled ?? false}
          onChange={(event) => setMocksEnabled({ id, mocksEnabled: event.target.checked })}
        />
      </Stack>

      <Nav variant="tabs" activeKey={tab} onSelect={(key) => setTab((key as Tab) ?? 'logs')} className="mb-3">
        <Nav.Item>
          <Nav.Link eventKey="logs">Logs</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="mock-sets">Mock sets</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="rest">REST mocks</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="soap">SOAP mocks</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="ignores">Ignores</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="send">Send</Nav.Link>
        </Nav.Item>
      </Nav>


      {tab === 'send' && proxy.data && (
        <ManualSendPanel
          proxyId={id}
          destination={proxy.data.destination.address}
          pathPrefix={proxy.data.listen.pathPrefix}
          draft={sendDraft}
          onDraftConsumed={() => setSendDraft(null)}
          onOpenLog={setLogId}
        />
      )}

      {(tab === 'rest' || tab === 'soap') && (
        <>
          <TabToolbar
            help={
              tab === 'soap'
                ? 'Match SOAP requests by action or operation and return the configured response instead of forwarding.'
                : 'Match REST requests by path and method and return the configured response instead of forwarding.'
            }
          >
            <Button
              onClick={() => {
                setEditingExisting(false)
                setEditing(null)
              }}
            >
              Add {tab === 'soap' ? 'SOAP' : 'REST'} mock
            </Button>
          </TabToolbar>
          <MockTable
            items={tab === 'rest' ? restMocks : soapMocks}
            onEdit={(mock) => {
              setEditingExisting(true)
              setEditing(mock)
            }}
            onToggle={(name) => toggleMock({ proxyId: id, name })}
            onDelete={(name) => deleteMock({ proxyId: id, name })}
          />
        </>
      )}

      {tab === 'mock-sets' && (
        <>
          <TabToolbar help="Apply a set to enable those mocks and disable every other mock. Use this to switch between testing scenarios.">
            <Button onClick={() => setEditingSet(null)}>Add mock set</Button>
          </TabToolbar>
          <Table striped responsive className="align-middle mock-sets-table">
            <colgroup>
              <col />
              <col />
              <col className="col-status" />
              <col className="col-actions-wide" />
            </colgroup>
            <thead>
              <tr>
                <th>Name</th>
                <th>Mocks</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mockSets.data?.map((set) => {
                const active = isMockSetActive(set, mocks.data ?? [])
                return (
                  <tr key={set.name}>
                    <td>
                      {set.name}
                      <div className="row-meta">{set.fileName}</div>
                    </td>
                    <td>
                      <MockNameLinks names={set.mockNames} mocks={mocks.data ?? []} onOpenMock={openMockFromSet} />
                    </td>
                    <td>{active && <Badge bg="success">Active</Badge>}</td>
                    <td className="text-end">
                      <Stack direction="horizontal" gap={1} className="justify-content-end">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => applyMockSet({ proxyId: id, name: set.name })}
                        >
                          Apply
                        </Button>
                        <Button variant="outline-primary" size="sm" onClick={() => setEditingSet(set)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => deleteMockSet({ proxyId: id, name: set.name })}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </td>
                  </tr>
                )
              })}
              {mockSets.data?.length === 0 && (
                <tr>
                  <td colSpan={4}>No mock sets. Add one to switch between testing scenarios.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </>
      )}

      {tab === 'ignores' && (
        <>
          <TabToolbar help="Matching requests are still proxied or mocked, but they are not written to logs.">
            <Button onClick={() => setEditingIgnore(null)}>Add ignore</Button>
          </TabToolbar>
          <Table striped responsive className="align-middle ignores-table">
            <colgroup>
              <col />
              <col />
              <col className="col-mode" />
              <col className="col-methods" />
              <col className="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>Name</th>
                <th>Path</th>
                <th>Mode</th>
                <th>Methods</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ignores.data?.map((ignore) => (
                <tr key={ignore.name}>
                  <td>{ignore.name}</td>
                  <td>
                    <code>{ignore.path}</code>
                  </td>
                  <td>{ignore.pathMode}</td>
                  <td>{ignore.methods?.length ? ignore.methods.join(', ') : 'any'}</td>
                  <td className="text-end">
                    <Stack direction="horizontal" gap={1} className="justify-content-end">
                      <Button variant="outline-primary" size="sm" onClick={() => setEditingIgnore(ignore)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => deleteIgnore({ proxyId: id, name: ignore.name })}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </td>
                </tr>
              ))}
              {ignores.data?.length === 0 && (
                <tr>
                  <td colSpan={5}>No ignored paths. Add one to keep noisy requests out of the log.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </>
      )}

      {tab === 'logs' && (
        <LogsPanel
          proxyId={id}
          active
          mocks={mocks.data ?? []}
          onOpenLog={setLogId}
          onOpenMock={openExistingMock}
        />
      )}

      <LogDetailModal
        show={logId != null}
        log={logDetail.data ?? null}
        existingMock={existingLogMock}
        onClose={() => setLogId(null)}
        onOpenMock={openExistingMock}
        onCreateMock={createMockFromLog}
        onCreateSend={createSendFromLog}
        onCreateIgnore={createIgnoreFromLog}
      />

      <MockSetEditor
        show={editingSet !== undefined}
        initial={editingSet}
        isNew={setIsNew}
        mocks={mocks.data ?? []}
        onSave={saveMockSet}
        onCancel={() => setEditingSet(undefined)}
      />

      <IgnoreEditor
        show={editingIgnore !== undefined}
        initial={editingIgnore}
        isNew={ignoreIsNew}
        onSave={saveIgnore}
        onCancel={() => setEditingIgnore(undefined)}
      />

      <MockEditor
        show={editing !== undefined}
        initial={editing}
        isNew={!editingExisting}
        defaultType={editing?.type ?? (tab === 'soap' ? 'soap' : 'rest')}
        onSave={saveMock}
        onCancel={() => setEditing(undefined)}
      />
    </>
  )
}

function isMockSetActive(set: MockSetDto, mocks: MockDto[]) {
  const enabled = mocks
    .filter((mock) => mock.enabled)
    .map((mock) => mock.name.toLowerCase())
    .sort()
  const selected = set.mockNames.map((name) => name.toLowerCase()).sort()
  return enabled.length === selected.length && enabled.every((name, index) => name === selected[index])
}

function MockNameLinks({
  names,
  mocks,
  onOpenMock,
}: {
  names: string[]
  mocks: MockDto[]
  onOpenMock: (mock: MockDto) => void
}) {
  if (names.length === 0) {
    return <span className="row-meta">none (apply disables all mocks)</span>
  }

  return (
    <Stack direction="horizontal" gap={2} className="flex-wrap">
      {names.map((name) => {
        const mock = mocks.find((item) => item.name.toLowerCase() === name.toLowerCase())
        return mock ? (
          <Button key={name} variant="link" size="sm" className="p-0" onClick={() => onOpenMock(mock)}>
            {mock.name}
          </Button>
        ) : (
          <span key={name} className="row-meta">
            {name}
          </span>
        )
      })}
    </Stack>
  )
}

function MockIcon({
  on,
  icon,
  activeClass,
  title,
}: {
  on: boolean
  icon: string
  activeClass: string
  title: string
}) {
  return (
    <OverlayTrigger overlay={<Tooltip>{title}</Tooltip>}>
      <i className={`bi ${icon} ${on ? activeClass : 'is-off'}`} aria-label={title} />
    </OverlayTrigger>
  )
}

function MockTable({
  items,
  onEdit,
  onToggle,
  onDelete,
}: {
  items: MockDto[]
  onEdit: (mock: MockDto) => void
  onToggle: (name: string) => void
  onDelete: (name: string) => void
}) {
  return (
    <Table striped responsive className="align-middle mocks-table">
      <colgroup>
        <col />
        <col className="col-methods" />
        <col />
        <col className="col-flags" />
        <col className="col-status" />
        <col className="col-actions-wide" />
      </colgroup>
      <thead>
        <tr>
          <th>Name</th>
          <th>Methods</th>
          <th>Match</th>
          <th>Flags</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((mock) => {
          const delayed = (mock.response.delayMs ?? 0) > 0
          const blocked = mock.response.block === true
          const advanced = hasAdvancedMatch(mock.match)
          const methods = mock.match.methods?.filter(Boolean) ?? []
          return (
            <tr key={mock.name} className={mock.enabled ? undefined : 'text-secondary'}>
              <td>
                {mock.name}
                <div className="row-meta">{mock.fileName}</div>
              </td>
              <td>
                {methods.length > 0 ? (
                  <Stack direction="horizontal" gap={1} className="flex-wrap">
                    {methods.map((method) => (
                      <Badge key={method} bg="secondary">
                        {method}
                      </Badge>
                    ))}
                  </Stack>
                ) : (
                  <span className="row-meta">any</span>
                )}
              </td>
              <td>
                <code>
                  {mock.type === 'soap'
                    ? mock.match.soapAction || mock.match.operation || '*'
                    : mock.match.path || '*'}
                </code>
                {mock.type !== 'soap' && mock.match.pathMode && mock.match.pathMode !== 'exact' && (
                  <div className="row-meta">{mock.match.pathMode}</div>
                )}
              </td>
              <td>
                <div className="mock-icons">
                  <MockIcon
                    on={mock.enabled}
                    icon={mock.enabled ? 'bi-check-circle-fill' : 'bi-pause-circle'}
                    activeClass={mock.enabled ? 'text-success' : 'text-secondary'}
                    title={mock.enabled ? 'Enabled' : 'Disabled'}
                  />
                  <MockIcon
                    on={delayed}
                    icon="bi-hourglass-split"
                    activeClass="text-warning"
                    title={delayed ? `Delayed ${mock.response.delayMs} ms` : 'No delay'}
                  />
                  <MockIcon
                    on={blocked}
                    icon="bi-slash-circle"
                    activeClass="text-danger"
                    title={blocked ? 'Blocks the request' : 'Responds normally'}
                  />
                  <MockIcon
                    on={advanced}
                    icon="bi-sliders"
                    activeClass="text-info"
                    title={advanced ? 'Uses extra match rules' : 'Path matching only'}
                  />
                </div>
              </td>
              <td>{blocked ? 'Block' : mock.response.statusCode}</td>
              <td className="text-end">
                <Stack direction="horizontal" gap={1} className="justify-content-end">
                  <Button variant="outline-secondary" size="sm" onClick={() => onToggle(mock.name)}>
                    {mock.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="outline-primary" size="sm" onClick={() => onEdit(mock)}>
                    Edit
                  </Button>
                  <Button variant="outline-danger" size="sm" onClick={() => onDelete(mock.name)}>
                    Delete
                  </Button>
                </Stack>
              </td>
            </tr>
          )
        })}
        {items.length === 0 && (
          <tr>
            <td colSpan={6}>No mocks in this group.</td>
          </tr>
        )}
      </tbody>
    </Table>
  )
}
