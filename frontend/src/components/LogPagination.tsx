import { Pagination } from "antd";

export function LogPagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= 0) {
    return null;
  }

  return (
    <Pagination
      size="small"
      aria-label="Log pages"
      current={Math.min(page + 1, pageCount)}
      pageSize={pageSize}
      total={total}
      showSizeChanger={false}
      showLessItems
      onChange={(next) => onChange(next - 1)}
    />
  );
}
