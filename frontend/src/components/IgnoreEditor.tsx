import { Col, Input, Modal, Row, Segmented, Typography } from "antd";
import { useEffect, useState } from "react";
import type { IgnoredPathDto } from "../store/types";
import { FieldLabel, pathModeHelp } from "./FieldHelp";
import { MethodSelect } from "./Selects";

const blank = (): IgnoredPathDto => ({
  name: "",
  fileName: "",
  path: "",
  pathMode: "exact",
  methods: [],
});

interface Props {
  open: boolean;
  initial?: IgnoredPathDto | null;
  isNew?: boolean;
  onSave: (ignore: IgnoredPathDto) => Promise<void>;
  onCancel: () => void;
}

export function IgnoreEditor({ open, initial, isNew = !initial?.name, onSave, onCancel }: Props) {
  const [ignore, setIgnore] = useState<IgnoredPathDto>(initial ?? blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIgnore(initial ?? blank());
      setError(null);
    }
  }, [initial, open]);

  const submit = async () => {
    if (!ignore.name.trim() || !ignore.path.trim()) {
      setError("Name and path are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(ignore);
    } catch {
      setError("Could not save the ignore.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={isNew ? "New ignore" : `Edit ${initial?.name}`}
      width={640}
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
      <Row gutter={[16, 12]}>
        <Col xs={24} md={12}>
          <FieldLabel help="Catalog name for this ignore rule.">Name</FieldLabel>
          <Input
            style={{ marginTop: 4 }}
            value={ignore.name}
            onChange={(event) => setIgnore({ ...ignore, name: event.target.value })}
          />
        </Col>
        <Col xs={24} md={12}>
          <FieldLabel help={pathModeHelp}>Path mode</FieldLabel>
          <div style={{ marginTop: 4 }}>
            <Segmented
              block
              value={ignore.pathMode}
              options={[
                { value: "exact", label: "exact" },
                { value: "prefix", label: "prefix" },
                { value: "template", label: "template" },
              ]}
              onChange={(value) => setIgnore({ ...ignore, pathMode: String(value) })}
            />
          </div>
        </Col>
        <Col span={24}>
          <FieldLabel help="Path that should not be written to the request log. Noisy polling endpoints are typical candidates, e.g. `/health`.">
            Path
          </FieldLabel>
          <Input
            style={{ marginTop: 4 }}
            placeholder="/health"
            value={ignore.path}
            onChange={(event) => setIgnore({ ...ignore, path: event.target.value })}
          />
        </Col>
        <Col span={24}>
          <FieldLabel help="Leave empty to ignore every HTTP method for this path.">
            Methods (optional)
          </FieldLabel>
          <div style={{ marginTop: 4 }}>
            <MethodSelect
              multiple
              value={ignore.methods ?? []}
              onChange={(methods) => setIgnore({ ...ignore, methods })}
              placeholder="Any method"
            />
          </div>
        </Col>
      </Row>
    </Modal>
  );
}
