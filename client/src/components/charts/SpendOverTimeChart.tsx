"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCompactNumber } from "@/lib/analytics";
import { useChartHeight, useIsMobile } from "@/hooks/useChartHeight";

export interface SpendPoint {
  date: string;
  value: number;
  cumulative?: number;
}

export interface SpendOverTimeChartProps {
  data: SpendPoint[];
  currency?: string;
  height?: number;
  showCumulative?: boolean;
  budget?: number;
  className?: string;
}

export function SpendOverTimeChart({
  data,
  currency = "UGX",
  height,
  showCumulative = true,
  budget,
  className,
}: SpendOverTimeChartProps) {
  const responsiveHeight = useChartHeight({ base: 200, md: 260, lg: 320 });
  const isMobile = useIsMobile();
  const chartHeight = height ?? responsiveHeight;

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-muted-foreground",
          className,
        )}
        style={{ height: chartHeight }}
      >
        No spending data yet
      </div>
    );
  }

  return (
    <div
      className={cn("w-full min-w-0 overflow-hidden", className)}
      style={{ width: "100%", height: chartHeight }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E07B39" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#E07B39" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#C9A84C" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="hsl(var(--border))"
            vertical={false}
            opacity={0.4}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
            fontSize={isMobile ? 10 : 11}
            interval={isMobile ? "preserveStartEnd" : 0}
            minTickGap={isMobile ? 24 : 12}
            tickFormatter={(v: string) => {
              const d = new Date(v);
              if (Number.isNaN(d.getTime())) return v;
              return `${d.getDate()}/${d.getMonth() + 1}`;
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
            fontSize={isMobile ? 10 : 11}
            tickFormatter={(n: number) => formatCompactNumber(n, 1)}
            width={isMobile ? 32 : 44}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 10,
              padding: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 11, marginBottom: 4 }}
            formatter={(value: number, name: string) => [
              formatCurrency(value, currency, { compact: false }),
              name === "value" ? "Daily" : "Cumulative",
            ]}
            cursor={{ stroke: "#E07B39", strokeWidth: 1, strokeDasharray: "3 3" }}
          />
          {budget && budget > 0 && (
            <ReferenceLine
              y={budget}
              stroke="#D95F5F"
              strokeDasharray="4 4"
              label={{
                value: `Budget ${formatCurrency(budget, currency, { compact: true })}`,
                fill: "#D95F5F",
                fontSize: 10,
                position: "insideTopRight",
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke="#E07B39"
            strokeWidth={2}
            fill="url(#spendFill)"
            activeDot={{ r: 4, stroke: "#0D0F0E", strokeWidth: 2 }}
            isAnimationActive
            animationDuration={600}
          />
          {showCumulative && (
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#C9A84C"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="url(#cumFill)"
              isAnimationActive
              animationDuration={800}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SpendOverTimeChart;
