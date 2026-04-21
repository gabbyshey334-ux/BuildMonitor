/**
 * Type declarations for shared/calculations.js
 *
 * The implementation is plain ESM JavaScript (so it can be imported at
 * Node runtime by serverless functions without a build step). This .d.ts
 * gives every TypeScript consumer full, strict types.
 */

export type BudgetStatus =
  | "healthy"
  | "warning"
  | "danger"
  | "over"
  | "no-budget";

export interface BudgetPercentResult {
  /** Real percent spent — can exceed 100. */
  raw: number;
  /** Clamped to [0, 100] for rings/bars. */
  visual: number;
  /** "67.8%" / "143.2% (OVER BUDGET)" / "No budget set" */
  display: string;
  status: BudgetStatus;
  isOver: boolean;
  spent: number;
  budget: number;
  /** budget - spent (can be negative when over). */
  remaining: number;
}

export interface BurnRateResult {
  dailyRate: number;
  weeklyRate: number;
  daysElapsed: number;
  daysRemaining: number;
  projectedExhaustionDate: Date | null;
  isEarlyEstimate: boolean;
  disclaimer: string | null;
  displayRate: string;
  displayDaysRemaining: string;
}

export interface CategoryTotal {
  name: string;
  amount: number;
  count: number;
  percent: number;
}

export interface RunoutResult {
  days: number;
  date: Date | null;
  display: string;
}

export interface SoftDeletedRow {
  deleted_at?: unknown;
  deletedAt?: unknown;
}

export interface ExpenseLike extends SoftDeletedRow {
  amount?: unknown;
  category?: unknown;
  expense_date?: unknown;
  expenseDate?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
}

export interface MaterialLike {
  quantity?: unknown;
  unit_cost?: unknown;
  unitCost?: unknown;
}

export function safeNum(value: unknown, fallback?: number): number;
export function isNonDeleted(row: SoftDeletedRow | null | undefined): boolean;

export function toUTCMidnight(
  value: string | Date | number | null | undefined,
): Date | null;
export function daysDiff(
  from: Date | string,
  to: Date | string,
): number;
export function todayUTCMidnight(): Date;
export function dateKey(value: Date | string): string;

export function calcBudgetPercent(
  spent: unknown,
  budget: unknown,
): BudgetPercentResult;

export function calcBurnRate(
  totalSpent: number | string,
  budget: number | string,
  firstExpenseDate: Date | string | null | undefined,
  currency?: string,
  today?: Date,
): BurnRateResult;

export function findFirstExpenseDate(expenses: ExpenseLike[]): Date | null;

export function calcMaterialValue(
  quantity: unknown,
  unitCost: unknown,
): number;
export function calcInventoryTotal(materials: MaterialLike[]): number;

export function normalizeCategory(value: unknown): string;
export function sumByCategory(expenses: ExpenseLike[]): CategoryTotal[];
export function sumExpenses(expenses: ExpenseLike[]): number;

export function fillDateGaps<
  T extends { date: string; [k: string]: unknown },
>(
  data: T[],
  startDate: Date | string,
  endDate: Date | string,
  valueKey?: string,
): T[];

export function resolveTransactionType(
  aiAction: string | null | undefined,
  rawMessage: string | null | undefined,
): "purchase" | "usage";

export function calcRunoutDate(
  quantity: number | string | null | undefined,
  usageRatePerDay: number | string | null | undefined,
  today?: Date,
): RunoutResult;
