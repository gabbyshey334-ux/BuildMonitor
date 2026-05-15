/**
 * Supabase Auth → Email provider settings (Dashboard).
 * Keep in sync when you change Authentication → Providers → Email.
 */

/** Email / recovery OTP length (digits) */
export const SUPABASE_EMAIL_OTP_LENGTH = 8;

/** Email OTP / recovery link expiry in seconds (30 minutes) */
export const SUPABASE_EMAIL_OTP_EXPIRY_SEC = 1800;

/** App-enforced max age for password-reset tokens (matches OTP expiry) */
export const SUPABASE_RECOVERY_MAX_AGE_SEC = SUPABASE_EMAIL_OTP_EXPIRY_SEC;
