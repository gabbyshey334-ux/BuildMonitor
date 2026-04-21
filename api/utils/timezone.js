/**
 * Timezone-safe "today" helpers.
 *
 * Vercel serverless runs in UTC. JengaTrack is built for construction sites
 * in Uganda (Africa/Kampala, UTC+3, no DST). Previously the webhook and
 * daily heartbeat used `new Date().toISOString().split('T')[0]`, which gives
 * the UTC calendar day. After ~21:00 local that UTC day has already rolled
 * over, so expenses logged in the evening landed on "tomorrow" in the DB,
 * and the morning heartbeat showed the wrong day's figures.
 *
 * Fix: compute the YYYY-MM-DD in Africa/Kampala using Intl. This is the only
 * correct way without pulling in a timezone library — Intl handles DST and
 * offsets uniformly.
 */

const PROJECT_TZ = process.env.APP_TIMEZONE || 'Africa/Kampala';

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: PROJECT_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Today's date as YYYY-MM-DD in the project's timezone.
 * Example (Uganda, 22:30 local on 2026-04-21):
 *   new Date().toISOString().split('T')[0] → "2026-04-22"   ← wrong
 *   todayInAppTz()                          → "2026-04-21"  ← correct
 *
 * @returns {string} YYYY-MM-DD
 */
export function todayInAppTz() {
  // en-CA returns ISO-like YYYY-MM-DD which is exactly what Postgres expects
  // for a DATE column.
  return dateFmt.format(new Date());
}

/**
 * Date in YYYY-MM-DD for a specific instant, in the project's timezone.
 * Use when you have a Date object (e.g. a Twilio message timestamp) and you
 * need the business day for the user — not the UTC day.
 *
 * @param {Date | number | string} value
 * @returns {string} YYYY-MM-DD
 */
export function dateInAppTz(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return todayInAppTz();
  return dateFmt.format(d);
}

/**
 * Current local time in the project's timezone as "HH:mm" (24h).
 * Used for `daily_logs.log_time` and similar columns that want the site
 * manager's wall-clock time, not UTC.
 *
 * @returns {string} HH:mm
 */
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: PROJECT_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function nowInAppTzHHmm() {
  return timeFmt.format(new Date());
}

export const APP_TIMEZONE = PROJECT_TZ;
