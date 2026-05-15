/**
 * AES-256-GCM field encryption for sensitive values at rest.
 * Set ENCRYPTION_KEY to a 32-byte hex string (64 hex chars).
 */

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

export function isEncryptionEnabled() {
  return Boolean(getKey());
}

/**
 * @param {string} plaintext
 * @returns {string|null} base64 payload or null if encryption disabled
 */
export function encryptField(plaintext) {
  const key = getKey();
  if (!key || plaintext == null) return plaintext ?? null;

  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * @param {string} encoded base64
 * @returns {string|null}
 */
export function decryptField(encoded) {
  const key = getKey();
  if (!key || encoded == null) return encoded ?? null;

  try {
    const buf = Buffer.from(encoded, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + 16);
    const data = buf.subarray(IV_LEN + 16);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
