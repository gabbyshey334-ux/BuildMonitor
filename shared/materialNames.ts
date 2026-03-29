/**
 * Canonical material names for matching: lowercase, spaces collapsed, light singularization
 * so "cements"/"cement", "bricks"/"brick" map to one inventory key.
 */

const KEEP_AS_IS = new Set([
  "glass",
  "grass",
  "brass",
  "gas",
  "canvas",
  "status",
  "access",
  "rebar",
]);

/** Do not apply generic "...es" → stem (verbs / false positives). */
const KEEP_ES_PLURAL = new Set(["makes", "takes", "bakes", "lakes", "notes"]);

function singularizeToken(w: string): string {
  if (w.length < 2) return w;
  if (KEEP_AS_IS.has(w)) return w;

  if (w.endsWith("'s")) return w.slice(0, -2);

  if (w.endsWith("ies") && w.length > 4) {
    return w.slice(0, -3) + "y";
  }

  if (w.endsWith("es") && w.length >= 5 && !KEEP_ES_PLURAL.has(w)) {
    const base = w.slice(0, -2);
    if (base.length >= 2) {
      return base;
    }
  }

  if (w.endsWith("s") && !w.endsWith("ss") && w.length >= 4) {
    const stem = w.slice(0, -1);
    if (stem.length >= 3 && !stem.endsWith("s")) {
      return stem;
    }
  }

  return w;
}

/** Stored in DB as materials_inventory.name (WhatsApp + dashboard). */
export function normalizeMaterialStorageName(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return "";
  return s.split(/\s+/).map(singularizeToken).join(" ");
}

/** Group key for UI aggregation (same as storage normalization + unit). */
export function materialGroupKey(name: string, unit: string): string {
  return `${normalizeMaterialStorageName(name)}|${(unit || "units").trim().toLowerCase()}`;
}

/** Title-style label from a normalized storage name. */
export function formatMaterialDisplayName(normalized: string): string {
  if (!normalized) return "";
  return normalized
    .split(/\s+/)
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
