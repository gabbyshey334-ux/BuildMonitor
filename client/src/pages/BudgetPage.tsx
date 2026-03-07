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
  ChevronRight,
  MoreHorizontal,
  AlertTriangle,
  Zap,
  PackageOpen,
} from "lucide-react";

// ─── Design tokens (dark theme per spec) ─────────────────────────────────────
const COLORS = {
  teal: "#00bcd4",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  pageBg: "#0f1117",
  cardBg: "#1a1d27",
  cardBorder: "#2a2d38",
  textPrimary: "#ffffff",
  textSecondary: "#94a3b8",
};

const PROJECT_COLORS = [COLORS.teal, "#22c55e", "#3b82f6", COLORS.orange, "#ec4899"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatUgx(value: number): string {
  const num = Number(value) || 0;
  if (num >= 1_000_000_000) return `UGX ${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `UGX ${(num / 1_000_000).toFixed(0)}M`;
  if (num >= 1_000) return `UGX ${(num / 1_000).toFixed(0)}K`;
  return `UGX ${num.toLocaleString()}`;
}

function formatUgxFull(amount: unknown): string {
  const n = Number(amount) ?? 0;
  if (!Number.isFinite(n)) return "UGX 0";
  return `UGX ${Math.round(n).toLocaleString()}`;
}

function pct(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  const raw = (numerator / denominator) * 100;
  if (raw < 1 && raw > 0) return parseFloat(raw.toFixed(2));
  return Math.min(100, parseFloat(raw.toFixed(1)));
}

function yAxisTickFormatter(v: unknown): string {
  const n = parseFloat(String(v));
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
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
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

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  valueClassName,
  dotColor,
  showViewAll,
  viewAllHref,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
  dotColor?: string;
  showViewAll?: boolean;
  viewAllHref?: string;
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col justify-between min-h-[88px] border border-border bg-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-end justify-between mt-2 gap-2">
        <div className="flex items-center gap-2">
          {dotColor && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: dotColor }}
            />
          )}
          <div>
            <p
              className={`text-lg font-bold leading-tight ${valueClassName ?? "text-foreground"}`}
            >
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
        {showViewAll && viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-md bg-muted text-[#00bcd4] hover:bg-muted/80 transition-colors shrink-0"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Budget Comparison bars ───────────────────────────────────────────────────
function BudgetComparisonSection({
  categoryTotals,
  totalSpent,
  budget,
  tasks,
}: {
  categoryTotals: Array<{ name: string; amount: number }>;
  totalSpent: number;
  budget: number;
  tasks: Array<{ status?: string }>;
}) {
  const progressPct = useMemo(() => {
    if (!tasks || tasks.length === 0) return 0;
    const completed = tasks.filter((t) => t.status === "completed").length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  const barData = useMemo(() => {
    const sorted = [...categoryTotals].sort((a, b) => b.amount - a.amount);
    return sorted.map((c) => ({
      name: c.name,
      amount: parseFloat(String(c.amount)),
      pctOfSpend: totalSpent > 0 ? pct(c.amount, totalSpent) : 0,
      pctOfBudget: budget > 0 ? pct(c.amount, budget) : 0,
    }));
  }, [categoryTotals, totalSpent, budget]);

  const budgetAhead =
    budget > 0 && totalSpent < budget
      ? pct(budget - totalSpent, budget)
      : 0;

  return (
    <div className="rounded-xl p-6 border border-border bg-card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Budget Comparison</h3>
      </div>

      <div className="mb-4">
        <p className="text-sm text-muted-foreground mb-2">Progress vs. Expenditure</p>
        <select
          className="text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground"
          defaultValue="desc"
        >
          <option value="desc">Budget (Descending)</option>
          <option value="asc">Budget (Ascending)</option>
        </select>
      </div>

      {barData.length > 0 || tasks.length > 0 ? (
        <div className="space-y-6">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Project Progress</p>
            <div className="h-6 rounded-full overflow-hidden bg-muted flex">
              <div
                className="h-full transition-all rounded-full"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: COLORS.teal,
                }}
              />
            </div>
            <p className="text-xs text-right mt-1 text-muted-foreground">
              {progressPct}%{tasks.length === 0 ? " — no tasks logged yet" : ""}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Budget Used</p>
            <div className="h-6 rounded-full overflow-hidden bg-muted flex">
              {barData.map((d, i) => (
                <div
                  key={d.name}
                  className="h-full transition-all"
                  style={{
                    width: `${d.pctOfBudget}%`,
                    backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length],
                  }}
                  title={`${d.name}: ${d.pctOfBudget.toFixed(1)}%`}
                />
              ))}
            </div>
            <p className="text-xs text-right mt-1 text-muted-foreground">
              {pct(totalSpent, budget).toFixed(0)}%
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            {barData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length],
                  }}
                />
                <span className="text-xs text-muted-foreground">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No expense data yet to compare.
        </p>
      )}

      {budget > 0 && totalSpent < budget && (
        <p className="text-sm text-[#00bcd4] mt-4">
          Budget ahead of progress by {budgetAhead.toFixed(0)}%
        </p>
      )}
    </div>
  );
}

// ─── Alerts Card ───────────────────────────────────────────────────────────────
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
    <div className="rounded-xl p-6 border border-border bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Alerts</h3>
        <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-md bg-muted text-[#00bcd4] hover:bg-muted/80 transition-colors">
          View All <ChevronRight className="w-4 h-4" />
        </button>
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
          alerts.map((a, i) => (
            <AlertRow key={i} {...a} />
          ))
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
        <p className="text-xs mt-1" style={{ color: COLORS.teal }}>{subtitle}</p>
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

// ─── Cost Trend Chart ─────────────────────────────────────────────────────────
function CostTrendChart({
  data,
  lastWeekSpend,
  lastWeekKey,
}: {
  data: Array<{ week: string; total: number }>;
  lastWeekSpend: number;
  lastWeekKey?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm rounded-xl border border-border bg-card">
        No expense history yet to chart.
      </div>
    );
  }

  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              width={55}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              formatter={(value: number) => [formatUgx(value), "Spent"]}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke={COLORS.teal}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div
        className="flex items-center gap-2 mt-4 py-2.5 px-4 rounded-r-md"
        style={{
          background: "rgba(0, 188, 212, 0.08)",
          borderLeft: "3px solid #00bcd4",
        }}
      >
        <span style={{ color: "#00bcd4", fontSize: "18px", fontWeight: 700 }}>
          {formatUgx(lastWeekSpend)}
        </span>
        <span className="text-muted-foreground text-[13px]">
          spent last week ({lastWeekKey ?? "this week"})
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
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
    const t = (tasksData as any)?.tasks ?? tasksData;
    return Array.isArray(t) ? t : [];
  }, [tasksData]);

  const isProjectSwitch = projectId != null && data === undefined && !isError;
  const showLoading = isLoading || isProjectSwitch;

  const expenses: any[] = useMemo(
    () =>
      Array.isArray((data as any)?.expenses)
        ? (data as any).expenses
        : Array.isArray((data as any)?.recent)
        ? (data as any).recent
        : [],
    [data]
  );

  const materials: any[] = useMemo(
    () =>
      Array.isArray((materialsData as any)?.inventory)
        ? (materialsData as any).inventory
        : [],
    [materialsData]
  );

  const budget = useMemo(() => {
    const raw = currentProject?.totalBudget ?? (currentProject as any)?.budget ?? 0;
    const parsed = parseFloat(String(raw).replace(/,/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }, [currentProject]);

  const totalSpent = useMemo(() => {
    return (expenses ?? []).reduce(
      (sum, e) => sum + parseFloat(String(e.amount ?? 0).replace(/,/g, "")),
      0
    );
  }, [expenses]);

  const balance = budget - totalSpent;
  const percentSpent = useMemo(() => {
    if (!budget || budget <= 0) return 0;
    return parseFloat(((totalSpent / budget) * 100).toFixed(4));
  }, [budget, totalSpent]);
  const overBudget = budget > 0 && totalSpent > budget;

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSpend = useMemo(
    () =>
      expenses
        .filter((e) => new Date(e.expense_date || e.created_at).getTime() >= thirtyDaysAgo)
        .reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0),
    [expenses]
  );

  const weeklyBurn = recentSpend / 4.3;
  const weeksRemaining =
    weeklyBurn > 0 ? Math.min(999, Math.max(0, Math.round(balance / weeklyBurn))) : null;

  const CATEGORY_KEYWORDS: Record<string, string[]> = {
    Materials: ["cement", "sand", "stone", "tiles", "brick", "steel", "rod", "iron", "timber", "wood", "paint", "wire", "pipe", "block", "material", "receipt"],
    Labor: ["labor", "labour", "worker", "casual", "wage", "plumber", "electrician", "mason", "carpenter", "painter", "driver"],
    Equipment: ["equipment", "tool", "machine", "rental", "hire", "generator", "pump", "mixer"],
    Logistics: ["transport", "delivery", "fuel", "logistics", "truck"],
  };

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach((e) => {
      const desc = String(e.description || "").toLowerCase();
      let matched = false;
      for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((kw) => desc.includes(kw))) {
          totals[cat] = (totals[cat] || 0) + parseFloat(String(e.amount || 0));
          matched = true;
          break;
        }
      }
      if (!matched) {
        totals["Other"] = (totals["Other"] || 0) + parseFloat(String(e.amount || 0));
      }
    });
    return Object.entries(totals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const byCategory = useMemo(() => {
    const acc: Record<string, number> = {};
    expenses.forEach((e) => {
      const desc = String(e.description || "").toLowerCase();
      let cat = "Other";
      for (const [c, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((kw) => desc.includes(kw))) {
          cat = c;
          break;
        }
      }
      acc[cat] = (acc[cat] || 0) + parseFloat(String(e.amount || 0));
    });
    return acc;
  }, [expenses]);

  const costTrendData = useMemo(() => {
    const weeklyTotals: Record<string, number> = {};
    (expenses ?? []).forEach((e) => {
      const date = new Date((e as any).created_at || (e as any).expense_date || Date.now());
      const year = date.getFullYear();
      const week = getWeekNumber(date);
      const monthShort = date.toLocaleString("default", { month: "short" });
      const key = `W${week} ${monthShort}`;
      const amt = parseFloat(String((e as any).amount ?? 0).replace(/,/g, "")) || 0;
      weeklyTotals[key] = (weeklyTotals[key] || 0) + amt;
    });
    const weeklyData = Object.entries(weeklyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, total]) => ({ week, total }));
    return weeklyData;
  }, [expenses]);

  const lastWeekEntry = costTrendData[costTrendData.length - 1];
  const lastWeekSpent = lastWeekEntry?.total ?? 0;
  const lastWeekKey = lastWeekEntry?.week ?? "this week";

  const avgByCategory = useMemo(() => {
    const n = expenses.length;
    if (n === 0) return {} as Record<string, number>;
    const avg: Record<string, number> = {};
    Object.entries(byCategory).forEach(([cat, total]) => {
      const count = expenses.filter((e) => {
        const desc = String(e.description || "").toLowerCase();
        for (const [c, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
          if (keywords.some((kw) => desc.includes(kw)) && c === cat) return true;
        }
        return cat === "Other";
      }).length;
      avg[cat] = count > 0 ? total / count : 0;
    });
    return avg;
  }, [expenses, byCategory]);

  const alerts = useMemo(() => {
    const result: Array<{
      icon: React.ElementType;
      iconColor: string;
      title: string;
      subtitle: string;
      dotColor: string;
      timestamp?: string;
    }> = [];

    const perCategoryBudget = budget > 0 && categoryTotals.length > 0 ? budget / categoryTotals.length : 0;
    const threshold = perCategoryBudget * 1.5;

    categoryTotals.forEach((c) => {
      if (threshold > 0 && c.amount > threshold) {
        const over = c.amount - perCategoryBudget;
        result.push({
          icon: AlertTriangle,
          iconColor: COLORS.yellow,
          title: `${c.name} are ${formatUgx(over)} over their allocated budget.`,
          subtitle: "Budget Overrun",
          dotColor: COLORS.yellow,
          timestamp: "Detected Yesterday",
        });
      }
    });

    expenses.forEach((e) => {
      const desc = String(e.description || "").toLowerCase();
      let cat = "Other";
      for (const [c, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((kw) => desc.includes(kw))) {
          cat = c;
          break;
        }
      }
      const amt = parseFloat(String(e.amount || 0));
      const avg = avgByCategory[cat] || 0;
      if (avg > 0 && amt > avg * 2) {
        result.push({
          icon: Zap,
          iconColor: COLORS.red,
          title: `${String(e.description || "Expense")} — ${formatUgx(amt)} is 2× above average.`,
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
          title: `${m.material_name} stock is low: only ${m.quantity} ${m.unit || "units"} remaining.`,
          subtitle: "Low Stock",
          dotColor: COLORS.yellow,
          timestamp: "2h ago",
        });
      }
    });

    if (overBudget) {
      result.unshift({
        icon: AlertTriangle,
        iconColor: COLORS.red,
        title: `Total spend is ${formatUgx(totalSpent - budget)} over budget!`,
        subtitle: "Budget Overrun",
        dotColor: COLORS.red,
        timestamp: "2h ago",
      });
    } else if (percentSpent >= 80 && result.length === 0) {
      result.push({
        icon: AlertTriangle,
        iconColor: COLORS.amber,
        title: `${percentSpent}% of budget used. Only ${formatUgx(balance)} remaining.`,
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
    overBudget,
    percentSpent,
    balance,
    totalSpent,
    budget,
    categoryTotals,
    expenses,
    materials,
    avgByCategory,
  ]);

  const budgetUsedDotColor =
    percentSpent < 60 ? COLORS.green : percentSpent < 80 ? COLORS.amber : COLORS.red;

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

  return (
    <AppLayout>
      <div className="min-h-screen p-6 bg-background">
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

        {/* TOP ROW — 5 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard label="Total Budget" value={formatUgx(budget)} sub={budget === 0 ? "Not set" : undefined} />
          <StatCard
            label="Total Expenditure"
            value={formatUgx(totalSpent)}
            sub={`${expenses.length} transactions`}
          />
          <StatCard
            label="Balance"
            value={formatUgx(balance)}
            sub={balance < 0 ? "Over budget" : undefined}
            valueClassName={balance < 0 ? "text-red-400" : "text-foreground"}
          />
          <StatCard
            label="Budget Used"
            value={`${percentSpent}%`}
            dotColor={budgetUsedDotColor}
          />
          <StatCard
            label="Percentage Spent"
            value={`${percentSpent}% spent`}
            dotColor={budgetUsedDotColor}
            sub={weeksRemaining != null && weeksRemaining < 200 ? `~${weeksRemaining} wk remaining` : undefined}
          />
        </div>

        {/* MIDDLE ROW — Budget Comparison + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <BudgetComparisonSection
              categoryTotals={categoryTotals}
              totalSpent={totalSpent}
              budget={budget}
              tasks={tasks}
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
              onChange={(e) => setCostTrendPeriod(e.target.value as "1w" | "1m" | "3m" | "all")}
              className="text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground"
            >
              <option value="1w">1 Week</option>
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <CostTrendChart
            data={costTrendData}
            lastWeekSpend={lastWeekSpent}
            lastWeekKey={lastWeekKey}
          />
        </div>
      </div>
    </AppLayout>
  );
}
