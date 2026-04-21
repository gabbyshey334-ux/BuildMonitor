"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * JengaTrack status pill. Used for category labels, stock levels, sources
 * (WhatsApp vs Dashboard), schedule states, etc.
 */
export type StatusTone =
  | "neutral"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "whatsapp";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral:
    "bg-muted text-muted-foreground border-border",
  primary:
    "bg-jenga-primary/12 text-jenga-primary border-jenga-primary/25",
  secondary:
    "bg-jenga-secondary/14 text-jenga-secondary border-jenga-secondary/25",
  success:
    "bg-jenga-success/14 text-jenga-success border-jenga-success/25",
  warning:
    "bg-jenga-warning/14 text-jenga-warning border-jenga-warning/30",
  danger:
    "bg-jenga-danger/14 text-jenga-danger border-jenga-danger/30",
  info:
    "bg-jenga-info/14 text-jenga-info border-jenga-info/25",
  whatsapp:
    "bg-[#25D366]/14 text-[#25D366] border-[#25D366]/30",
};

export interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: StatusTone;
  icon?: LucideIcon;
  size?: "xs" | "sm" | "md";
  className?: string;
  pulse?: boolean;
  dot?: boolean;
}

export function StatusBadge({
  children,
  tone = "neutral",
  icon: Icon,
  size = "sm",
  className,
  pulse = false,
  dot = false,
}: StatusBadgeProps) {
  const sizing =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : size === "md"
      ? "text-xs px-3 py-1 gap-1.5"
      : "text-[11px] px-2.5 py-0.5 gap-1";
  const iconSize = size === "md" ? 14 : 12;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-wider whitespace-nowrap",
        TONE_CLASSES[tone],
        sizing,
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "inline-block rounded-full bg-current",
            size === "xs" ? "h-1.5 w-1.5" : "h-2 w-2",
            pulse && "animate-pulse",
          )}
        />
      )}
      {Icon && <Icon size={iconSize} className="shrink-0" />}
      <span className="truncate max-w-[180px]">{children}</span>
    </span>
  );
}

export default StatusBadge;
