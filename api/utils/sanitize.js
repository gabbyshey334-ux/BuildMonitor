/**
 * Input sanitization for API request bodies and query params.
 */

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const HTML_TAG = /<[^>]*>/g;

export function stripHtml(value) {
  if (typeof value !== 'string') return value;
  return value.replace(HTML_TAG, '').replace(CONTROL_CHARS, '').trim();
}

export function sanitizeString(value, maxLen = 2000) {
  if (value == null) return value;
  const s = stripHtml(String(value));
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function sanitizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = sanitizeString(value.trim().toLowerCase(), 320);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function sanitizeUuid(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)) {
    return null;
  }
  return v;
}

const SKIP_KEYS = new Set(['password', 'currentPassword', 'newPassword', 'token']);

function sanitizeValue(value, depth) {
  if (depth > 8) return undefined;
  if (value == null) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SKIP_KEYS.has(k)) {
        out[k] = v;
      } else {
        out[k] = sanitizeValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

/** Express middleware — sanitizes req.body (preserves passwords/tokens). */
export function sanitizeBodyMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    req.body = sanitizeValue(req.body, 0);
  }
  if (req.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') req.query[k] = sanitizeString(v, 500);
    }
  }
  next();
}
