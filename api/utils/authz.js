/**
 * Authorization helpers — lock API actions to the authenticated user's UID.
 */

import { SUPABASE_RECOVERY_MAX_AGE_SEC } from '../../shared/supabaseEmailAuth.js';

const RESET_MAX_AGE_SEC = SUPABASE_RECOVERY_MAX_AGE_SEC;

/**
 * Verify Supabase recovery/access token and enforce max age.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAnon
 * @param {string} token
 */
export async function verifyRecoveryToken(supabaseAnon, token) {
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { ok: false, userId: null, reason: error?.message || 'Invalid or expired reset link' };
  }

  const parts = token.split('.');
  if (parts.length === 3) {
    try {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return { ok: false, userId: null, reason: 'Reset link has expired' };
      }
      if (payload.iat && now - payload.iat > RESET_MAX_AGE_SEC) {
        return { ok: false, userId: null, reason: 'Reset link has expired (30 minute limit)' };
      }
    } catch {
      /* getUser already validated */
    }
  }

  return { ok: true, userId: data.user.id, reason: null };
}

/**
 * Ensure a row's user_id matches the authenticated user or linked profiles.
 */
export function assertUserOwnsRow(rowUserId, authUserId, linkedIds = []) {
  const allowed = new Set([authUserId, ...linkedIds]);
  return allowed.has(rowUserId);
}

export { RESET_MAX_AGE_SEC };
