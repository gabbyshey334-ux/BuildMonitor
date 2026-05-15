/**
 * Twilio webhook HMAC validation for Vercel serverless.
 * Set WEBHOOK_PUBLIC_URL to the exact URL configured in the Twilio console.
 */

import twilio from 'twilio';

/**
 * Public URL Twilio signed (no trailing slash).
 */
export function getWebhookPublicUrl() {
  const url = process.env.WEBHOOK_PUBLIC_URL?.trim();
  if (!url) return null;
  return url.replace(/\/$/, '');
}

/**
 * Normalize webhook POST params for validateRequest.
 * @param {object|string|undefined} rawBody
 */
export function parseTwilioParams(rawBody) {
  if (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)) {
    const params = {};
    for (const [k, v] of Object.entries(rawBody)) {
      if (v === undefined || v === null) continue;
      params[k] = Array.isArray(v) ? String(v[0]) : String(v);
    }
    return params;
  }
  if (typeof rawBody === 'string' && rawBody.length > 0) {
    return Object.fromEntries(new URLSearchParams(rawBody));
  }
  return {};
}

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @param {Record<string, string>} [parsedParams] pre-parsed body
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateTwilioWebhook(req, parsedParams) {
  const skip = process.env.SKIP_TWILIO_SIGNATURE;
  if (skip === '1' || skip === 'true') {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
      console.error('[twilio] SKIP_TWILIO_SIGNATURE is forbidden in production');
      return { ok: false, reason: 'Signature bypass disabled in production' };
    }
    console.warn('[twilio] ⚠️ Signature validation skipped (local dev only)');
    return { ok: true };
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return { ok: false, reason: 'TWILIO_AUTH_TOKEN not configured' };
  }

  const publicUrl = getWebhookPublicUrl();
  if (!publicUrl) {
    return { ok: false, reason: 'WEBHOOK_PUBLIC_URL not configured' };
  }

  const signature =
    req.headers['x-twilio-signature'] ||
    req.headers['X-Twilio-Signature'] ||
    '';

  if (!signature || typeof signature !== 'string') {
    return { ok: false, reason: 'Missing X-Twilio-Signature header' };
  }

  const params = parsedParams ?? parseTwilioParams(req.body);
  const valid = twilio.validateRequest(authToken, signature, publicUrl, params);

  if (!valid) {
    return { ok: false, reason: 'Invalid Twilio signature' };
  }

  return { ok: true };
}
