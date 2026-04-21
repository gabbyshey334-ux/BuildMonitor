"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonRow } from "./SkeletonCard";
import { EmptyState } from "./EmptyState";

/**
 * JengaTrack DataTable
 * --------------------
 * Dense, monospace-friendly, sortable and paginable table for
 * expenses / transactions / materials.
 *
 *   • 48px row height (touch-friendly, enforced via `tr.jt-row`)
 *   • Accent left-border on row hover (JengaTrack gold)
 *   • Skeleton states + framer-motion row stagger animation
 *   • Numeric columns auto-get `font-mono tabular-nums`
 */

export type DataTableAlign = "left" | "right" | "center";

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  accessor: (row: T, index: number) => React.ReactNode;
  sortValue?: (row: T) => string | number | Date | null | undefined;
  align?: DataTableAlign;
  numeric?: boolean;
  width?: string;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  /** Visible only at sm+ */
  hiddenBelow?: "md" | "lg" | "xl";
}

export interface DataTableProps<T> {
  data: T[] | undefined;
  columns: DataTableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  loadingRows?: number;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  initialSortId?: string;
  initialSortDir?: "asc" | "desc";
  className?: string;
  pageSize?: number;
  showSearch?: boolean;
  searchPlaceholder?: string;
  /** Called to test a row against the search query */
  searchFilter?: (row: T, query: string) => boolean;
  /** Optional sticky footer content */
  footer?: React.ReactNode;
  stickyHeader?: boolean;
  dense?: boolean;
  /** Render a row-level badge strip (e.g. low-stock pulse) */
  rowAccent?: (row: T) => "danger" | "warning" | "primary" | null | undefined;
}

const HIDDEN_CLS: Record<string, string> = {
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    data,
    columns,
    rowKey,
    loading = false,
    loadingRows = 6,
    onRowClick,
    emptyState,
    initialSortId,
    initialSortDir = "desc",
    className,
    pageSize = 25,
    showSearch = false,
    searchPlaceholder = "Search…",
    searchFilter,
    footer,
    stickyHeader = true,
    dense = false,
    rowAccent,
  } = props;

  const [sortId, setSortId] = React.useState<string | null>(initialSortId ?? null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">(initialSortDir);
  const [page, setPage] = React.useState(1);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => setPage(1), [data?.length, query]);

  const filtered = React.useMemo(() => {
    if (!data) return [];
    if (!query || !searchFilter) return data;
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) => searchFilter(r, q));
  }, [data, query, searchFilter]);

  const sorted = React.useMemo(() => {
    if (!sortId) return filtered;
    const col = columns.find((c) => c.id === sortId);
    if (!col || !col.sortValue) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      if (av instanceof Date && bv instanceof Date) return (av.getTime() - bv.getTime()) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortId, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSlice = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (col: DataTableColumn<T>) => {
    if (col.sortable === false || !col.sortValue) return;
    if (sortId === col.id) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortId(col.id);
      setSortDir(col.numeric ? "desc" : "asc");
    }
  };

  const alignCls = (a?: DataTableAlign) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  const rowAccentCls = (tone: "danger" | "warning" | "primary" | null | undefined) => {
    if (!tone) return "";
    if (tone === "danger") return "border-l-jenga-danger/70 jt-pulse-amber";
    if (tone === "warning") return "border-l-jenga-warning/70";
    return "border-l-jenga-primary/70";
  };

  return (
    <div className={cn("jt-card p-0 overflow-hidden", className)}>
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead
            className={cn(
              "bg-jenga-raised/60 backdrop-blur-sm",
              stickyHeader && "sticky top-0 z-[1]",
            )}
          >
            <tr>
              {columns.map((col) => {
                const active = sortId === col.id;
                const sortable = col.sortable !== false && !!col.sortValue;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    className={cn(
                      "h-10 px-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/60 select-none",
                      alignCls(col.align),
                      col.hiddenBelow && HIDDEN_CLS[col.hiddenBelow],
                      sortable && "cursor-pointer hover:text-foreground",
                      col.headerClassName,
                    )}
                    style={{ width: col.width }}
                    onClick={() => handleSort(col)}
                    aria-sort={
                      active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                    }
                  >
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        col.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {col.header}
                      {sortable && (
                        <span
                          className={cn(
                            "text-[10px]",
                            active ? "text-jenga-primary" : "text-muted-foreground/60",
                          )}
                          aria-hidden
                        >
                          {active ? (
                            sortDir === "asc" ? (
                              <ArrowUp size={10} />
                            ) : (
                              <ArrowDown size={10} />
                            )
                          ) : (
                            <ArrowUpDown size={10} />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-border/40">
                  <td colSpan={columns.length} className="p-0">
                    <SkeletonRow />
                  </td>
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {emptyState ?? (
                    <EmptyState
                      title="No data yet"
                      description="Records will appear here as you add them."
                      compact
                      watermark={false}
                    />
                  )}
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {pageSlice.map((row, i) => (
                  <motion.tr
                    key={rowKey(row, i)}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(i * 0.015, 0.12) }}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "group border-l-2 border-l-transparent transition-colors",
                      "hover:bg-jenga-raised/50 hover:border-l-jenga-primary",
                      onRowClick && "cursor-pointer",
                      rowAccentCls(rowAccent?.(row)),
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={cn(
                          dense ? "h-10" : "h-12",
                          "px-4 border-b border-border/30 align-middle text-foreground/90",
                          alignCls(col.align),
                          col.numeric && "font-mono tabular-nums",
                          col.hiddenBelow && HIDDEN_CLS[col.hiddenBelow],
                          col.className,
                        )}
                      >
                        {col.accessor(row, (page - 1) * pageSize + i)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {footer && <div className="border-t border-border/60 bg-jenga-raised/40 px-4 py-2 text-xs text-muted-foreground">{footer}</div>}

      {!loading && sorted.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
          <span className="font-mono">
            {(page - 1) * pageSize + 1}–{Math.min(sorted.length, page * pageSize)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 disabled:opacity-30 hover:bg-jenga-raised"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono px-2">
              {page}/{totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 disabled:opacity-30 hover:bg-jenga-raised"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
