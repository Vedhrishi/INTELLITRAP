import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { cn } from "@/lib/utils";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
};

type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: (row: T) => string;
  onSearchChange?: (value: string) => void;
  pageSize?: number;
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
};

export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading = false,
  error = false,
  onRetry,
  searchable = true,
  searchPlaceholder = "Search…",
  searchValue,
  onSearchChange,
  pageSize = 10,
  toolbar,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  onRowClick,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query || !searchValue) return data;
    const q = query.toLowerCase();
    return data.filter((row) => searchValue(row).toLowerCase().includes(q));
  }, [data, query, searchValue]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.id === sort.id);
    if (!column?.sortValue) return filtered;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av === bv) return 0;
      return av > bv ? factor : -factor;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const rows = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (id: string) =>
    setSort((prev) =>
      prev?.id === id ? (prev.dir === "asc" ? { id, dir: "desc" } : null) : { id, dir: "asc" },
    );

  return (
    <div className="space-y-4">
      {(searchable || toolbar) && (
        <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
          {searchable ? (
            <div className="relative min-w-0 sm:max-w-xs sm:flex-1">
              <Search
                aria-hidden
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                  onSearchChange?.(event.target.value);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="pl-9"
              />
            </div>
          ) : (
            <span />
          )}
          {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      )}

      {error ? (
        <ErrorState onRetry={onRetry} />
      ) : loading ? (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.id} className={column.className}>
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className="inline-flex items-center gap-1.5 transition-colors duration-150 hover:text-foreground"
                        aria-label={`Sort by ${column.header}`}
                      >
                        {column.header}
                        {sort?.id === column.id ? (
                          sort.dir === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : (
                            <ArrowDown className="size-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && !error && sorted.length > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            Page {current + 1} of {pageCount} · {sorted.length} rows
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
