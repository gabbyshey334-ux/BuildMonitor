/**
 * JengaTrack — Shared Numeric Calculations
 * =========================================================================
 * Single source of truth for every money / budget / burn / inventory / date
 * calculation in the app. Imported by:
 *
 *   • Frontend        (client/src/**)
 *   • Backend API     (api/index.js, server/routes/**)
 *   • WhatsApp bot    (api/_whatsapp-webhook.ts, api/_daily-heartbeat.ts,
 *                      server/whatsappHandler.ts, server/twilioWebhookHandler.ts,
 *                      server/extractedDataHandler.ts)
 *
 * Rules for this file:
 *   1. Pure functions only — no side effects, no I/O, no React imports.
 *   2. Every function guards against null, undefined, NaN, Infinity, and
 *      empty arrays — never returns an ill-defined number to a caller.
 *   3. Written as ESM JS with JSDoc types so it can be required at Node
 *      runtime (Vercel serverless) AND type-checked by TypeScript via the
 *      adjacent .d.ts declaration file.
 *   4. No currency hardcoded — every money-related function accepts a
 *      `currency` argument threaded through from project.currency.
 *   5. All date math happens in UTC-midnight to eliminate timezone drift.
 * =========================================================================
 */

// ─── Number guards ────────────────────────────────────────────────────────

/**
 * Coerce any value to a finite number. Strips commas ("1,234" → 1234),
 * handles numeric strings, returns `fallback` for null/undefined/NaN/Infinity.
 *
 * @param {unknown} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeNum(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const stripped = String(value).replace(/,/g, "").trim();
  if (!stripped) return fallback;
  const n = parseFloat(stripped);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * True if an expense row has NOT been soft-deleted.
 * Accepts both `deleted_at` (Supabase snake_case) and `deletedAt` (Drizzle).
 *
 * @param {{ deleted_at?: unknown, deletedAt?: unknown } | null | undefined} row
 */
export function isNonDeleted(row) {
  if (!row) return false;
  return row.deleted_at == null && row.deletedAt == null;
}

// ─── Timezone-safe dates ──────────────────────────────────────────────────
// Uganda is UTC+3 (no DST). We use UTC-midnight anchors to compare "days"
// without drifting across timezones.

/**
 * Parse any input into a UTC-midnight Date.
 *   "2025-04-20"                   → 2025-04-20 00:00 UTC
 *   "2025-04-20T14:32:11.000Z"     → 2025-04-20 00:00 UTC
 *   "2025-04-20T00:00:00"          → 2025-04-20 00:00 UTC (date-only)
 *   Date object                     → date part in UTC
 *
 * @param {string | Date | number | null | undefined} value
 * @returns {Date | null}
 */
export function toUTCMidnight(value) {
  if (value === null || value === undefined) return null;
  let d;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    d = value;
  } else if (typeof value === "number") {
    d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
  } else {
    const str = String(value).trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, day] = str.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, day));
    }
    d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Whole-day integer difference between two dates (to − from). Negative if
 * `to` is before `from`. Both arguments are normalized to UTC midnight first.
 *
 * @param {Date | string} from
 * @param {Date | string} to
 * @returns {number}
 */
export function daysDiff(from, to) {
  const a = toUTCMidnight(from);
  const b = toUTCMidnight(to);
  if (!a || !b) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Today at UTC midnight. Cheap helper for burn-rate math.
 * @returns {Date}
 */
export function todayUTCMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * YYYY-MM-DD key from any date input. Useful as a Map key.
 * @param {Date | string} value
 * @returns {string}
 */
export function dateKey(value) {
  const d = toUTCMidnight(value);
  if (!d) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Budget percentage ────────────────────────────────────────────────────

/** @typedef {'healthy' | 'warning' | 'danger' | 'over' | 'no-budget'} BudgetStatus */

/**
 * @typedef BudgetPercentResult
 * @property {number}  raw      Actual spent/budget × 100 — can exceed 100.
 * @property {number}  visual   Clamped to [0,100] for rings/bars.
 * @property {string}  display  "67.8%" or "143.2% (OVER BUDGET)" or "No budget set".
 * @property {BudgetStatus} status
 * @property {boolean} isOver
 * @property {number}  spent
 * @property {number}  budget
 * @property {number}  remaining   budget − spent (can be negative when over).
 */

/**
 * THE single correct budget-% formula. Use this everywhere — no inline math.
 *
 * Handles:
 *   • Zero / null budget   → {status:'no-budget', display:'No budget set'}
 *   • Over-budget          → visual clamped at 100; display shows real %.
 *   • NaN / Infinity       → defensively returns 0% healthy.
 *
 * @param {unknown} spent
 * @param {unknown} budget
 * @returns {BudgetPercentResult}
 */
export function calcBudgetPercent(spent, budget) {
  const s = Math.max(0, safeNum(spent));
  const b = safeNum(budget);
  if (!b || b <= 0) {
    return {
      raw: 0,
      visual: 0,
      display: "No budget set",
      status: "no-budget",
      isOver: false,
      spent: s,
      budget: Math.max(0, b),
      remaining: -s,
    };
  }
  const raw = (s / b) * 100;
  if (!Number.isFinite(raw)) {
    return {
      raw: 0,
      visual: 0,
      display: "0.0%",
      status: "healthy",
      isOver: false,
      spent: s,
      budget: b,
      remaining: b,
    };
  }
  const isOver = raw > 100;
  /** @type {BudgetStatus} */
  let status;
  if (isOver) status = "over";
  else if (raw >= 85) status = "danger";
  else if (raw >= 70) status = "warning";
  else status = "healthy";
  return {
    raw,
    visual: Math.min(100, Math.max(0, raw)),
    display: isOver
      ? `${raw.toFixed(1)}% (OVER BUDGET)`
      : `${raw.toFixed(1)}%`,
    status,
    isOver,
    spent: s,
    budget: b,
    remaining: b - s,
  };
}

// ─── Burn rate ────────────────────────────────────────────────────────────

/**
 * @typedef BurnRateResult
 * @property {number} dailyRate                 Currency/day.
 * @property {number} weeklyRate                dailyRate × 7 (rounded).
 * @property {number} daysElapsed               max(1, days since firstExpenseDate).
 * @property {number} daysRemaining             Integer days of runway. Infinity
 *                                              when dailyRate is 0.
 * @property {Date | null} projectedExhaustionDate  UTC-midnight.
 * @property {boolean} isEarlyEstimate          True when daysElapsed < 4.
 * @property {string | null} disclaimer         Non-null only in early estimate.
 * @property {string} displayRate               "UGX 42,000/day".
 * @property {string} displayDaysRemaining      "42 days" / "∞" / "999+ days" /
 *                                              "Budget exhausted".
 */

/**
 * Canonical burn-rate calculation.
 *
 * Formula:
 *   daysElapsed    = max(1, floor(today − firstExpenseDate in UTC days))
 *   dailyRate      = totalSpent / daysElapsed
 *                    × 0.7 safety multiplier when daysElapsed < 4
 *                    (to avoid overinflation from single spiky day)
 *   daysRemaining  = max(0, budget − spent) / dailyRate
 *   projectedDate  = today + daysRemaining days
 *
 * @param {number | string} totalSpent
 * @param {number | string} budget
 * @param {Date | string | null | undefined} firstExpenseDate
 * @param {string} [currency="UGX"]
 * @param {Date} [today]  Override for tests; defaults to now.
 * @returns {BurnRateResult}
 */
export function calcBurnRate(totalSpent, budget, firstExpenseDate, currency = "UGX", today) {
  const spent = Math.max(0, safeNum(totalSpent));
  const b = Math.max(0, safeNum(budget));
  const remaining = Math.max(0, b - spent);
  const now = today ?? new Date();

  const todayUtc = toUTCMidnight(now) ?? new Date();
  const first = toUTCMidnight(firstExpenseDate);

  if (!first || spent <= 0) {
    return {
      dailyRate: 0,
      weeklyRate: 0,
      daysElapsed: 0,
      daysRemaining: Infinity,
      projectedExhaustionDate: null,
      isEarlyEstimate: false,
      disclaimer: null,
      displayRate: `${currency} 0/day`,
      displayDaysRemaining: "∞",
    };
  }

  const daysElapsed = Math.max(
    1,
    Math.floor((todayUtc.getTime() - first.getTime()) / 86_400_000),
  );
  const isEarlyEstimate = daysElapsed < 4;
  const rawDaily = spent / daysElapsed;
  const dailyRate = isEarlyEstimate ? rawDaily * 0.7 : rawDaily;

  let daysRemaining;
  let projectedExhaustionDate = null;
  let displayDaysRemaining;

  if (remaining <= 0) {
    daysRemaining = 0;
    projectedExhaustionDate = todayUtc;
    displayDaysRemaining = "Budget exhausted";
  } else if (dailyRate <= 0 || !Number.isFinite(dailyRate)) {
    daysRemaining = Infinity;
    displayDaysRemaining = "∞";
  } else {
    const rawDays = remaining / dailyRate;
    daysRemaining = Math.max(0, Math.floor(rawDays));
    // Display rules — the calc value itself is uncapped so callers can do
    // arithmetic with it. Only the human string is capped.
    //   > 999 days         → "999+ days"
    //   > 365 days (≤999)  → "1+ year runway" / "N+ year runway"
    //   ≤ 365 days         → "N days"
    if (daysRemaining > 999) {
      displayDaysRemaining = "999+ days";
      projectedExhaustionDate = new Date(todayUtc.getTime() + daysRemaining * 86_400_000);
    } else if (daysRemaining > 365) {
      const years = daysRemaining / 365;
      displayDaysRemaining =
        years >= 1.95 ? `${Math.round(years)}+ year runway` : "1+ year runway";
      projectedExhaustionDate = new Date(todayUtc.getTime() + daysRemaining * 86_400_000);
    } else {
      displayDaysRemaining = `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
      projectedExhaustionDate = new Date(todayUtc.getTime() + daysRemaining * 86_400_000);
    }
  }

  const weeklyRate = Math.round(dailyRate * 7);

  return {
    dailyRate: Math.round(dailyRate),
    weeklyRate,
    daysElapsed,
    daysRemaining,
    projectedExhaustionDate,
    isEarlyEstimate,
    disclaimer: isEarlyEstimate
      ? "Early estimate — based on fewer than 4 days of data"
      : null,
    displayRate: `${currency} ${Math.round(dailyRate).toLocaleString()}/day`,
    displayDaysRemaining,
  };
}

/**
 * Derive the earliest non-deleted expense date from an array of rows.
 * Accepts `expense_date` or `expenseDate` fields.
 *
 * @param {Array<{expense_date?: unknown, expenseDate?: unknown, created_at?: unknown, createdAt?: unknown, deleted_at?: unknown, deletedAt?: unknown}>} expenses
 * @returns {Date | null}
 */
export function findFirstExpenseDate(expenses) {
  if (!Array.isArray(expenses) || expenses.length === 0) return null;
  let earliest = null;
  for (const e of expenses) {
    if (!isNonDeleted(e)) continue;
    const raw =
      e.expense_date ?? e.expenseDate ?? e.created_at ?? e.createdAt ?? null;
    const d = toUTCMidnight(raw);
    if (!d) continue;
    if (!earliest || d.getTime() < earliest.getTime()) earliest = d;
  }
  return earliest;
}

// ─── Materials / inventory ────────────────────────────────────────────────

/**
 * Value of a single inventory row (quantity × unit_cost) — null-safe.
 * Rounded to 2 decimals to avoid float drift in currency totals.
 *
 * @param {unknown} quantity
 * @param {unknown} unitCost
 * @returns {number}
 */
export function calcMaterialValue(quantity, unitCost) {
  const q = Math.max(0, safeNum(quantity));
  const c = Math.max(0, safeNum(unitCost));
  return Math.round(q * c * 100) / 100;
}

/**
 * Sum current inventory value across all materials. Never crashes on null
 * unit_cost or negative quantities.
 *
 * @param {Array<{quantity?: unknown, unit_cost?: unknown, unitCost?: unknown}>} materials
 * @returns {number}
 */
export function calcInventoryTotal(materials) {
  if (!Array.isArray(materials)) return 0;
  let cents = 0;
  for (const m of materials) {
    const q = Math.max(0, safeNum(m?.quantity));
    const c = Math.max(0, safeNum(m?.unit_cost ?? m?.unitCost));
    cents += Math.round(q * c * 100);
  }
  return cents / 100;
}

// ─── Category totals ──────────────────────────────────────────────────────

/**
 * Normalise a category string for grouping:
 *   "  Labour "      → "Labour"
 *   "MATERIALS"      → "Materials"
 *   "cement"         → "Cement"
 *   null / ""        → "Uncategorized"
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCategory(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "Uncategorized";
  const lower = trimmed.toLowerCase();
  if (lower === "other" || lower === "uncategorized" || lower === "general") {
    return "Uncategorized";
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * @typedef CategoryTotal
 * @property {string} name
 * @property {number} amount
 * @property {number} count
 * @property {number} percent
 */

/**
 * Group non-deleted expenses by normalized category. Float precision is
 * protected by integer-cents accumulation (avoids 0.1 + 0.2 = 0.3000…04).
 *
 * @param {Array<{amount?: unknown, category?: unknown, deleted_at?: unknown, deletedAt?: unknown}>} expenses
 * @returns {CategoryTotal[]}
 */
export function sumByCategory(expenses) {
  if (!Array.isArray(expenses)) return [];
  /** @type {Record<string, {cents: number, count: number}>} */
  const buckets = {};
  let grandCents = 0;
  for (const e of expenses) {
    if (!isNonDeleted(e)) continue;
    const amtCents = Math.round(Math.max(0, safeNum(e?.amount)) * 100);
    if (amtCents <= 0) continue;
    const cat = normalizeCategory(e?.category);
    if (!buckets[cat]) buckets[cat] = { cents: 0, count: 0 };
    buckets[cat].cents += amtCents;
    buckets[cat].count += 1;
    grandCents += amtCents;
  }
  return Object.entries(buckets)
    .map(([name, v]) => ({
      name,
      amount: v.cents / 100,
      count: v.count,
      percent:
        grandCents > 0
          ? Math.round((v.cents / grandCents) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Sum total spent across non-deleted expenses. Uses integer cents to avoid
 * float drift.
 *
 * @param {Array<{amount?: unknown, deleted_at?: unknown, deletedAt?: unknown}>} expenses
 * @returns {number}
 */
export function sumExpenses(expenses) {
  if (!Array.isArray(expenses)) return 0;
  let cents = 0;
  for (const e of expenses) {
    if (!isNonDeleted(e)) continue;
    cents += Math.round(Math.max(0, safeNum(e?.amount)) * 100);
  }
  return cents / 100;
}

// ─── Chart gap filling ────────────────────────────────────────────────────

/**
 * Pad a date-keyed series with 0-value entries for any missing day. Ensures
 * time-series charts draw a continuous line instead of skipping gaps.
 *
 * @param {Array<{date: string, amount?: number, value?: number, [k: string]: unknown}>} data
 * @param {Date | string} startDate
 * @param {Date | string} endDate
 * @param {string} [valueKey='amount']
 * @returns {Array<{date: string, [k: string]: unknown}>}
 */
export function fillDateGaps(data, startDate, endDate, valueKey = "amount") {
  const start = toUTCMidnight(startDate);
  const end = toUTCMidnight(endDate);
  if (!start || !end || start.getTime() > end.getTime()) return data ?? [];
  const existing = new Map();
  for (const row of data ?? []) {
    if (row && row.date) existing.set(String(row.date), row);
  }
  const out = [];
  const cur = new Date(start.getTime());
  while (cur.getTime() <= end.getTime()) {
    const key = dateKey(cur);
    const row = existing.get(key);
    if (row) out.push(row);
    else out.push({ date: key, [valueKey]: 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

// ─── Transaction type (materials purchase vs usage) ───────────────────────

/**
 * Decide whether a material log is a purchase or a usage. Guards against
 * the historic "for " bug (commit #38065ae) where innocuous messages like
 * "bought cement for the slab" were misclassified as usage.
 *
 * Precedence:
 *   1. Explicit AI action verb (bought/used/delivered/consumed…)
 *   2. Verbs in the raw message (same whitelist, not "for")
 *   3. Default to "purchase" — safer than deducting stock.
 *
 * @param {string | null | undefined} aiAction
 * @param {string | null | undefined} rawMessage
 * @returns {'purchase' | 'usage'}
 */
export function resolveTransactionType(aiAction, rawMessage) {
  const PURCHASE = [
    "bought", "purchased", "received", "delivered",
    "got", "procured", "bring", "brought", "supplied",
  ];
  const USAGE = [
    "used", "consumed", "applied", "utilized",
    "utilised", "deployed", "spent", "poured",
  ];
  const action = String(aiAction ?? "").toLowerCase().trim();
  if (PURCHASE.some((w) => action.includes(w))) return "purchase";
  if (USAGE.some((w) => action.includes(w))) return "usage";

  const msg = String(rawMessage ?? "").toLowerCase();
  if (USAGE.some((w) => new RegExp(`\\b${w}\\b`).test(msg))) return "usage";
  if (PURCHASE.some((w) => new RegExp(`\\b${w}\\b`).test(msg))) return "purchase";

  return "purchase";
}

// ─── Runout date for a single material ────────────────────────────────────

/**
 * When will this material run out at the current usage rate?
 *
 * @param {number | string | null | undefined} quantity
 * @param {number | string | null | undefined} usageRatePerDay
 * @param {Date} [today]
 * @returns {{ days: number, date: Date | null, display: string }}
 */
export function calcRunoutDate(quantity, usageRatePerDay, today) {
  const q = Math.max(0, safeNum(quantity));
  const r = Math.max(0, safeNum(usageRatePerDay));
  const now = toUTCMidnight(today ?? new Date()) ?? new Date();
  if (q <= 0) {
    return { days: 0, date: now, display: "Out of stock" };
  }
  if (r <= 0) {
    return { days: Infinity, date: null, display: "∞" };
  }
  const days = Math.max(0, Math.floor(q / r));
  if (days > 999) {
    return { days, date: null, display: "999+ days" };
  }
  const date = new Date(now.getTime() + days * 86_400_000);
  return { days, date, display: `${days} day${days === 1 ? "" : "s"}` };
}
