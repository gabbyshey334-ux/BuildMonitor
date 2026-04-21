"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useProject } from "@/contexts/ProjectContext";
import { formatCompactNumber, formatCurrency, safeNum } from "@/lib/analytics";

/**
 * Displays a monetary value in JetBrains Mono with the project's currency.
 * NEVER hardcodes a currency — always reads from ProjectContext.
 */
export interface CurrencyValueProps {
  value: unknown;
  currency?: string;
  compact?: boolean;
  decimals?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  tone?: "default" | "success" | "warning" | "danger" | "muted" | "accent";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** When true, render only the number without the currency code. */
  numericOnly?: boolean;
}

// Responsive sizes — mobile values must fit inside a ~115-150px-wide KPI
// card at 320-375px viewports. "UGX 43.15B" is 10 mono glyphs wide so we
// cap `xl` at text-base (16px) on xs and only scale up from sm+.
const SIZE_MAP = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-base xs:text-lg sm:text-xl md:text-2xl",
  xl: "text-base xs:text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl",
} as const;

const TONE_MAP = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  success: "text-jenga-success",
  warning: "text-jenga-warning",
  danger: "text-jenga-danger",
  accent: "text-jenga-primary",
} as const;

export function CurrencyValue({
  value,
  currency: currencyProp,
  compact = false,
  decimals = 0,
  className,
  prefix,
  suffix,
  tone = "default",
  size = "md",
  numericOnly = false,
}: CurrencyValueProps) {
  const { currentProject } = useProject();
  const currency =
    currencyProp ||
    (currentProject as { currency?: string } | null)?.currency ||
    "UGX";

  const formatted = numericOnly
    ? compact
      ? formatCompactNumber(safeNum(value), 1)
      : safeNum(value).toLocaleString(undefined, { maximumFractionDigits: decimals })
    : formatCurrency(value, currency, { compact, decimals });

  return (
    <span
      className={cn(
        "font-mono tabular-nums whitespace-nowrap inline-block max-w-full overflow-hidden text-ellipsis leading-tight",
        SIZE_MAP[size],
        TONE_MAP[tone],
        className,
      )}
      data-numeric="true"
      data-value={safeNum(value)}
      data-currency={currency}
      title={`${currency} ${safeNum(value).toLocaleString()}`}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export default CurrencyValue;
