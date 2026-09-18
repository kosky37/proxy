import type { SorterResult, SortOrder } from "antd/es/table/interface";

/** Column keys the API understands, see LogSort in the backend. */
export type LogSortField =
  | "time"
  | "method"
  | "path"
  | "protocol"
  | "mode"
  | "status"
  | "duration"
  | "proxy";

export interface LogSort {
  field: LogSortField;
  descending: boolean;
}

const FIELDS: LogSortField[] = [
  "time",
  "method",
  "path",
  "protocol",
  "mode",
  "status",
  "duration",
  "proxy",
];

function isLogSortField(value: unknown): value is LogSortField {
  return typeof value === "string" && (FIELDS as string[]).includes(value);
}

/**
 * Sorter props for one column. The sort itself runs in the API so it covers the whole
 * result set instead of the page that happens to be loaded.
 */
export function logSorter(field: LogSortField, sort: LogSort | null) {
  const order: SortOrder = sort?.field === field ? (sort.descending ? "descend" : "ascend") : null;
  return { key: field, sorter: true as const, sortOrder: order };
}

/** No explicit sort means newest first, which is what the API does by default. */
export function logSortFromSorter<T>(sorter: SorterResult<T> | SorterResult<T>[]): LogSort | null {
  const result = Array.isArray(sorter) ? sorter[0] : sorter;
  const order = result?.order;
  if (order !== "ascend" && order !== "descend") {
    return null;
  }

  return isLogSortField(result?.columnKey)
    ? { field: result.columnKey, descending: order === "descend" }
    : null;
}

export function logSortParams(sort: LogSort | null): { sort?: LogSortField; descending?: boolean } {
  return sort ? { sort: sort.field, descending: sort.descending } : {};
}
