import { CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Modal, Segmented, Space, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { MockDto, MockSetDto } from "../store/types";

const blank = (): MockSetDto => ({ name: "", fileName: "", mockNames: [] });

type TypeFilter = "all" | "rest" | "soap";

interface Props {
  open: boolean;
  initial?: MockSetDto | null;
  isNew?: boolean;
  mocks: MockDto[];
  onSave: (set: MockSetDto) => Promise<void>;
  onCancel: () => void;
}

export function MockSetEditor({ open, initial, isNew = !initial?.name, mocks, onSave, onCancel }: Props) {
  const [set, setSet] = useState<MockSetDto>(initial ?? blank());
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSet(initial ?? blank());
      setQuery("");
      setTypeFilter("all");
      setError(null);
    }
  }, [initial, open]);

  const selectedLookup = useMemo(
    () => new Set(set.mockNames.map((name) => name.toLowerCase())),
    [set.mockNames],
  );
  const mocksByName = useMemo(() => {
    const map = new Map<string, MockDto>();
    for (const mock of mocks) {
      map.set(mock.name.toLowerCase(), mock);
    }
    return map;
  }, [mocks]);

  const selectedItems = useMemo(
    () => set.mockNames.map((name) => ({ name, mock: mocksByName.get(name.toLowerCase()) })),
    [mocksByName, set.mockNames],
  );
  const availableItems = useMemo(
    () =>
      mocks
        .filter((mock) => !selectedLookup.has(mock.name.toLowerCase()))
        .map((mock) => ({ name: mock.name, mock })),
    [mocks, selectedLookup],
  );

  const visibleSelected = useMemo(
    () => selectedItems.filter((item) => matchesPicker(item, query, typeFilter)).sort(comparePicker),
    [query, selectedItems, typeFilter],
  );
  const visibleAvailable = useMemo(
    () => availableItems.filter((item) => matchesPicker(item, query, typeFilter)).sort(comparePicker),
    [availableItems, query, typeFilter],
  );

  const addNames = (names: string[]) => {
    if (names.length === 0) {
      return;
    }
    const next = new Set(set.mockNames);
    for (const name of names) {
      if (![...next].some((item) => item.toLowerCase() === name.toLowerCase())) {
        next.add(name);
      }
    }
    setSet({ ...set, mockNames: [...next] });
  };

  const removeNames = (names: string[]) => {
    const drop = new Set(names.map((name) => name.toLowerCase()));
    setSet({ ...set, mockNames: set.mockNames.filter((name) => !drop.has(name.toLowerCase())) });
  };

  const submit = async () => {
    if (!set.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(set);
    } catch {
      setError("Could not save the mock set.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={isNew ? "New mock set" : `Edit ${initial?.name}`}
      width={900}
      okText="Save"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={onCancel}
      destroyOnHidden
    >
      {error && (
        <Typography.Text type="danger" style={{ display: "block", marginBottom: 12 }}>
          {error}
        </Typography.Text>
      )}
      <div style={{ marginBottom: 12 }}>
        <Typography.Text>Name</Typography.Text>
        <Input
          style={{ marginTop: 4 }}
          value={set.name}
          onChange={(event) => setSet({ ...set, name: event.target.value })}
        />
        <Typography.Text className="app-subtle">
          Applying this set enables the mocks in the left list and disables every other mock.
        </Typography.Text>
      </div>

      <Space wrap style={{ marginBottom: 8 }}>
        <Input
          allowClear
          style={{ width: 380 }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onPressEnter={() => {
            const first = visibleAvailable[0];
            if (first) {
              addNames([first.name]);
            }
          }}
          placeholder="Search by name, path, method, or SOAP action"
          aria-label="Search mocks"
        />
        <Segmented
          value={typeFilter}
          options={[
            { value: "all", label: "All" },
            { value: "rest", label: "REST" },
            { value: "soap", label: "SOAP" },
          ]}
          onChange={(value) => setTypeFilter(value as TypeFilter)}
        />
      </Space>
      <div className="app-subtle" style={{ marginBottom: 12 }}>
        {mocks.length === 0
          ? "Create mocks first, then add them to a set."
          : "Type to filter, click a mock to move it, or press Enter to add the first match."}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PickerPane
          title="In this set"
          shown={visibleSelected.length}
          total={selectedItems.length}
          empty={
            selectedItems.length === 0
              ? "No mocks selected. Apply would disable every mock."
              : "No selected mocks match this search."
          }
          actionLabel={query || typeFilter !== "all" ? "Remove matches" : "Remove all"}
          actionDisabled={visibleSelected.length === 0}
          onAction={() => removeNames(visibleSelected.map((item) => item.name))}
        >
          {visibleSelected.map((item) => (
            <PickerRow
              key={item.name}
              item={item}
              action="remove"
              onClick={() => removeNames([item.name])}
            />
          ))}
        </PickerPane>
        <PickerPane
          title="Available"
          shown={visibleAvailable.length}
          total={availableItems.length}
          empty={
            availableItems.length === 0
              ? mocks.length === 0
                ? "No mocks exist yet."
                : "Every mock is already in this set."
              : "No available mocks match this search."
          }
          actionLabel={query || typeFilter !== "all" ? "Add matches" : "Add all"}
          actionDisabled={visibleAvailable.length === 0}
          onAction={() => addNames(visibleAvailable.map((item) => item.name))}
        >
          {visibleAvailable.map((item) => (
            <PickerRow
              key={item.name}
              item={item}
              action="add"
              onClick={() => addNames([item.name])}
            />
          ))}
        </PickerPane>
      </div>
    </Modal>
  );
}

interface PickerItem {
  name: string;
  mock?: MockDto;
}

function PickerPane({
  title,
  shown,
  total,
  empty,
  actionLabel,
  actionDisabled,
  onAction,
  children,
}: {
  title: string;
  shown: number;
  total: number;
  empty: string;
  actionLabel: string;
  actionDisabled: boolean;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <div style={{ border: "1px solid var(--app-border)", borderRadius: 6 }}>
      <div
        className="app-row"
        style={{ padding: "6px 10px", borderBottom: "1px solid var(--app-border)", gap: 8 }}
      >
        <div>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <div className="app-subtle">{shown === total ? `${total}` : `${shown} of ${total}`}</div>
        </div>
        <Button
          size="small"
          style={{ marginLeft: "auto" }}
          disabled={actionDisabled}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      </div>
      <div style={{ maxHeight: 320, overflow: "auto" }}>
        {shown === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span className="app-subtle">{empty}</span>}
            style={{ margin: "16px 0" }}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function PickerRow({
  item,
  action,
  onClick,
}: {
  item: PickerItem;
  action: "add" | "remove";
  onClick: () => void;
}) {
  const mock = item.mock;
  const summary = mockSummary(mock);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--app-border)",
        padding: "6px 10px",
        cursor: "pointer",
        color: "inherit",
      }}
    >
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="app-row" style={{ gap: 6, flexWrap: "wrap" }}>
          <span>{item.name}</span>
          {mock ? <Tag>{mock.type === "soap" ? "SOAP" : "REST"}</Tag> : <Tag color="orange">missing</Tag>}
          {mock && !mock.enabled && <span className="app-subtle">disabled</span>}
        </span>
        <span className="app-subtle" style={{ display: "block" }}>
          {summary}
        </span>
      </span>
      {action === "add" ? <PlusOutlined /> : <CloseOutlined />}
    </button>
  );
}

function mockSummary(mock?: MockDto) {
  if (!mock) {
    return "This mock no longer exists";
  }
  const methods = mock.match.methods?.filter(Boolean) ?? [];
  const target =
    mock.type === "soap"
      ? mock.match.soapAction || mock.match.operation || "*"
      : mock.match.path || "*";
  const method = mock.type === "soap" ? "SOAP" : methods.length > 0 ? methods.join(", ") : "any";
  return `${method} ${target}`;
}

function matchesPicker(item: PickerItem, query: string, typeFilter: TypeFilter) {
  const type = item.mock?.type === "soap" ? "soap" : item.mock ? "rest" : null;
  if (typeFilter !== "all" && type !== typeFilter) {
    return false;
  }

  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  const haystack = [
    item.name,
    item.mock?.fileName,
    item.mock?.type,
    item.mock?.match.path,
    item.mock?.match.soapAction,
    item.mock?.match.operation,
    ...(item.mock?.match.methods ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function comparePicker(left: PickerItem, right: PickerItem) {
  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}
