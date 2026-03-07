"use client";

import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectExpenses, useProjectMaterials, useProjectTasks } from "@/hooks/useDashboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  RefreshCw,
  AlertTriangle,
  Zap,
  PackageOpen,
  MoreHorizontal,
} from "lucide-react";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const COLORS = {
  teal: "#00bcd4",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
};

const PROJECT_COLORS = [
  "#00bcd4", "#22c55e", "#3b82f6", "#f97316", "#ec4899",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatUgx(value: number): string {
  const num = Number(value) || 0;
  if (num >= 1_000_000_000) {
    const b = num / 1_000_000_000;
    // Always 3 decimal places for billions so 29.998B ≠ 30.000B
    return `UGX ${b.toFixed(3)}B`;
  }
  if (num >= 1_000_000) return `UGX ${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `UGX ${(num / 1_000).toFixed(0)}K`;
  return `UGX ${num.toLocaleString()}`;
}

function pct(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  const raw = (numerator / denominator) * 100;
  if (raw < 1 && raw > 0) return parseFloat(raw.toFixed(4));
  return Math.min(100, parseFloat(raw.toFixed(2)));
}

function yAxisTickFormatter(v: unknown): string {
  const n = parseFloat(String(v));
  if (n >= 1_000_000_000) return `UGX ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `UGX ${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `UGX ${(n / 1_000).toFixed(0)}K`;
  return `UGX ${n}`;
}

function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const min = Math.floor(ms / 60000);
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(ms / 86400000);
  if (min < 60) return `${min}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return d < 30 ? "Last week" : "Detected earlier";
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Materials: [
    "cement", "sand", "stone", "tiles", "brick", "steel", "rod", "iron",
    "timber", "wood", "paint", "wire", "pipe", "block", "material", "receipt",
    "gravel", "aggregate", "rebar", "nails", "screws", "glass", "plaster",
  ],
  Labor: [
    "labor", "labour", "worker", "casual", "wage", "plumber", "electrician",
    "mason", "carpenter", "painter", "driver", "foreman",
  ],
  Equipment: [
    "equipment", "tool", "machine", "rental", "hire", "generator", "pump", "mixer",
  ],
  Logistics: ["transport", "delivery", "fuel", "logistics", "truck"],
};

function categorise(description: string): string {
  const desc = description.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => desc.includes(kw))) return cat;
  }
  return "Other";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function BudgetSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-card border border-border" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 rounded-xl bg-card border border-border" />
        <div className="h-80 rounded-xl bg-card border border-border" />
      </div>
      <div className="h-80 rounded-xl bg-card border border-border" />
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  extraSub,
  valueClassName,
  dotColor,
}: {
  label: string;
  value: string;
  sub?: string;
  extraSub?: React.ReactNode;
  valueClassName?: string;
  dotColor?: string;
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col justify-between min-h-[88px] border border-border bg-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2">
        <div className="flex items-center gap-2">
          {dotColor && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: dotColor }}
            />
          )}
          <p className={`text-lg font-bold leading-tight ${valueClassName ?? "text-foreground"}`}>
            {value}
          </p>
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        {extraSub && <div className="text-[11px] text-muted-foreground mt-1">{extraSub}</div>}
      </div>
    </div>
  );
}

// ─── Budget Comparison ────────────────────────────────────────────────────────
function BudgetComparisonSection({
  categoryTotals,
  totalSpent,
  budget,
  tasks,
  expenses,
}: {
  categoryTotals: Array<{ name: string; amount: number }>;
  totalSpent: number;
  budget: number;
  tasks: Array<{ status?: string }>;
  expenses: any[];
}) {
  const tasksPct = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    const completed = tasks.filter((t) => t.status === "completed").length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  const expenseProxyPct = useMemo(() => {
    if (!expenses || expenses.length === 0) return 0;
    return Math.min(Math.round((expenses.length / 20) * 100), 95);
  }, [expenses]);

  const progressPct = tasksPct ?? expenseProxyPct;

  // budgetUsedPct from real parsed numbers
  const budgetUsedPct =
    budget > 0 ? parseFloat(((totalSpent / budget) * 100).toFixed(6)) : 0;

  const gap = budgetUsedPct - progressPct;
  const footerText =
    gap > 5
      ? `⚠️ Spending is ${gap.toFixed(2)}% ahead of recorded progress`
      : gap < -5
      ? `✅ Progress is ahead of spending by ${Math.abs(gap).toFixed(2)}%`
      : `✅ Spending and progress are aligned`;

  return (
    <div className="rounded-xl p-6 border border-border bg-card h-full">
      {/* No "View All" button */}
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-foreground">Budget Comparison</h3>
      </div>

      <div className="mb-5">
        <p className="text-sm text-muted-foreground mb-2">Progress vs. Expenditure</p>
        <select
          className="text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground"
          defaultValue="desc"
        >
          <option value="desc">Budget (Descending)</option>
          <option value="asc">Budget (Ascending)</option>
        </select>
      </div>

      <div className="space-y-6">
        {/* Project Progress bar */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Project Progress</p>
          <div
            className="rounded-lg overflow-hidden"
            style={{ height: "12px", background: "hsl(var(--muted))" }}
          >
            <div
              style={{
                width: `${Math.max(progressPct, progressPct > 0 ? 1 : 0)}%`,
                height: "100%",
                background: "linear-gradient(90deg, #00bcd4, #0097a7)",
                borderRadius: "6px",
                transition: "width 0.6s ease",
              }}
            />
          </div>
          <div className="text-right text-xs text-muted-foreground mt-1">
            {tasksPct !== null
              ? `${progressPct}%`
              : expenses.length > 0
              ? `~${progressPct}% (estimated from ${expenses.length} expenses)`
              : "0% — no tasks logged yet"}
          </div>
        </div>

        {/* Budget Used bar */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Budget Used</p>
          <div
            className="rounded-lg overflow-hidden"
            style={{ height: "12px", background: "hsl(var(--muted))" }}
          >
            <div
              style={{
                width: `${budgetUsedPct > 0 ? Math.max(budgetUsedPct, 2) : 0}%`,
                height: "100%",
                background:
                  budgetUsedPct > 80
                    ? "linear-gradient(90deg, #ef4444, #dc2626)"
                    : budgetUsedPct > 60
                    ? "linear-gradient(90deg, #f59e0b, #d97706)"
                    : "linear-gradient(90deg, #22c55e, #16a34a)",
                borderRadius: "6px",
                transition: "width 0.6s ease",
              }}
            />
          </div>
          <div className="text-right text-xs text-muted-foreground mt-1">
            {formatUgx(totalSpent)} of {formatUgx(budget)} used
            {budgetUsedPct >= 0.01 && ` (${budgetUsedPct.toFixed(3)}%)`}
          </div>
          {budgetUsedPct < 1 && budgetUsedPct > 0 && (
            <div className="text-[11px] text-muted-foreground mt-1 text-right italic">
              Bar scaled for visibility — actual usage is {budgetUsedPct.toFixed(4)}%
            </div>
          )}
        </div>

        {/* Category legend */}
        {categoryTotals.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {categoryTotals.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }}
                />
                <span className="text-xs text-muted-foreground">{d.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="text-[13px] mt-5 font-medium"
        style={{ color: gap > 5 ? "#f59e0b" : "#00bcd4" }}
      >
        {footerText}
      </div>
    </div>
  );
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
function AlertsSection({
  alerts,
}: {
  alerts: Array<{
    icon: React.ElementType;
    iconColor: string;
    title: string;
    subtitle: string;
    dotColor: string;
    timestamp?: string;
  }>;
}) {
  const overBudgetCount = alerts.filter(
    (a) => a.subtitle === "Budget Overrun" || a.subtitle === "Price Spike"
  ).length;

  return (
    <div className="rounded-xl p-6 border border-border bg-card h-full">
      {/* No "View All" button */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Alerts</h3>
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          Over Budget Items: {overBudgetCount}
        </span>
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No alerts at this time.
          </p>
        ) : (
          alerts.map((a, i) => <AlertRow key={i} {...a} />)
        )}
      </div>
    </div>
  );
}

function AlertRow({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  dotColor,
  timestamp,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle: string;
  dotColor: string;
  timestamp?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="mt-0.5 shrink-0">
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-relaxed">{title}</p>
        <p className="text-xs mt-1" style={{ color: COLORS.teal }}>
          {subtitle}
        </p>
        {timestamp && (
          <p className="text-xs mt-0.5 text-muted-foreground">{timestamp}</p>
        )}
      </div>
      <div
        className="w-2 h-2 rounded-full shrink-0 mt-1"
        style={{ backgroundColor: dotColor }}
      />
    </div>
  );
}

// ─── Cost Trend ───────────────────────────────────────────────────────────────
function CostTrendChart({
  allData,
  period,
  lastWeekSpend,
  lastWeekKey,
}: {
  allData: Array<{ week: string; total: number; date: Date }>;
  period: "1w" | "1m" | "3m" | "all";
  lastWeekSpend: number;
  lastWeekKey?: string;
}) {
  const filteredData = useMemo(() => {
    const now = Date.now();
    const cutoff =
      period === "1w"
        ? now - 7 * 86400000
        : period === "1m"
        ? now - 30 * 86400000
        : period === "3m"
        ? now - 91 * 86400000
        : 0;
    return allData
      .filter((d) => d.date.getTime() >= cutoff)
      .map(({ week, total }) => ({ week, total }));
  }, [allData, period]);

  if (filteredData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        No expense history for this period.
      </div>
    );
  }

  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={filteredData}
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          >
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              domain={[0, "auto"]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={yAxisTickFormatter}
              width={75}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "13px",
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              formatter={(value: number) => [formatUgx(value), "Spent"]}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke={COLORS.teal}
              strokeWidth={2.5}
              dot={{ r: 3, fill: COLORS.teal }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Styled "spent last week" footer */}
      <div
        className="flex items-center gap-3 mt-5 py-3 px-4 rounded-r-lg"
        style={{
          background: "rgba(0, 188, 212, 0.08)",
          borderLeft: "3px solid #00bcd4",
        }}
      >
        <span
          style={{
            color: "#00bcd4",
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "-0.5px",
          }}
        >
          {formatUgx(lastWeekSpend)}
        </span>
        <span className="text-muted-foreground text-sm">
          spent last week{lastWeekKey ? ` · ${lastWeekKey}` : ""}
        </span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BudgetPage() {
  const { t } = useLanguage();
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;

  const projectIdFromUrl =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("project")
      : null;
  const projectId = (projectIdFromUrl || currentProject?.id) ?? null;

  const { data, isLoading, isError, error, refetch } = useProjectExpenses(projectId);
  const { data: materialsData } = useProjectMaterials(projectId);
  const { data: tasksData } = useProjectTasks(projectId);

  const [costTrendPeriod, setCostTrendPeriod] = useState<"1w" | "1m" | "3m" | "all">("1m");

  const tasks = useMemo(() => {
    const raw = (tasksData as any)?.tasks ?? tasksData;
    return Array.isArray(raw) ? raw : [];
  }, [tasksData]);

  const isProjectSwitch = projectId != null && data === undefined && !isError;
  const showLoading = isLoading || isProjectSwitch;

  const expenses: any[] = useMemo(
    () =>
      Array.isArray((data as any)?.expenses)
        ? (data as any).expenses
        : Array.isArray((data as any)?.recent)
        ? (data as any).recent
        : Array.isArray(data)
        ? (data as any[])
        : [],
    [data]
  );

  const materials: any[] = useMemo(
    () =>
      Array.isArray((materialsData as any)?.inventory)
        ? (materialsData as any).inventory
        : Array.isArray(materialsData)
        ? (materialsData as any[])
        : [],
    [materialsData]
  );

  // ── Core financial values ────────────────────────────────────────────────────
  // FIX 1: Always parse budget as plain float — handles string "30000000000"
  const budget = useMemo(() => {
    const raw =
      (currentProject as any)?.budget ??
      (currentProject as any)?.totalBudget ??
      0;
    const parsed = parseFloat(String(raw).replace(/,/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }, [currentProject]);

  // FIX 2: Parse every expense amount as float — avoids string concat bug
  const totalSpent = useMemo(
    () =>
      expenses.reduce(
        (sum, e) =>
          sum + (parseFloat(String(e.amount ?? 0).replace(/,/g, "")) || 0),
        0
      ),
    [expenses]
  );

  // FIX 3: Arithmetic on two Numbers — guaranteed correct
  const balance = budget - totalSpent;

  const percentSpent = useMemo(() => pct(totalSpent, budget), [totalSpent, budget]);
  const overBudget = budget > 0 && totalSpent > budget;

  const recentSpend = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return expenses
      .filter((e) => new Date(e.expense_date || e.created_at).getTime() >= cutoff)
      .reduce((s, e) => s + (parseFloat(String(e.amount || 0)) || 0), 0);
  }, [expenses]);

  const weeklyBurn = recentSpend / 4.3;
  const weeksRemaining =
    weeklyBurn > 0
      ? Math.min(999, Math.max(0, Math.round(balance / weeklyBurn)))
      : null;

  // ── Category totals ──────────────────────────────────────────────────────────
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = categorise(String(e.description || ""));
      totals[cat] = (totals[cat] || 0) + (parseFloat(String(e.amount || 0)) || 0);
    });
    return Object.entries(totals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  // ── Cost trend ───────────────────────────────────────────────────────────────
  // FIX 4: Include the raw Date so CostTrendChart can filter by period correctly
  const costTrendDataRaw = useMemo(() => {
    const weeklyMap: Record<string, { total: number; date: Date }> = {};
    expenses.forEach((e) => {
      const date = new Date(
        (e as any).created_at || (e as any).expense_date || Date.now()
      );
      const week = getWeekNumber(date);
      const monthShort = date.toLocaleString("default", { month: "short" });
      const key = `W${week} ${monthShort}`;
      const amt =
        parseFloat(String((e as any).amount ?? 0).replace(/,/g, "")) || 0;
      if (!weeklyMap[key]) weeklyMap[key] = { total: 0, date };
      weeklyMap[key].total += amt;
    });
    return Object.entries(weeklyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, { total, date }]) => ({ week, total, date }));
  }, [expenses]);

  const lastWeekEntry = costTrendDataRaw[costTrendDataRaw.length - 1];
  const lastWeekSpent = lastWeekEntry?.total ?? 0;
  const lastWeekKey = lastWeekEntry?.week;

  // ── Average per category (price spike detection) ─────────────────────────────
  const avgByCategory = useMemo(() => {
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = categorise(String(e.description || ""));
      const amt = parseFloat(String(e.amount || 0)) || 0;
      sums[cat] = (sums[cat] || 0) + amt;
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const avg: Record<string, number> = {};
    Object.keys(sums).forEach((cat) => {
      avg[cat] = sums[cat] / (counts[cat] || 1);
    });
    return avg;
  }, [expenses]);

  // ── Alerts ───────────────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const result: Array<{
      icon: React.ElementType;
      iconColor: string;
      title: string;
      subtitle: string;
      dotColor: string;
      timestamp?: string;
    }> = [];

    if (overBudget) {
      result.push({
        icon: AlertTriangle,
        iconColor: COLORS.red,
        title: `Total spend is ${formatUgx(totalSpent - budget)} over budget!`,
        subtitle: "Budget Overrun",
        dotColor: COLORS.red,
        timestamp: "Now",
      });
    }

    const perCatBudget =
      budget > 0 && categoryTotals.length > 0
        ? budget / categoryTotals.length
        : 0;
    categoryTotals.forEach((c) => {
      if (perCatBudget > 0 && c.amount > perCatBudget * 1.5) {
        result.push({
          icon: AlertTriangle,
          iconColor: COLORS.yellow,
          title: `${c.name} is ${formatUgx(c.amount - perCatBudget)} over its allocated share.`,
          subtitle: "Budget Overrun",
          dotColor: COLORS.yellow,
          timestamp: "Detected Yesterday",
        });
      }
    });

    expenses.forEach((e) => {
      const cat = categorise(String(e.description || ""));
      const amt = parseFloat(String(e.amount || 0)) || 0;
      const avg = avgByCategory[cat] || 0;
      if (avg > 0 && amt > avg * 2) {
        result.push({
          icon: Zap,
          iconColor: COLORS.red,
          title: `${String(e.description || "Expense")} (${formatUgx(amt)}) is 2× above average.`,
          subtitle: "Price Spike",
          dotColor: COLORS.red,
          timestamp: timeAgo(new Date(e.expense_date || e.created_at)),
        });
      }
    });

    materials.forEach((m) => {
      const qty = parseFloat(String(m.quantity || 0));
      if (qty < 10) {
        result.push({
          icon: PackageOpen,
          iconColor: COLORS.yellow,
          title: `${m.material_name} is low: ${m.quantity} ${m.unit || "units"} remaining.`,
          subtitle: "Low Stock",
          dotColor: COLORS.yellow,
          timestamp: "Now",
        });
      }
    });

    if (!overBudget && percentSpent >= 80 && result.length === 0) {
      result.push({
        icon: AlertTriangle,
        iconColor: COLORS.amber,
        title: `${percentSpent}% of budget used. ${formatUgx(balance)} remaining.`,
        subtitle: "High Budget Usage",
        dotColor: COLORS.amber,
      });
    }

    if (result.length === 0) {
      result.push({
        icon: AlertTriangle,
        iconColor: COLORS.green,
        title: "All good! No budget alerts at this time.",
        subtitle: "Budget on track",
        dotColor: COLORS.green,
      });
    }

    return result;
  }, [
    overBudget, percentSpent, balance, totalSpent, budget,
    categoryTotals, expenses, materials, avgByCategory,
  ]);

  const budgetUsedDotColor =
    percentSpent < 60 ? COLORS.green : percentSpent < 80 ? COLORS.amber : COLORS.red;

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (!projectId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center min-h-screen bg-background">
          <h1 className="text-2xl font-bold mb-2 text-foreground">{t("budget.title")}</h1>
          <p className="max-w-md mx-auto mb-6 text-muted-foreground">
            {hasProjects ? t("budget.noProjectSelect") : t("budget.noProjectCreate")}
          </p>
          <Button asChild variant="outline">
            <Link href="/projects">
              {hasProjects ? t("projects.backToProjects") : t("projects.createFirst")}
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (showLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen p-6 bg-background">
          <h1 className="text-2xl font-bold mb-6 text-foreground">Budgets & Costs</h1>
          <BudgetSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="py-16 px-4 text-center min-h-screen bg-background">
          <h1 className="text-2xl font-bold mb-2 text-foreground">{t("budget.title")}</h1>
          <p className="mb-4 text-muted-foreground">
            {error instanceof Error ? error.message : t("common.error")}
          </p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("common.retry")}
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="min-h-screen p-6 bg-background">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Budgets & Costs</h1>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-card border border-border text-[#00bcd4] hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* TOP ROW — 5 stat cards, no "View All" buttons anywhere */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard
            label="Total Budget"
            value={formatUgx(budget)}
            sub={budget === 0 ? "Not set" : undefined}
          />
          <StatCard
            label="Total Expenditure"
            value={formatUgx(totalSpent)}
            sub={`${expenses.length} transaction${expenses.length !== 1 ? "s" : ""}`}
          />
          <StatCard
            label="Balance"
            value={formatUgx(balance)}
            valueClassName={balance < 0 ? "text-red-400" : "text-foreground"}
            sub={balance < 0 ? "Over budget" : `${formatUgx(budget - balance)} spent`}
            extraSub={
              budget > 0 && totalSpent > 0 ? (
                <span style={{ color: "#00bcd4" }}>
                  {formatUgx(balance)} remaining
                </span>
              ) : undefined
            }
          />
          <StatCard
            label="Budget Used"
            value={`${percentSpent}%`}
            dotColor={budgetUsedDotColor}
            sub={
              weeksRemaining != null && weeksRemaining < 200
                ? `~${weeksRemaining} wk remaining`
                : undefined
            }
          />
          {/* Percentage Spent — no View All */}
          <StatCard
            label="Percentage Spent"
            value={`${percentSpent}% spent`}
            dotColor={budgetUsedDotColor}
          />
        </div>

        {/* MIDDLE ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <BudgetComparisonSection
              categoryTotals={categoryTotals}
              totalSpent={totalSpent}
              budget={budget}
              tasks={tasks}
              expenses={expenses}
            />
          </div>
          <div>
            <AlertsSection alerts={alerts} />
          </div>
        </div>

        {/* BOTTOM ROW — Cost Trend */}
        <div className="rounded-xl p-6 border border-border bg-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Cost Trend</h3>
            <select
              value={costTrendPeriod}
              onChange={(e) =>
                setCostTrendPeriod(e.target.value as "1w" | "1m" | "3m" | "all")
              }
              className="text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground"
            >
              <option value="1w">1 Week</option>
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <CostTrendChart
            allData={costTrendDataRaw}
            period={costTrendPeriod}
            lastWeekSpend={lastWeekSpent}
            lastWeekKey={lastWeekKey}
          />
        </div>
      </div>
    </AppLayout>
  );
}