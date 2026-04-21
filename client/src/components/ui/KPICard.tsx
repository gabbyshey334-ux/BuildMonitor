"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { CurrencyValue } from "./CurrencyValue";

/**
 * Reusable KPI stat card used across dashboards.
 *
 * Anatomy (per spec):
 *  - Icon top-left (accent color)
 *  - Eyebrow label (uppercase, muted)
 *  - Large value (JetBrains Mono, 32px)
 *  - Sub-label (tertiary)
 *  - Subtle gradient background using accent tone at 4% opacity
 *  - Staggered fade-in-up on mount
 */
export type KPIAccent = "primary" | "secondary" | "success" | "warning" | "danger" | "info";

const ACCENT_MAP: Record<KPIAccent, { fg: string; ring: string; glow: string; blob: string }> = {
  primary: {
    fg: "text-jenga-primary",
    ring: "ring-jenga-primary/20",
    glow: "bg-jenga-primary",
    blob: "from-[#93C54E]/8 via-[#93C54E]/0 to-transparent",
  },
  secondary: {
    fg: "text-jenga-secondary",
    ring: "ring-jenga-secondary/20",
    glow: "bg-jenga-secondary",
    blob: "from-[#218598]/8 via-[#218598]/0 to-transparent",
  },
  success: {
    fg: "text-jenga-success",
    ring: "ring-jenga-success/20",
    glow: "bg-jenga-success",
    blob: "from-[#4CAF7D]/8 via-[#4CAF7D]/0 to-transparent",
  },
  warning: {
    fg: "text-jenga-warning",
    ring: "ring-jenga-warning/20",
    glow: "bg-jenga-warning",
    blob: "from-[#E0A030]/8 via-[#E0A030]/0 to-transparent",
  },
  danger: {
    fg: "text-jenga-danger",
    ring: "ring-jenga-danger/20",
    glow: "bg-jenga-danger",
    blob: "from-[#D95F5F]/8 via-[#D95F5F]/0 to-transparent",
  },
  info: {
    fg: "text-jenga-info",
    ring: "ring-jenga-info/20",
    glow: "bg-jenga-info",
    blob: "from-[#5B8FD9]/8 via-[#5B8FD9]/0 to-transparent",
  },
};

export interface KPICardProps {
  label: string;
  /** Either a primitive or a ReactNode to render. Prefer CurrencyValue when money. */
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  accent?: KPIAccent;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  /** Currency prop — when set, auto-renders value with CurrencyValue */
  asCurrency?: boolean;
  currency?: string;
  compact?: boolean;
  /** Stagger index for framer motion entry animation */
  index?: number;
  className?: string;
  onClick?: () => void;
}

export function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "primary",
  trend,
  asCurrency = false,
  currency,
  compact = true,
  index = 0,
  className,
  onClick,
}: KPICardProps) {
  const tone = ACCENT_MAP[accent];

  const rendered =
    asCurrency && typeof value !== "object"
      ? (
          <CurrencyValue
            value={value as number | string}
            currency={currency}
            compact={compact}
            size="xl"
            className="leading-none"
          />
        )
      : typeof value === "string" || typeof value === "number" ? (
          // Responsive scalar — fits "999+ days" / "43.15B" in 150-190px card on
          // 320-414px viewports. Mobile: 20px → sm: 24px → md: 28-32px.
          <span className="font-mono tabular-nums text-xl sm:text-2xl md:text-[28px] lg:text-[32px] leading-none font-semibold tracking-tight block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
            {value}
          </span>
        ) : (
          value
        );

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        "group relative overflow-hidden rounded-card border border-border bg-card text-left",
        // Tighter padding on mobile to reclaim width for the value.
        "p-3 sm:p-4 md:p-5 lg:p-6 transition-shadow hover:shadow-card-hover",
        "min-w-0 w-full max-w-full",
        onClick ? "cursor-pointer" : "cursor-default",
        className,
      )}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className={cn(
          "absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-[0.18] transition-opacity duration-500 group-hover:opacity-[0.28]",
          tone.glow,
        )}
      />

      <div className="relative flex flex-col h-full min-w-0">
        <div className="flex items-start justify-between gap-2 min-w-0">
          {Icon ? (
            <div
              className={cn(
                "flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg ring-1 bg-muted/40 shrink-0",
                tone.fg,
                tone.ring,
              )}
            >
              <Icon size={16} strokeWidth={2.25} />
            </div>
          ) : (
            <span />
          )}
          {trend && (
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider shrink-0 truncate max-w-[45%]",
                trend.direction === "up" && "text-jenga-success",
                trend.direction === "down" && "text-jenga-danger",
                trend.direction === "flat" && "text-muted-foreground",
              )}
            >
              {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "—"} {trend.label}
            </span>
          )}
        </div>

        <p className="jt-eyebrow mt-3 md:mt-4 truncate min-w-0">{label}</p>
        <div className="mt-1.5 text-foreground min-w-0 max-w-full overflow-hidden">
          {rendered}
        </div>
        {sub && (
          <div className="mt-1.5 text-[11px] md:text-[12px] text-muted-foreground leading-snug min-w-0 break-words">
            {sub}
          </div>
        )}
      </div>
    </motion.button>
  );
}

export default KPICard;
