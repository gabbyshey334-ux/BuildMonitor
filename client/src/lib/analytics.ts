/**
 * JengaTrack Analytics Core
 * =========================================================================
 * Pure, well-guarded math helpers for every number shown to the user.
 *
 * Every rule from Section 5 of the redesign spec is enforced here:
 *   1. Soft-delete leaks    → `isNonDeleted(expense)` filter
 *   2. Null cost materials  → `(unit_cost ?? 0)` guard in inventoryValue()
 *   3. Burn rate div-by-zero → `computeBurn()` floors days at 1
 *   4. Budget % overflow     → `budgetPercent()` always returns raw +
 *                              clamped display versions separately
 *   5. Currency mismatch     → `formatCurrency(n, currency)` always uses
 *                              a dynamic currency from ProjectContext
 *   6. Date timezone drift   → `toLocalDay()` uses local midnight parsing
 *   7. Chart data gaps       → `fillDateGaps()` pads missing days with 0
 *   8. Category totals       → `sumByCategory()` uses soft-delete filter
 *   9. Transaction type bugs → strict compare `type === 'purchase' | 'usage'`
 *  10. Double-count guard    → `materialInventoryValue()` is quantity*cost,
 *                              never sums against expenses table.
 *
 * Nothing in this file should ever crash on a null, undefined, NaN, or
 * Infinity — all public helpers return defined numbers (or a sentinel
 * like Infinity for no-burn projects, which UI treats as "∞").
 * =========================================================================
 */

import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";

// ─── Core types ──────────────────────────────────────────────────────────
export interface Expense {
  id: string;
  amount: number | string;
  description?: string | null;
  category?: string | null;
  expense_date?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
  source?: string | null;
  vendor?: string | null;
  disputed?: boolean | null;
}

export interface InventoryRow {
  id: string;
  name: string;
  quantity: number | string | null;
  unit?: string;
  unit_cost?: number | string | null;
  total_cost?: number | string | null;
  low_stock_threshold?: number | null;
  updated_at?: string | null;
  last_purchased_at?: string | null;
  last_used_at?: string | null;
}

export type TransactionType = "purchase" | "usage";
export interface MaterialTransaction {
  id: string;
  material_name: string;
  quantity: number;
  transaction_type: string | null;
  created_at?: string | null;
  description?: string | null;
}

// ─── Guards ──────────────────────────────────────────────────────────────
export const safeNum = (v: unknown, fallback = 0): number => {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
};

/** Returns true if the expense is NOT soft-deleted */
export const isNonDeleted = (e: Pick<Expense, "deleted_at">): boolean =>
  !e || e.deleted_at == null;

/** Strict transaction type check — avoids the 'for ' bug fixed in #38065ae */
export const isTxnType = (
  txn: Pick<MaterialTransaction, "transaction_type">,
  type: TransactionType,
): boolean => String(txn.transaction_type || "").toLowerCase() === type;

// ─── Date helpers (timezone-safe) ────────────────────────────────────────
/**
 * Parse a date string consistently. Accepts:
 *   YYYY-MM-DD           → local midnight (no tz drift)
 *   ISO timestamp        → parsed as UTC
 *   Date | number        → passthrough
 */
export function toLocalDay(value: string | Date | number | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") return new Date(value);
  const s = String(value);
  if (!s) return null;
  // YYYY-MM-DD → local midnight (avoids UTC drift across timezones)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T12:00:00");
  try {
    return parseISO(s);
  } catch {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
}

export const dayKey = (d: Date): string => format(startOfDay(d), "yyyy-MM-dd");

// ─── Formatting ──────────────────────────────────────────────────────────
/**
 * Format currency using JetBrains Mono. Currency code is ALWAYS dynamic from
 * the project context — never hardcode 'UGX' elsewhere.
 */
export function formatCurrency(
  amount: unknown,
  currency: string = "UGX",
  options: { compact?: boolean; decimals?: number } = {},
): string {
  const n = safeNum(amount, 0);
  const { compact = false, decimals = 0 } = options;
  const abs = Math.abs(n);
  if (compact) {
    if (abs >= 1_000_000_000) return `${currency} ${(n / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${currency} ${(n / 1_000).toFixed(0)}K`;
  }
  return `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
}

export function formatCompactNumber(amount: unknown, decimals = 1): string {
  const n = safeNum(amount, 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(decimals)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(decimals === 0 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}

export function formatPercent(value: unknown, decimals = 1): string {
  const n = safeNum(value, 0);
  return `${n.toFixed(decimals)}%`;
}

// ─── Budget math ─────────────────────────────────────────────────────────
export interface BudgetHealth {
  /** Actual % spent, unclamped. Could exceed 100. */
  rawPercent: number;
  /** Clamped to [0,100] for progress/ring visuals. */
  displayPercent: number;
  /** Remaining budget (can be negative if overspent). */
  remaining: number;
  /** True when spent > total. */
  overBudget: boolean;
  total: number;
  spent: number;
  /** UI status key */
  status: "healthy" | "warning" | "danger" | "critical";
}

export function computeBudgetHealth(
  totalBudget: unknown,
  totalSpent: unknown,
): BudgetHealth {
  const total = safeNum(totalBudget, 0);
  const spent = Math.max(0, safeNum(totalSpent, 0));
  if (total <= 0) {
    return {
      rawPercent: 0,
      displayPercent: 0,
      remaining: -spent,
      overBudget: spent > 0,
      total,
      spent,
      status: spent > 0 ? "warning" : "healthy",
    };
  }
  const rawPercent = parseFloat(((spent / total) * 100).toFixed(1));
  const displayPercent = Math.min(100, Math.max(0, rawPercent));
  const remaining = total - spent;
  const overBudget = spent > total;
  let status: BudgetHealth["status"] = "healthy";
  if (overBudget) status = "critical";
  else if (rawPercent >= 85) status = "danger";
  else if (rawPercent >= 70) status = "warning";
  return { rawPercent, displayPercent, remaining, overBudget, total, spent, status };
}

// ─── Burn rate ───────────────────────────────────────────────────────────
export interface BurnRate {
  /** Average spend per day. 0 if insufficient data. */
  dailyRate: number;
  /** Weekly aggregate. */
  weeklyRate: number;
  /** Days remaining at this burn rate. Infinity if dailyRate === 0 */
  daysRemaining: number;
  /** True when < 4 days of data — treat as early estimate */
  isEarlyEstimate: boolean;
  /** How many distinct days with spending exist */
  daysWithSpending: number;
  /** Calendar days since first expense */
  daysSinceFirst: number;
}

export function computeBurn(
  expenses: Expense[],
  remainingBudget: number,
): BurnRate {
  const valid = expenses.filter(isNonDeleted);
  const totalSpent = valid.reduce((sum, e) => sum + Math.max(0, safeNum(e.amount)), 0);

  if (valid.length === 0 || totalSpent <= 0) {
    return {
      dailyRate: 0,
      weeklyRate: 0,
      daysRemaining: Infinity,
      isEarlyEstimate: false,
      daysWithSpending: 0,
      daysSinceFirst: 0,
    };
  }

  const dates = valid
    .map((e) => toLocalDay(e.expense_date || e.created_at))
    .filter((d): d is Date => d != null)
    .map((d) => startOfDay(d).getTime());

  if (dates.length === 0) {
    return {
      dailyRate: 0,
      weeklyRate: 0,
      daysRemaining: Infinity,
      isEarlyEstimate: false,
      daysWithSpending: 0,
      daysSinceFirst: 0,
    };
  }

  const firstMs = Math.min(...dates);
  const uniqueKeys = new Set(dates.map((t) => dayKey(new Date(t))));
  const daysWithSpending = Math.max(1, uniqueKeys.size);
  const daysSinceFirst = Math.max(
    1,
    Math.floor((Date.now() - firstMs) / 86_400_000),
  );

  const isEarlyEstimate = daysSinceFirst < 4;

  // Conservative: in early days, use days-with-spending (avoids overinflated rate)
  const divisor = isEarlyEstimate ? daysWithSpending : daysSinceFirst;
  const dailyRate = totalSpent / Math.max(1, divisor);
  const weeklyRate = Math.round(dailyRate * 7);

  let daysRemaining: number;
  if (dailyRate <= 0) daysRemaining = Infinity;
  else {
    const raw = Math.max(0, remainingBudget) / dailyRate;
    daysRemaining = Math.min(999, Math.round(raw));
  }

  return {
    dailyRate: Math.round(dailyRate),
    weeklyRate,
    daysRemaining,
    isEarlyEstimate,
    daysWithSpending,
    daysSinceFirst,
  };
}

// ─── Category totals ─────────────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Materials: [
    "cement", "sand", "stone", "tiles", "brick", "steel", "rod", "iron",
    "timber", "wood", "paint", "wire", "pipe", "block", "material", "receipt",
    "gravel", "aggregate", "rebar", "nails", "screws", "glass", "plaster",
  ],
  Labor: [
    "labor", "labour", "worker", "casual", "wage", "plumber", "electrician",
    "mason", "carpenter", "painter", "driver", "foreman",
  ],
  Equipment: [
    "equipment", "tool", "machine", "rental", "hire", "generator", "pump", "mixer",
  ],
  Transport: ["transport", "delivery", "fuel", "logistics", "truck"],
};

export function categorise(expense: Pick<Expense, "category" | "description">): string {
  const cat = (expense.category || "").trim();
  if (cat && cat.toLowerCase() !== "other" && cat.toLowerCase() !== "uncategorized") {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }
  const desc = (expense.description || "").toLowerCase();
  for (const [name, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => desc.includes(kw))) return name;
  }
  return "Other";
}

export interface CategoryTotal {
  name: string;
  amount: number;
  count: number;
  percent: number;
}

export function sumByCategory(expenses: Expense[]): CategoryTotal[] {
  const valid = expenses.filter(isNonDeleted);
  const totalsMap: Record<string, { amount: number; count: number }> = {};
  let grand = 0;
  for (const e of valid) {
    const amt = Math.max(0, safeNum(e.amount));
    if (amt <= 0) continue;
    const cat = categorise(e);
    if (!totalsMap[cat]) totalsMap[cat] = { amount: 0, count: 0 };
    totalsMap[cat].amount += amt;
    totalsMap[cat].count += 1;
    grand += amt;
  }
  return Object.entries(totalsMap)
    .map(([name, v]) => ({
      name,
      amount: v.amount,
      count: v.count,
      percent: grand > 0 ? parseFloat(((v.amount / grand) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

// ─── Inventory value ─────────────────────────────────────────────────────
/**
 * Current inventory value = quantity × (unit_cost ?? 0) — never historical
 * total_cost, never summed against the expenses table.
 */
export function materialInventoryValue(inventory: InventoryRow[]): number {
  return inventory.reduce((sum, m) => {
    const q = Math.max(0, safeNum(m.quantity));
    const c = Math.max(0, safeNum(m.unit_cost)); // null guarded
    return sum + q * c;
  }, 0);
}

export function lowStockRows(inventory: InventoryRow[]): InventoryRow[] {
  return inventory.filter((m) => {
    const qty = safeNum(m.quantity);
    const th = safeNum(m.low_stock_threshold ?? 5, 5);
    return qty > 0 && qty <= th;
  });
}

// ─── Date gap filling for chart data ────────────────────────────────────
/**
 * Pads a sparse date-series with 0-value data points so charts render smooth
 * lines and don't skip days.
 *
 * @param data   An array sorted ascending by `date` (string YYYY-MM-DD or Date)
 * @param from   Start of the range (inclusive)
 * @param to     End of the range (inclusive)
 * @param valueKeys   The numeric keys to zero-fill (default ['value'])
 */
export function fillDateGaps<T extends { date: string; [k: string]: unknown }>(
  data: T[],
  from: Date,
  to: Date,
  valueKeys: (keyof T)[] = ["value" as keyof T],
): T[] {
  const map = new Map<string, T>();
  for (const row of data) map.set(row.date, row);
  const out: T[] = [];
  let cursor = startOfDay(from);
  const endDay = startOfDay(to);
  while (cursor.getTime() <= endDay.getTime()) {
    const key = dayKey(cursor);
    const existing = map.get(key);
    if (existing) out.push(existing);
    else {
      const zeroed: Record<string, unknown> = { date: key };
      for (const k of valueKeys) zeroed[k as string] = 0;
      out.push(zeroed as T);
    }
    cursor = addDays(cursor, 1);
  }
  return out;
}

// ─── Spend over time ────────────────────────────────────────────────────
export interface DailySpend {
  date: string;
  value: number;
  cumulative: number;
}

export function spendOverTime(
  expenses: Expense[],
  options: { from?: Date; to?: Date; fillGaps?: boolean } = {},
): DailySpend[] {
  const valid = expenses.filter(isNonDeleted);
  if (valid.length === 0) return [];

  const points: Record<string, number> = {};
  const dates: number[] = [];
  for (const e of valid) {
    const d = toLocalDay(e.expense_date || e.created_at);
    if (!d) continue;
    const key = dayKey(d);
    points[key] = (points[key] || 0) + Math.max(0, safeNum(e.amount));
    dates.push(d.getTime());
  }

  const earliest = dates.length ? new Date(Math.min(...dates)) : new Date();
  const latest = dates.length ? new Date(Math.max(...dates)) : new Date();
  const from = options.from ?? earliest;
  const to = options.to ?? latest;

  let sorted = Object.entries(points)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (options.fillGaps !== false) {
    sorted = fillDateGaps(sorted, from, to, ["value"]);
  }

  let running = 0;
  return sorted.map((p) => {
    running += p.value;
    return { date: p.date, value: p.value, cumulative: running };
  });
}

// ─── Weekly stacked totals ──────────────────────────────────────────────
export interface WeeklyCategoryPoint {
  week: string;
  [category: string]: number | string;
}

export function weeklyByCategory(
  expenses: Expense[],
  weeks = 8,
): WeeklyCategoryPoint[] {
  const valid = expenses.filter(isNonDeleted);
  const now = new Date();
  const result: Record<string, Record<string, number>> = {};
  const allCats = new Set<string>();

  for (let i = weeks - 1; i >= 0; i--) {
    const weekDate = addDays(now, -i * 7);
    const key = format(weekDate, "MMM d");
    result[key] = {};
  }

  for (const e of valid) {
    const d = toLocalDay(e.expense_date || e.created_at);
    if (!d) continue;
    const diffWeeks = Math.floor(
      differenceInCalendarDays(startOfDay(now), startOfDay(d)) / 7,
    );
    if (diffWeeks < 0 || diffWeeks >= weeks) continue;
    const weekDate = addDays(now, -diffWeeks * 7);
    const key = format(weekDate, "MMM d");
    const cat = categorise(e);
    allCats.add(cat);
    result[key] = result[key] || {};
    result[key][cat] = (result[key][cat] || 0) + Math.max(0, safeNum(e.amount));
  }

  return Object.entries(result)
    .reverse()
    .map(([week, cats]) => {
      const row: WeeklyCategoryPoint = { week };
      Array.from(allCats).forEach((c) => {
        row[c] = cats[c] || 0;
      });
      return row;
    });
}

// ─── Sanity check panel ─────────────────────────────────────────────────
export function analyticsSnapshot(
  expenses: Expense[],
  inventory: InventoryRow[],
  totalBudget: unknown,
) {
  const valid = expenses.filter(isNonDeleted);
  const spent = valid.reduce((s, e) => s + safeNum(e.amount), 0);
  const budget = computeBudgetHealth(totalBudget, spent);
  const burn = computeBurn(valid, budget.remaining);
  const categoryTotals = sumByCategory(valid);
  const inventoryValue = materialInventoryValue(inventory);
  const lowStock = lowStockRows(inventory);
  const warnings: string[] = [];
  if (budget.overBudget) warnings.push(`Budget exceeded by ${formatPercent(budget.rawPercent - 100)}`);
  if (burn.isEarlyEstimate && burn.dailyRate > 0)
    warnings.push("Burn rate estimate based on fewer than 4 days of data");
  if (inventory.some((m) => m.unit_cost == null))
    warnings.push("One or more materials have null unit_cost (treated as 0)");
  const softDeletedCount = expenses.length - valid.length;
  if (softDeletedCount > 0)
    warnings.push(`${softDeletedCount} soft-deleted expense(s) filtered out`);
  return {
    counts: {
      totalExpenses: expenses.length,
      validExpenses: valid.length,
      softDeletedExpenses: softDeletedCount,
      inventoryItems: inventory.length,
      lowStockItems: lowStock.length,
      categories: categoryTotals.length,
    },
    budget,
    burn,
    categoryTotals,
    inventoryValue,
    warnings,
  };
}
