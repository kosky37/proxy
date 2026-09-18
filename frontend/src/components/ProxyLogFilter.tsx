import { useMemo, useState } from "react";
import { Badge, Button, Collapse, Form, Stack } from "react-bootstrap";
import type { ProxyListItemDto } from "../store/types";

interface Props {
  proxies: ProxyListItemDto[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  onSelectIds: (ids: string[]) => void;
}

export function ProxyLogFilter({ proxies, selectedIds, onToggle, onSelectIds }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return proxies;
    }
    return proxies.filter((proxy) =>
      [proxy.id, proxy.name, proxy.listenUrl, proxy.listenPathPrefix, proxy.destinationAddress]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [proxies, query]);

  const summary =
    selectedIds.length === 0
      ? "No proxies selected"
      : selectedIds.length === proxies.length
        ? `All ${proxies.length} proxies`
        : `${selectedIds.length} of ${proxies.length} proxies`;

  return (
    <div className="log-filters mb-3">
      <button
        type="button"
        className="log-collapse-toggle"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <i className={`bi ${open ? "bi-chevron-down" : "bi-chevron-right"}`} aria-hidden />
        <strong>Proxies</strong>
        <span className="row-meta">{summary}</span>
        {selectedIds.length > 0 && selectedIds.length < proxies.length && (
          <Badge bg="primary">{selectedIds.length}</Badge>
        )}
      </button>
      <Collapse in={open}>
        <div className="mt-3">
          {proxies.length === 0 ? (
            <div className="row-meta">Create a proxy first.</div>
          ) : (
            <>
              <Stack direction="horizontal" gap={2} className="flex-wrap align-items-center mb-2">
                <Form.Control
                  className="proxy-log-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, id, listen URL, or destination"
                  aria-label="Search proxies"
                />
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => onSelectIds(proxies.map((proxy) => proxy.id))}
                >
                  All
                </Button>
                <Button variant="outline-secondary" size="sm" onClick={() => onSelectIds([])}>
                  None
                </Button>
                {query && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    disabled={visible.length === 0}
                    onClick={() =>
                      onSelectIds([
                        ...new Set([...selectedIds, ...visible.map((proxy) => proxy.id)]),
                      ])
                    }
                  >
                    Add matches
                  </Button>
                )}
              </Stack>
              <div className="row-meta mb-2">
                {visible.length === proxies.length
                  ? `${proxies.length} proxies`
                  : `${visible.length} of ${proxies.length} match`}
              </div>
              <div className="proxy-log-list">
                {visible.map((proxy) => (
                  <Form.Check
                    key={proxy.id}
                    type="checkbox"
                    id={`global-log-proxy-${proxy.id}`}
                    className="proxy-log-item"
                    checked={selected.has(proxy.id)}
                    label={
                      <span>
                        <span className="proxy-log-name">{proxy.name || proxy.id}</span>
                        <span className="row-meta">
                          {proxy.id}
                          {proxy.listenPathPrefix ? ` · ${proxy.listenPathPrefix}` : ""}
                          {` · ${proxy.listenUrl}`}
                        </span>
                      </span>
                    }
                    onChange={(event) => onToggle(proxy.id, event.target.checked)}
                  />
                ))}
                {visible.length === 0 && (
                  <div className="mock-set-empty">No proxies match this search.</div>
                )}
              </div>
            </>
          )}
        </div>
      </Collapse>
    </div>
  );
}
