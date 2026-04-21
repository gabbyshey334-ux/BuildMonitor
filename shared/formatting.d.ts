/** Type declarations for shared/formatting.js */

export function formatCurrency(
  amount: unknown,
  currency?: string,
  options?: { compact?: boolean; decimals?: number; signed?: boolean },
): string;

export function formatCompact(value: unknown, decimals?: number): string;
export function formatNumber(value: unknown, decimals?: number): string;
export function formatPercent(value: unknown, decimals?: number): string;

export function formatDate(
  value: Date | string | number | null | undefined,
  options?: { full?: boolean },
): string;

export function formatRelativeDate(
  value: Date | string | number | null | undefined,
  now?: Date,
): string;

export function formatProjectionDate(
  value: Date | string | null | undefined,
): string;

export function formatDaysRemaining(days: number): string;
export function formatISODate(iso: string | null | undefined): string;
