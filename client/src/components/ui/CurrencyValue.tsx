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

const SIZE_MAP = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl md:text-2xl",
  xl: "text-2xl md:text-4xl",
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
        "font-mono tabular-nums whitespace-nowrap",
        SIZE_MAP[size],
        TONE_MAP[tone],
        className,
      )}
      data-numeric="true"
      data-value={safeNum(value)}
      data-currency={currency}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export default CurrencyValue;
