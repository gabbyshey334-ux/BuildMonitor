/**
 * JengaTrack — Shared display formatters.
 *
 * One source of truth for turning numbers and dates into strings. Used by:
 *   • Frontend React components
 *   • Backend API responses
 *   • WhatsApp bot replies (Twilio, daily heartbeat)
 *
 * Every formatter:
 *   • Accepts `unknown` and coerces safely (no crashes on null/NaN).
 *   • Accepts a `currency` arg — never hardcodes UGX.
 *   • Always includes the year in date strings to avoid year ambiguity.
 */

import { safeNum, toUTCMidnight } from "./calculations.js";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Currency ─────────────────────────────────────────────────────────────

/**
 * Format a money amount with a dynamic currency code. NEVER hardcode UGX.
 *
 * Examples:
 *   formatCurrency(1234567, "UGX")             → "UGX 1,234,567"
 *   formatCurrency(1234567, "UGX", {compact:true})→ "UGX 1.2M"
 *   formatCurrency(null,    "KES")             → "KES 0"
 *   formatCurrency(-500,    "USD")             → "USD -500"
 *
 * @param {unknown} amount
 * @param {string} [currency="UGX"]  Project currency code (UGX, KES, USD…)
 * @param {{ compact?: boolean, decimals?: number, signed?: boolean }} [options]
 * @returns {string}
 */
export function formatCurrency(amount, currency = "UGX", options = {}) {
  const n = safeNum(amount);
  const { compact = false, decimals = 0, signed = false } = options;
  const code = String(currency || "UGX").toUpperCase();
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";

  if (compact) {
    if (abs >= 1_000_000_000)
      return `${code} ${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000)
      return `${code} ${sign}${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000)
      return `${code} ${sign}${(abs / 1_000).toFixed(0)}K`;
  }

  return `${code} ${sign}${abs.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Compact numeric formatter without currency prefix. Useful for KPI cards.
 * @param {unknown} value
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatCompact(value, decimals = 1) {
  const n = safeNum(value);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(decimals)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${Math.round(n)}`;
}

/**
 * Format a number with locale grouping.
 * @param {unknown} value
 * @param {number} [decimals=0]
 * @returns {string}
 */
export function formatNumber(value, decimals = 0) {
  const n = safeNum(value);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a percentage value. Input is the raw percent number (e.g. 67.8, not 0.678).
 * Always 1 decimal by default (no 68% when the truth is 67.8%).
 *
 * @param {unknown} value
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatPercent(value, decimals = 1) {
  const n = safeNum(value);
  return `${n.toFixed(decimals)}%`;
}

// ─── Dates ────────────────────────────────────────────────────────────────

/**
 * Human-readable date with year. "14 Aug 2025".
 *
 * @param {Date | string | number | null | undefined} value
 * @param {{ full?: boolean }} [options]  full=true → "14 August 2025"
 * @returns {string}
 */
export function formatDate(value, options = {}) {
  const d = toUTCMidnight(value);
  if (!d) return "—";
  const day = d.getUTCDate();
  const monthIdx = d.getUTCMonth();
  const year = d.getUTCFullYear();
  const month = options.full
    ? MONTH_FULL[monthIdx]
    : MONTH_SHORT[monthIdx];
  return `${day} ${month} ${year}`;
}

/**
 * Relative date — "2 days ago" / "in 3 days" / "today".
 * @param {Date | string | number | null | undefined} value
 * @param {Date} [now]
 * @returns {string}
 */
export function formatRelativeDate(value, now) {
  const d = toUTCMidnight(value);
  if (!d) return "—";
  const today = toUTCMidnight(now ?? new Date()) ?? new Date();
  const diffDays = Math.round(
    (d.getTime() - today.getTime()) / 86_400_000,
  );
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  if (diffDays < 0 && diffDays >= -6) return `${-diffDays} days ago`;
  if (diffDays > 0 && diffDays <= 6) return `in ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -29) {
    const w = Math.round(-diffDays / 7);
    return `${w} week${w === 1 ? "" : "s"} ago`;
  }
  if (diffDays > 0 && diffDays <= 29) {
    const w = Math.round(diffDays / 7);
    return `in ${w} week${w === 1 ? "" : "s"}`;
  }
  return formatDate(d);
}

/**
 * Format a projection / runout date for consumption by UI and bot replies.
 * Always includes the year per spec.
 *
 * @param {Date | string | null | undefined} value
 * @returns {string}
 */
export function formatProjectionDate(value) {
  const d = toUTCMidnight(value);
  if (!d) return "—";
  return formatDate(d);
}

/**
 * Human-friendly days-remaining string. Never shows "Infinity" or "NaN".
 *
 * @param {number} days
 * @returns {string}
 */
export function formatDaysRemaining(days) {
  if (!Number.isFinite(days)) return "∞";
  const n = Math.max(0, Math.floor(days));
  if (n === 0) return "Budget exhausted";
  if (n > 999) return "999+ days";
  return `${n} day${n === 1 ? "" : "s"}`;
}

/**
 * Format an ISO date string for input/display. Same as formatDate but
 * accepts the common "YYYY-MM-DD" short form.
 *
 * @param {string | null | undefined} iso
 * @returns {string}
 */
export function formatISODate(iso) {
  if (!iso) return "—";
  return formatDate(iso);
}
