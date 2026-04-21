"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CurrencyValue } from "./CurrencyValue";
import type { BudgetHealth } from "@/lib/analytics";

/**
 * Animated donut budget ring. Color transitions green → amber → red as
 * percentage grows. Ring fills on mount via pathLength animation.
 */
export interface BudgetRingProps {
  health: BudgetHealth;
  currency?: string;
  size?: number;
  thickness?: number;
  label?: string;
  className?: string;
  showAmount?: boolean;
}

const STATUS_COLOR: Record<BudgetHealth["status"], string> = {
  healthy: "#4CAF7D",
  warning: "#E0A030",
  danger: "#D95F5F",
  critical: "#D95F5F",
};

export function BudgetRing({
  health,
  currency,
  size = 260,
  thickness = 14,
  label,
  className,
  showAmount = true,
}: BudgetRingProps) {
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = health.displayPercent / 100;
  const color = STATUS_COLOR[health.status];
  const overBudget = health.overBudget;

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={`Budget used: ${health.rawPercent}%`}
      >
        <defs>
          <linearGradient id="jt-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity={0.75} />
          </linearGradient>
        </defs>
        {/* track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="hsl(var(--border))"
          strokeWidth={thickness}
          fill="none"
          opacity={0.55}
        />
        {/* value arc */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#jt-ring-gradient)"
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: circumference * (1 - pct),
            stroke: color,
          }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 10px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label && (
          <span className="jt-eyebrow mb-1">{label}</span>
        )}
        {showAmount ? (
          <>
            <CurrencyValue
              value={health.spent}
              currency={currency}
              compact
              size="lg"
              className="font-semibold"
            />
            <span className="mt-1 text-xs text-muted-foreground">
              of{" "}
              <CurrencyValue
                value={health.total}
                currency={currency}
                compact
                size="xs"
                tone="muted"
              />
            </span>
          </>
        ) : null}
        <div
          className={cn(
            "mt-2 font-mono tabular-nums text-xs font-semibold uppercase tracking-wider",
            health.status === "critical" && "text-jenga-danger",
            health.status === "danger" && "text-jenga-primary",
            health.status === "warning" && "text-jenga-warning",
            health.status === "healthy" && "text-jenga-success",
          )}
        >
          {overBudget ? "OVER BUDGET — " : ""}
          {health.rawPercent.toFixed(1)}% used
        </div>
      </div>
    </div>
  );
}

export default BudgetRing;
