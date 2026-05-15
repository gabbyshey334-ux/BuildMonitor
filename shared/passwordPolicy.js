/**
 * Password policy aligned with Supabase Auth email provider settings:
 * - Minimum 8 characters
 * - Lowercase, uppercase, digit, and symbol required
 */

export const PASSWORD_MIN_LENGTH = 8;

/** @typedef {{ length: boolean; lowercase: boolean; uppercase: boolean; digit: boolean; symbol: boolean }} PasswordChecks */

/**
 * @param {string} password
 * @returns {PasswordChecks}
 */
export function getPasswordChecks(password) {
  const pw = typeof password === "string" ? password : "";
  return {
    length: pw.length >= PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(pw),
    uppercase: /[A-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

/**
 * @param {string} password
 * @returns {boolean}
 */
export function isPasswordValid(password) {
  const checks = getPasswordChecks(password);
  return Object.values(checks).every(Boolean);
}

/**
 * @param {string[]} items
 * @returns {string}
 */
function formatRequirementList(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * @param {string} password
 * @returns {{ valid: boolean; message?: string; checks: PasswordChecks }}
 */
export function validatePassword(password) {
  const checks = getPasswordChecks(password);

  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password is required.", checks };
  }

  if (!checks.length) {
    return {
      valid: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      checks,
    };
  }

  const missing = [];
  if (!checks.lowercase) missing.push("a lowercase letter");
  if (!checks.uppercase) missing.push("an uppercase letter");
  if (!checks.digit) missing.push("a number");
  if (!checks.symbol) missing.push("a symbol");

  if (missing.length > 0) {
    return {
      valid: false,
      message: `Password must include ${formatRequirementList(missing)}.`,
      checks,
    };
  }

  return { valid: true, checks };
}

/**
 * Strength meter for UI (0–4 segments).
 * @param {string} password
 * @returns {{ score: number; labelKey: string; color: string }}
 */
export function getPasswordStrength(password) {
  if (!password) return { score: 0, labelKey: "", color: "" };

  const checks = getPasswordChecks(password);
  const met = Object.values(checks).filter(Boolean).length;

  if (met <= 2) return { score: 1, labelKey: "auth.register.strength.weak", color: "#DC2626" };
  if (met === 3) return { score: 2, labelKey: "auth.register.strength.fair", color: "#F59E0B" };
  if (met === 4) return { score: 3, labelKey: "auth.register.strength.good", color: "#EAB308" };
  return { score: 4, labelKey: "auth.register.strength.strong", color: "#1E7A3E" };
}
