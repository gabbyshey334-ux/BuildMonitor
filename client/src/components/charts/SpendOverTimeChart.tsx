"use client";

/**
 * SpendOverTimeChart
 * ──────────────────
 * Rewrite of the dashboard's daily spend visual. The previous implementation
 * had three structural problems that made it unreadable in production:
 *
 *   1. It overlaid a daily area (values in millions) and the running total
 *      (values that grow to hundreds of millions / billions) on a single Y
 *      axis. Once cumulative climbed high, the daily curve visually
 *      flattened to the baseline and you couldn't tell where spend
 *      actually happened.
 *
 *   2. It pinned `interval={0}` on the X axis, so every day in the series
 *      forced a tick. With Kampala-style ledgers (many zero-spend days
 *      punctuated by one big expense), the X axis collapsed into an
 *      illegible "25/12/27/12/28/12…" stripe.
 *
 *   3. It threaded a `budget` reference line through the chart. The
 *      project's budget (e.g. UGX 30B) is usually two orders of magnitude
 *      larger than the biggest single day of spend, so the line either
 *      pushed the real data into a pixel-high band at the bottom or sat
 *      off-screen entirely. Budget belongs on the Budget Health card,
 *      not on a daily-spend trend.
 *
 * The rebuild uses a ComposedChart: bars for daily spend on the left axis,
 * a line (with a soft fill) for cumulative on the right axis, an
 * interactive legend, a 7D/30D/90D/All range selector, a branded tooltip,
 * and a summary strip (Total / Avg per active day / Active days / Peak
 * day) so operators can read the card without squinting.
 */

import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCompactNumber } from "@/lib/analytics";
import { useChartHeight, useIsMobile } from "@/hooks/useChartHeight";
import { Inbox } from "lucide-react";

export interface SpendPoint {
  date: string; // YYYY-MM-DD (local day)
  value: number;
  cumulative?: number;
}

export interface SpendOverTimeChartProps {
  data: SpendPoint[];
  currency?: string;
  height?: number;
  className?: string;
}

type RangeKey = "7" | "30" | "90" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7", label: "7D", days: 7 },
  { key: "30", label: "30D", days: 30 },
  { key: "90", label: "90D", days: 90 },
  { key: "all", label: "All", days: null },
];

// Parse "YYYY-MM-DD" without letting the browser drift it into the previous
// day in negative-offset timezones. Anchoring at 12:00 keeps the Date on
// the correct calendar day everywhere from UTC-12 to UTC+14.
function parseDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTooltipDate(iso: string): string {
  const d = parseDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAxisDate(iso: string): string {
  const d = parseDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function SpendOverTimeChart({
  data,
  currency = "UGX",
  height,
  className,
}: SpendOverTimeChartProps) {
  const responsiveHeight = useChartHeight({ base: 220, md: 280, lg: 320 });
  const isMobile = useIsMobile();
  const chartHeight = height ?? responsiveHeight;

  const [range, setRange] = useState<RangeKey>("30");
  const [showDaily, setShowDaily] = useState(true);
  const [showCumulative, setShowCumulative] = useState(true);

  const sliced = useMemo(() => {
    if (!data || data.length === 0) return [] as SpendPoint[];
    const opt = RANGE_OPTIONS.find((r) => r.key === range) ?? RANGE_OPTIONS[1];
    if (opt.days == null) return data;

    const cutoffMs = Date.now() - opt.days * 86400000;
    const windowed = data.filter((p) => {
      const d = parseDate(p.date);
      return d ? d.getTime() >= cutoffMs : false;
    });

    // If the whole project is older than the selected window, fall back to
    // the last N points so the card isn't a dead empty box. This happens
    // for long-dormant projects being reviewed months later.
    if (windowed.length === 0) {
      return data.slice(-Math.min(opt.days, data.length));
    }
    return windowed;
  }, [data, range]);

  const stats = useMemo(() => {
    const points = sliced;
    const total = points.reduce((s, p) => s + (p.value || 0), 0);
    const activeDays = points.filter((p) => (p.value || 0) > 0).length;
    const avg = activeDays > 0 ? total / activeDays : 0;
    let peak: SpendPoint | null = null;
    for (const p of points) {
      if (!peak || (p.value || 0) > (peak.value || 0)) peak = p;
    }
    if (peak && (peak.value || 0) === 0) peak = null;
    return {
      total,
      avg,
      activeDays,
      windowDays: points.length,
      peak,
    };
  }, [sliced]);

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 text-muted-foreground",
          className,
        )}
        style={{ height: chartHeight }}
      >
        <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center">
          <Inbox className="h-5 w-5" />
        </div>
        <div className="text-sm">No spending data yet</div>
        <div className="text-[11px]">
          Log an expense to see your daily spend trend
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full min-w-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => setShowDaily((v) => !v)}
            aria-pressed={showDaily}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition-colors",
              showDaily
                ? "border-jenga-primary/40 bg-jenga-primary/10 text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="h-2 w-2 rounded-full bg-jenga-primary" />
            Daily
          </button>
          <button
            type="button"
            onClick={() => setShowCumulative((v) => !v)}
            aria-pressed={showCumulative}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition-colors",
              showCumulative
                ? "border-jenga-secondary/40 bg-jenga-secondary/10 text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="h-2 w-2 rounded-full bg-jenga-secondary" />
            Cumulative
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Time range"
          className="inline-flex items-center rounded-btn border border-border bg-jenga-raised/40 p-0.5"
        >
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={range === opt.key}
              onClick={() => setRange(opt.key)}
              className={cn(
                "h-6 px-2 text-[10px] font-semibold uppercase tracking-wider rounded-[6px] transition-colors",
                range === opt.key
                  ? "bg-jenga-primary text-[#0D0F0E]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: "100%", height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={sliced}
            margin={{ top: 8, right: isMobile ? 8 : 16, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="sot-cum-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#218598" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#218598" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="hsl(var(--border))"
              vertical={false}
              opacity={0.35}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              stroke="hsl(var(--muted-foreground))"
              fontSize={isMobile ? 10 : 11}
              interval="preserveStartEnd"
              minTickGap={isMobile ? 36 : 48}
              tickMargin={8}
              tickFormatter={formatAxisDate}
            />
            <YAxis
              yAxisId="daily"
              orientation="left"
              tickLine={false}
              axisLine={false}
              stroke="hsl(var(--muted-foreground))"
              fontSize={isMobile ? 10 : 11}
              tickFormatter={(n: number) => formatCompactNumber(n, 1)}
              width={isMobile ? 48 : 56}
              tickMargin={4}
              hide={!showDaily}
            />
            <YAxis
              yAxisId="cum"
              orientation="right"
              tickLine={false}
              axisLine={false}
              stroke="hsl(var(--muted-foreground))"
              fontSize={isMobile ? 10 : 11}
              tickFormatter={(n: number) => formatCompactNumber(n, 1)}
              width={isMobile ? 44 : 56}
              tickMargin={4}
              hide={!showCumulative}
            />
            <Tooltip
              cursor={{ fill: "rgba(147, 197, 78, 0.06)" }}
              wrapperStyle={{ outline: "none" }}
              content={(ctx) => {
                const { active, payload, label } = ctx as {
                  active?: boolean;
                  payload?: Array<{ payload: SpendPoint }>;
                  label?: string | number;
                };
                if (!active || !payload || payload.length === 0) return null;
                const point = payload[0]?.payload;
                const iso =
                  typeof label === "string"
                    ? label
                    : typeof label === "number"
                      ? String(label)
                      : (point?.date ?? "");
                return (
                  <div className="rounded-card border border-border bg-popover/95 backdrop-blur px-3 py-2 shadow-xl min-w-[200px]">
                    <div className="text-[11px] text-muted-foreground mb-1.5">
                      {formatTooltipDate(iso)}
                    </div>
                    {showDaily && (
                      <div className="flex items-center justify-between gap-4 text-[12px]">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="h-2 w-2 rounded-full bg-jenga-primary" />
                          Daily
                        </span>
                        <span className="font-mono tabular-nums text-foreground">
                          {formatCurrency(point?.value ?? 0, currency, {
                            compact: false,
                          })}
                        </span>
                      </div>
                    )}
                    {showCumulative && typeof point?.cumulative === "number" && (
                      <div className="flex items-center justify-between gap-4 text-[12px] mt-1">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="h-2 w-2 rounded-full bg-jenga-secondary" />
                          Cumulative
                        </span>
                        <span className="font-mono tabular-nums text-foreground">
                          {formatCurrency(point.cumulative, currency, {
                            compact: false,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {showCumulative && (
              <Line
                yAxisId="cum"
                type="monotone"
                dataKey="cumulative"
                stroke="#218598"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#218598",
                  stroke: "#0D0F0E",
                  strokeWidth: 2,
                }}
                isAnimationActive
                animationDuration={500}
              />
            )}
            {showDaily && (
              <Bar
                yAxisId="daily"
                dataKey="value"
                fill="#93C54E"
                radius={[3, 3, 0, 0]}
                maxBarSize={isMobile ? 10 : 18}
                isAnimationActive
                animationDuration={500}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 border-t border-border/50 pt-3">
        <StatCell
          label="Total"
          value={formatCurrency(stats.total, currency, { compact: true })}
        />
        <StatCell
          label="Avg / active day"
          value={formatCurrency(stats.avg, currency, { compact: true })}
        />
        <StatCell
          label="Active days"
          value={`${stats.activeDays} of ${stats.windowDays}`}
        />
        <StatCell
          label="Peak day"
          value={
            stats.peak
              ? formatCurrency(stats.peak.value, currency, { compact: true })
              : "—"
          }
          sub={
            stats.peak
              ? (parseDate(stats.peak.date)?.toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                }) ?? null)
              : null
          }
        />
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 truncate">
        {label}
      </div>
      <div className="font-mono tabular-nums text-sm text-foreground truncate">
        {value}
      </div>
      {sub ? (
        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export default SpendOverTimeChart;
