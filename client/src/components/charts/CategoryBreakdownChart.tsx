"use client";

import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/analytics";
import type { CategoryTotal } from "@/lib/analytics";

export interface CategoryBreakdownChartProps {
  data: CategoryTotal[];
  currency?: string;
  height?: number;
  className?: string;
}

const COLORS = ["#E07B39", "#C9A84C", "#5B8FD9", "#4CAF7D", "#9B4B2E", "#D95F5F"];

export function CategoryBreakdownChart({
  data,
  currency = "UGX",
  height = 220,
  className,
}: CategoryBreakdownChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        No categorized spending yet
      </div>
    );
  }

  const top = data.slice(0, 6);

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 items-center", className)}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={top}
              dataKey="amount"
              nameKey="name"
              innerRadius="55%"
              outerRadius="90%"
              paddingAngle={2}
              strokeWidth={2}
              stroke="hsl(var(--card))"
              isAnimationActive
              animationDuration={500}
            >
              {top.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                formatCurrency(value, currency, { compact: false }),
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm">
        {top.map((row, i) => (
          <li key={row.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: COLORS[i % COLORS.length] }}
                aria-hidden
              />
              <span className="truncate">{row.name}</span>
            </span>
            <span className="font-mono tabular-nums text-xs text-muted-foreground shrink-0">
              {formatCurrency(row.amount, currency, { compact: true })}
              <span className="ml-1 text-[10px] opacity-70">({row.percent}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CategoryBreakdownChart;
