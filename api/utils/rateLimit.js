/**
 * In-memory rate limiting for serverless (per-instance).
 * For distributed limits, use Vercel KV or Upstash Redis.
 */

const buckets = new Map();

function prune() {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';
  return ip;
}

/**
 * @param {{ windowMs?: number, max?: number, keyPrefix?: string }} opts
 */
export function rateLimit(opts = {}) {
  const windowMs = opts.windowMs ?? 15 * 60 * 1000;
  const max = opts.max ?? 100;
  const keyPrefix = opts.keyPrefix ?? 'api';

  return (req, res, next) => {
    if (Math.random() < 0.01) prune();

    const key = `${keyPrefix}:${clientKey(req)}:${req.path}`;
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
    }

    next();
  };
}

/** Stricter limits for auth endpoints */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: 'auth',
});

/** General API limit */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyPrefix: 'api',
});
