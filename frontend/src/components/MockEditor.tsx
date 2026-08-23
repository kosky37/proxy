import { useEffect, useState, type FormEvent } from 'react'
import type { MockDto } from '../store/types'

const blank = (type: string): MockDto => ({
  name: '',
  fileName: '',
  enabled: true,
  type,
  match: { pathMode: 'exact', methods: type === 'rest' ? ['GET'] : ['POST'] },
  response: { statusCode: 200, delayMs: 0, contentType: type === 'soap' ? 'text/xml' : 'application/json' },
})

interface Props {
  initial?: MockDto | null
  onSave: (mock: MockDto) => Promise<void>
  onCancel: () => void
}

export function MockEditor({ initial, onSave, onCancel }: Props) {
  const [mock, setMock] = useState<MockDto>(initial ?? blank('rest'))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setMock(initial ?? blank('rest'))
  }, [initial])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave(mock)
    } finally {
      setSaving(false)
    }
  }

  const isSoap = mock.type === 'soap'

  return (
    <form className="card mb-4" onSubmit={submit}>
      <div className="card-header">{initial ? `Edit ${initial.name}` : 'New mock'}</div>
      <div className="card-body row g-3">
        <div className="col-md-3">
          <label className="form-label">Type</label>
          <select
            className="form-select"
            value={mock.type}
            onChange={(event) => setMock({ ...mock, type: event.target.value })}
          >
            <option value="rest">REST</option>
            <option value="soap">SOAP</option>
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Name</label>
          <input
            className="form-control"
            required
            value={mock.name}
            onChange={(event) => setMock({ ...mock, name: event.target.value })}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Status</label>
          <input
            className="form-control"
            type="number"
            value={mock.response.statusCode}
            onChange={(event) =>
              setMock({ ...mock, response: { ...mock.response, statusCode: Number(event.target.value) } })
            }
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Delay ms</label>
          <input
            className="form-control"
            type="number"
            value={mock.response.delayMs}
            onChange={(event) =>
              setMock({ ...mock, response: { ...mock.response, delayMs: Number(event.target.value) } })
            }
          />
        </div>
        <div className="col-md-2 d-flex align-items-end">
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={mock.enabled}
              onChange={(event) => setMock({ ...mock, enabled: event.target.checked })}
            />
            <label className="form-check-label">Enabled</label>
          </div>
        </div>

        <div className="col-md-4">
          <label className="form-label">Path</label>
          <input
            className="form-control"
            value={mock.match.path ?? ''}
            onChange={(event) => setMock({ ...mock, match: { ...mock.match, path: event.target.value } })}
          />
        </div>
        {!isSoap && (
          <>
            <div className="col-md-4">
              <label className="form-label">Methods (comma)</label>
              <input
                className="form-control"
                value={(mock.match.methods ?? []).join(',')}
                onChange={(event) =>
                  setMock({
                    ...mock,
                    match: {
                      ...mock.match,
                      methods: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                    },
                  })
                }
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Path mode</label>
              <select
                className="form-select"
                value={mock.match.pathMode}
                onChange={(event) => setMock({ ...mock, match: { ...mock.match, pathMode: event.target.value } })}
              >
                <option value="exact">exact</option>
                <option value="prefix">prefix</option>
                <option value="template">template</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Body contains</label>
              <input
                className="form-control"
                value={mock.match.bodyContains ?? ''}
                onChange={(event) => setMock({ ...mock, match: { ...mock.match, bodyContains: event.target.value } })}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">JSON path equals</label>
              <div className="input-group">
                <input
                  className="form-control"
                  placeholder="$.id"
                  value={mock.match.jsonPath ?? ''}
                  onChange={(event) => setMock({ ...mock, match: { ...mock.match, jsonPath: event.target.value } })}
                />
                <input
                  className="form-control"
                  placeholder="value"
                  value={mock.match.jsonPathEquals ?? ''}
                  onChange={(event) =>
                    setMock({ ...mock, match: { ...mock.match, jsonPathEquals: event.target.value } })
                  }
                />
              </div>
            </div>
          </>
        )}
        {isSoap && (
          <>
            <div className="col-md-4">
              <label className="form-label">SOAPAction</label>
              <input
                className="form-control"
                value={mock.match.soapAction ?? ''}
                onChange={(event) => setMock({ ...mock, match: { ...mock.match, soapAction: event.target.value } })}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Operation</label>
              <input
                className="form-control"
                value={mock.match.operation ?? ''}
                onChange={(event) => setMock({ ...mock, match: { ...mock.match, operation: event.target.value } })}
              />
            </div>
            <div className="col-12">
              <label className="form-label">XPath</label>
              <input
                className="form-control"
                value={mock.match.xpath ?? ''}
                onChange={(event) => setMock({ ...mock, match: { ...mock.match, xpath: event.target.value } })}
              />
            </div>
          </>
        )}
        <div className="col-md-4">
          <label className="form-label">Content type</label>
          <input
            className="form-control"
            value={mock.response.contentType ?? ''}
            onChange={(event) =>
              setMock({ ...mock, response: { ...mock.response, contentType: event.target.value } })
            }
          />
        </div>
        <div className="col-md-8">
          <label className="form-label">Body file</label>
          <input
            className="form-control"
            value={mock.response.bodyFile ?? ''}
            onChange={(event) => setMock({ ...mock, response: { ...mock.response, bodyFile: event.target.value } })}
          />
        </div>
        <div className="col-12">
          <label className="form-label">Response body</label>
          <textarea
            className="form-control"
            rows={6}
            value={mock.response.body ?? ''}
            onChange={(event) => setMock({ ...mock, response: { ...mock.response, body: event.target.value } })}
          />
        </div>
        <div className="col-12">
          <button className="btn btn-primary me-2" type="submit" disabled={saving}>
            Save
          </button>
          <button className="btn btn-outline-secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}
