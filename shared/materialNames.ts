/**
 * Canonical material names for matching: lowercase, spaces collapsed, light singularization
 * so "cements"/"cement", "bricks"/"brick" map to one inventory key.
 *
 * Must stay identical to the logic duplicated in `api/index.js` and `api/_whatsapp-webhook.ts`
 * (Vercel `api/index.js` cannot import this TS module at runtime).
 */

// Words that must never be singularized (would produce wrong stems)
const MATERIAL_TOKEN_KEEP = new Set([
  'glass',
  'grass',
  'brass',
  'gas',
  'canvas',
  'status',
  'access',
  'rebar',
  'hardcore',
  'murram',
  'gravel',
  'ballast',
  'aggregate',
  'cement',
]);

function singularizeMaterialToken(w: string): string {
  if (w.length < 2) return w;
  if (MATERIAL_TOKEN_KEEP.has(w)) return w;
  if (w.endsWith("'s")) return w.slice(0, -2);
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('s') && !w.endsWith('ss') && w.length >= 4) {
    const stem = w.slice(0, -1);
    if (stem.length >= 3) return stem;
  }
  return w;
}

/** Stored in DB as materials_inventory.name (WhatsApp + dashboard). */
export function normalizeMaterialStorageName(raw: string): string {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!s) return '';
  return s.split(/\s+/).map(singularizeMaterialToken).join(' ');
}

/** Group key for UI aggregation (same as storage normalization + unit). */
export function materialGroupKey(name: string, unit: string): string {
  return `${normalizeMaterialStorageName(name)}|${(unit || 'units').trim().toLowerCase()}`;
}

/** Title-style label from a normalized storage name. */
export function formatMaterialDisplayName(normalized: string): string {
  if (!normalized) return '';
  return normalized
    .split(/\s+/)
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}
