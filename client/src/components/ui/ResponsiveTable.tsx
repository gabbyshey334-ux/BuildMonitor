"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useChartHeight";

export interface ResponsiveColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Render cell value from the row. */
  cell: (row: T, index: number) => React.ReactNode;
  /** Tailwind width / alignment classes for the <th> and <td>. */
  className?: string;
  /** Hide column below a breakpoint (e.g., "md" hides below md). */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  /** Right-align numeric columns. */
  align?: "left" | "right" | "center";
}

export interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  data: T[];
  /** How to render each row as a card on mobile (< md). Required. */
  mobileCard: (row: T, index: number) => React.ReactNode;
  /** Optional row click handler (desktop + mobile). */
  onRowClick?: (row: T) => void;
  /** Content to show when `data.length === 0`. */
  emptyState?: React.ReactNode;
  /** Optional key extractor. Default: index. */
  keyExtractor?: (row: T, index: number) => React.Key;
  /** Additional className for the wrapper. */
  className?: string;
  /** Hide the column header on mobile (default: true, since cards show labels). */
  hideHeaderMobile?: boolean;
  /** Force mobile cards regardless of viewport. */
  forceMobile?: boolean;
  /** Force desktop table regardless of viewport. */
  forceDesktop?: boolean;
}

const HIDE_BELOW_CLASS: Record<NonNullable<ResponsiveColumn<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

const ALIGN_CLASS: Record<NonNullable<ResponsiveColumn<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

/**
 * Responsive table:
 *   - On mobile (< 768px): renders `mobileCard(row)` for each data row.
 *   - On tablet/desktop (≥ 768px): renders a standard <table> with headers and rows.
 *
 * No horizontal scrolling. Ever. If a column must be shown on small screens,
 * use the `hideBelow` prop to hide less-critical columns.
 */
export function ResponsiveTable<T>({
  columns,
  data,
  mobileCard,
  onRowClick,
  emptyState,
  keyExtractor,
  className,
  hideHeaderMobile = true,
  forceMobile = false,
  forceDesktop = false,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();
  const showMobile = forceMobile || (!forceDesktop && isMobile);

  const getKey = (row: T, i: number) =>
    keyExtractor ? keyExtractor(row, i) : i;

  if (!data || data.length === 0) {
    return (
      <div className={cn("w-full", className)}>
        {emptyState ?? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No data to display.
          </div>
        )}
      </div>
    );
  }

  // Mobile: render stacked cards (no <table>)
  if (showMobile) {
    return (
      <div
        className={cn("flex flex-col gap-3 w-full min-w-0", className)}
        role="list"
      >
        {data.map((row, i) => {
          const content = mobileCard(row, i);
          if (!onRowClick) {
            return (
              <div key={getKey(row, i)} role="listitem" className="min-w-0">
                {content}
              </div>
            );
          }
          return (
            <div
              key={getKey(row, i)}
              role="listitem"
              onClick={() => onRowClick(row)}
              className="min-w-0 cursor-pointer touch-manipulation active:scale-[0.99] transition-transform"
            >
              {content}
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop: standard table
  return (
    <div className={cn("w-full min-w-0 overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        <thead
          className={cn(
            "border-b border-border/60 bg-muted/20",
            hideHeaderMobile && "hidden md:table-header-group",
          )}
        >
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap",
                  col.align ? ALIGN_CLASS[col.align] : ALIGN_CLASS.left,
                  col.hideBelow && HIDE_BELOW_CLASS[col.hideBelow],
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={getKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-border/30 last:border-b-0",
                "transition-colors hover:bg-muted/30",
                onRowClick && "cursor-pointer",
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-3 py-3 align-middle",
                    col.align ? ALIGN_CLASS[col.align] : ALIGN_CLASS.left,
                    col.hideBelow && HIDE_BELOW_CLASS[col.hideBelow],
                    col.className,
                  )}
                >
                  {col.cell(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ResponsiveTable;
