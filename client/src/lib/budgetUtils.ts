/**
 * Parse budget string from user input (e.g. "30M", "30,000,000", "1.5B")
 */
export function parseBudget(value: string): number {
  if (!value || typeof value !== 'string') return 0;
  const cleaned = value.replace(/,/g, '').replace(/\s/g, '').trim();
  if (!cleaned) return 0;
  const mMatch = cleaned.match(/^(\d+(?:\.\d+)?)[Mm]$/);
  const bMatch = cleaned.match(/^(\d+(?:\.\d+)?)[Bb]$/);
  if (mMatch) return parseFloat(mMatch[1]) * 1_000_000;
  if (bMatch) return parseFloat(bMatch[1]) * 1_000_000_000;
  return parseFloat(cleaned) || 0;
}

/**
 * Format budget number for display (e.g. 30M UGX, 1.5K UGX)
 */
export function formatBudget(budget: string | number): string {
  const num = typeof budget === 'string' ? parseFloat(budget) : budget;
  if (!num || isNaN(num)) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toLocaleString();
}
