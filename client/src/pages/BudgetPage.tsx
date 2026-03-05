"use client";

import React, { useMemo } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectExpenses, useProjectMaterials } from "@/hooks/useDashboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Area,
  AreaChart,
} from "recharts";
import {
  RefreshCw,
  ChevronRight,
  MoreHorizontal,
  AlertTriangle,
  Zap,
  PackageOpen,
  TrendingUp,
} from "lucide-react";

// ─── Color palette ────────────────────────────────────────────────────────────
const COLORS = {
  teal: "#14b8a6",
  green: "#22c55e",
  blue: "#3b82f6",
  orange: "#f97316",
  red: "#ef4444",
  amber: "#f59e0b",
  pink: "#ec4899",
  pageBg: "#0a0a0a",
  cardBg: "#1a1a1a",
  cardBorder: "#27272a",
  textPrimary: "#ffffff",
  textSecondary: "#a1a1aa",
};

const PROJECT_COLORS = [
  COLORS.green,
  COLORS.teal,
  COLORS.blue,
  COLORS.orange,
  COLORS.pink,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatUgx(n: number): string {
  const num = Number(n) || 0;
  if (num >= 1_000_000_000) return `UGX ${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `UGX ${(num / 1_000_000).toFixed(2)}M`;
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function BudgetSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-[#1a1a1a] border border-zinc-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 rounded-xl bg-[#1a1a1a] border border-zinc-800" />
          <div className="h-72 rounded-xl bg-[#1a1a1a] border border-zinc-800" />
        </div>
        <div className="h-96 rounded-xl bg-[#1a1a1a] border border-zinc-800" />
      </div>
      <div className="h-80 rounded-xl bg-[#1a1a1a] border border-zinc-800" />
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent,
  showViewAll,
  valueClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  showViewAll?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl p-4 bg-[#1a1a1a] border border-zinc-800 flex flex-col justify-between min-h-[88px]">
      <p className="text-sm text-zinc-400">{label}</p>
      <div className="flex items-end justify-between mt-2 gap-2">
        <div>
          <p className={`text-lg font-bold leading-tight ${valueClassName ?? "text-white"}`}>{value}</p>
          {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
        </div>
        {showViewAll && (
          <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors shrink-0">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {accent && (
        <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: accent }} />
        </div>
      )}
    </div>
  );
}

// ─── Category Breakdown (replaces mock BudgetComparison) ─────────────────────
function CategoryBreakdown({
  categories,
  totalSpent,
}: {
  categories: Array<{ name: string; amount: number }>;
  totalSpent: number;
}) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-4 text-center">
        No expense data yet. Log expenses via WhatsApp to see the breakdown.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map((cat, i) => {
        const share = pct(cat.amount, totalSpent);
        return (
          <div key={cat.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-zinc-300 flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }}
                />
                {cat.name}
              </span>
              <span className="text-sm font-medium text-white">
                {formatUgx(cat.amount)}
                <span className="text-xs text-zinc-500 ml-1">({share}%)</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${share}%`,
                  backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Cost Trend Chart (real weekly data) ─────────────────────────────────────
function CostTrendChart({ data }: { data: Array<{ week: string; amount: number }> }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">
        No expense history yet to chart.
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.textSecondary, fontSize: 11 }}
            tickFormatter={(v) =>
              v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1_000).toFixed(0)}K`
            }
          />
          <XAxis
            dataKey="week"
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.textSecondary, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: COLORS.cardBg,
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: "8px",
            }}
            labelStyle={{ color: COLORS.textSecondary }}
            formatter={(value: number) => [formatUgxFull(value), "Spent"]}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke={COLORS.red}
            strokeWidth={3}
            fill="url(#gradRed)"
            dot={{ fill: COLORS.red, strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: COLORS.red }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Alert Item ───────────────────────────────────────────────────────────────
function AlertItem({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  dotColor,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle: string;
  dotColor: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-800 last:border-0">
      <div className="mt-0.5 shrink-0">
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed text-white">{title}</p>
        <p className="text-xs mt-1 text-zinc-500">{subtitle}</p>
      </div>
      <div
        className="w-2 h-2 rounded-full shrink-0 mt-1"
        style={{ backgroundColor: dotColor }}
      />
    </div>
  );
}

// ─── Transaction Item ─────────────────────────────────────────────────────────
function TransactionItem({
  date,
  description,
  category,
  amount,
  status,
}: {
  date: string;
  description: string;
  category: string;
  amount: string;
  status: "confirmed" | "pending";
}) {
  const day = date.split(" ")[0] ?? date.slice(8, 10);
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
          <span className="text-xs text-zinc-400">{day}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{description}</p>
          <p className="text-xs text-zinc-500">{category}</p>
        </div>
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className="text-sm text-white font-medium">{amount}</p>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            status === "confirmed"
              ? "bg-green-500/20 text-green-400"
              : "bg-amber-500/20 text-amber-400"
          }`}
        >
          {status === "confirmed" ? "Confirmed" : "Pending"}
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
  const projectId = projectIdFromUrl || currentProject?.id || null;

  const { data, isLoading, isError, error, refetch } = useProjectExpenses(projectId);
  const { data: materialsData } = useProjectMaterials(projectId);

  const isProjectSwitch = projectId != null && data === undefined && !isError;
  const showLoading = isLoading || isProjectSwitch;

  // ── Derive all real numbers from API + expenses ─────────────────────────────
  const expenses: any[] = useMemo(
    () => (Array.isArray((data as any)?.expenses) ? (data as any).expenses : Array.isArray((data as any)?.recent) ? (data as any).recent : []),
    [data]
  );
  const materials: any[] = useMemo(
    () => (Array.isArray((materialsData as any)?.inventory) ? (materialsData as any).inventory : []),
    [materialsData]
  );

  const budget = useMemo(() => {
    const raw = currentProject?.totalBudget ?? (currentProject as any)?.budget;
    if (!raw) return 0;
    const parsed = parseFloat(String(raw).replace(/,/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }, [currentProject]);

  const totalSpent = useMemo(() => {
    return expenses.reduce((sum, e) => {
      const amt = parseFloat(String(e.amount ?? "0").replace(/,/g, ""));
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
  }, [expenses]);

  const balance = budget - totalSpent;

  console.log("[Budget Debug]", {
    budget,
    totalSpent,
    balance,
    rawBudget: (currentProject as any)?.budget ?? currentProject?.totalBudget,
    expenseCount: expenses.length,
    firstExpense: expenses[0],
  });

  const percentSpent = pct(totalSpent, budget);
  const overBudget = budget > 0 && totalSpent > budget;

  // Last 30 days spend
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSpend = useMemo(
    () =>
      expenses
        .filter((e) => new Date(e.expense_date || e.created_at).getTime() >= thirtyDaysAgo)
        .reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0),
    [expenses]
  );

  // Weekly burn for "weeks remaining" estimate
  const weeklyBurn = recentSpend / 4.3;
  const weeksRemaining =
    weeklyBurn > 0 ? Math.min(999, Math.max(0, Math.round(balance / weeklyBurn))) : null;

  // ── Category breakdown (group by description keywords) ────────────────────
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

  // ── Weekly cost trend (last 8 weeks, oldest to newest) ───────────────────────
  const costTrendData = useMemo(() => {
    const now = new Date();
    const result: Array<{ week: string; amount: number }> = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const weekNum = Math.ceil(weekStart.getDate() / 7);
      const monthShort = weekStart.toLocaleString("default", { month: "short" });
      const label = `W${weekNum} ${monthShort}`;
      let amount = 0;
      expenses.forEach((e) => {
        const d = new Date(e.expense_date || e.created_at);
        if (d >= weekStart && d <= weekEnd) amount += parseFloat(String(e.amount || 0));
      });
      result.push({ week: label, amount });
    }
    return result;
  }, [expenses]);

  // ── Real-time alerts ───────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const result: Array<{
      icon: React.ElementType;
      iconColor: string;
      title: string;
      subtitle: string;
      dotColor: string;
    }> = [];

    // Over budget alert
    if (overBudget) {
      result.push({
        icon: AlertTriangle,
        iconColor: COLORS.red,
        title: `Total spend is ${formatUgx(totalSpent - budget)} over budget!`,
        subtitle: "Budget Overrun",
        dotColor: COLORS.red,
      });
    } else if (percentSpent >= 80) {
      result.push({
        icon: AlertTriangle,
        iconColor: COLORS.amber,
        title: `${percentSpent}% of budget used. Only ${formatUgx(balance)} remaining.`,
        subtitle: "High Budget Usage",
        dotColor: COLORS.amber,
      });
    }

    // Weekly spend spike: if this week > 1.5× last week
    if (costTrendData.length >= 2) {
      const thisWeek = costTrendData[costTrendData.length - 1]?.amount || 0;
      const lastWeek = costTrendData[costTrendData.length - 2]?.amount || 0;
      if (lastWeek > 0 && thisWeek > lastWeek * 1.5) {
        const spike = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
        result.push({
          icon: Zap,
          iconColor: COLORS.orange,
          title: `Weekly spend jumped ${spike}% vs last week (${formatUgx(thisWeek)} this week).`,
          subtitle: "Spend Spike",
          dotColor: COLORS.orange,
        });
      }
    }

    // Low material stock alerts
    materials.forEach((m) => {
      if (parseFloat(String(m.quantity || 0)) <= 5) {
        result.push({
          icon: PackageOpen,
          iconColor: COLORS.red,
          title: `${m.material_name} stock is low: only ${m.quantity} ${m.unit || "units"} remaining.`,
          subtitle: "Low Stock",
          dotColor: COLORS.red,
        });
      }
    });

    // Weeks remaining warning
    if (weeksRemaining !== null && weeksRemaining <= 4 && balance > 0) {
      result.push({
        icon: TrendingUp,
        iconColor: COLORS.amber,
        title: `At current burn rate, budget runs out in ~${weeksRemaining} week${weeksRemaining === 1 ? "" : "s"}.`,
        subtitle: "Burn Rate Warning",
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
  }, [overBudget, percentSpent, budget, balance, totalSpent, costTrendData, materials, weeksRemaining]);

  // ── Recent transactions (last 10, most recent first) ──────────────────────
  const recentTransactions = useMemo(() => {
    return [...expenses]
      .sort(
        (a, b) =>
          new Date(b.expense_date || b.created_at).getTime() -
          new Date(a.expense_date || a.created_at).getTime()
      )
      .slice(0, 10)
      .map((e) => {
        const date = new Date(e.expense_date || e.created_at);
        const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const desc = String(e.description || "Expense");
        // Determine category
        let category = "Other";
        const descLower = desc.toLowerCase();
        for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
          if (keywords.some((kw) => descLower.includes(kw))) {
            category = cat;
            break;
          }
        }
        return {
          date: dateStr,
          description: desc,
          category,
          amount: formatUgxFull(e.amount),
          status: (e.source === "whatsapp" ? "confirmed" : "confirmed") as "confirmed" | "pending",
        };
      });
  }, [expenses]);

  // ── Guard: no project ──────────────────────────────────────────────────────
  if (!projectId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-[#0a0a0a] min-h-screen">
          <h1 className="text-2xl font-bold mb-2 text-white">{t("budget.title")}</h1>
          <p className="max-w-md mx-auto mb-6 text-zinc-400">
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
        <div className="min-h-screen p-6 bg-[#0a0a0a]">
          <h1 className="text-2xl font-bold mb-6 text-white">Budgets & Costs</h1>
          <BudgetSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="py-16 px-4 text-center min-h-screen bg-[#0a0a0a]">
          <h1 className="text-2xl font-bold mb-2 text-white">{t("budget.title")}</h1>
          <p className="mb-4 text-zinc-400">
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

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="min-h-screen p-6 bg-[#0a0a0a]">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Budgets & Costs</h1>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* TOP ROW — 5 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard
            label="Total Budget"
            value={formatUgx(budget)}
            sub={budget === 0 ? "Not set" : undefined}
          />
          <StatCard
            label="Total Expenditure"
            value={formatUgx(totalSpent)}
            sub={`${expenses.length} transactions`}
          />
          <StatCard
            label="Balance"
            value={formatUgx(Math.abs(balance))}
            sub={balance < 0 ? "⚠️ Over budget!" : balance === budget ? "No expenses yet" : undefined}
            accent={balance >= 0 && balance !== budget ? `${Math.min(100, percentSpent)}%` : undefined}
            valueClassName={balance < 0 ? "text-red-400" : undefined}
          />
          <StatCard
            label="This Month"
            value={formatUgx(recentSpend)}
            sub="Last 30 days"
          />
          <StatCard
            label="Budget Used"
            value={`${percentSpent}%`}
            sub={
              weeksRemaining !== null && weeksRemaining < 200
                ? `~${weeksRemaining} wk${weeksRemaining === 1 ? "" : "s"} remaining`
                : undefined
            }
            showViewAll
          />
        </div>

        {/* MAIN AREA — 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">

            {/* Category Breakdown Card */}
            <div className="rounded-xl p-6 bg-[#1a1a1a] border border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Spending by Category</h3>
                <span className="text-xs text-zinc-500">
                  {expenses.length} expense{expenses.length !== 1 ? "s" : ""} total
                      </span>
                    </div>

              <CategoryBreakdown categories={categoryTotals} totalSpent={totalSpent} />

              {categoryTotals.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Total Spent</span>
                  <span className="text-sm font-bold text-white">{formatUgxFull(totalSpent)}</span>
                </div>
              )}
            </div>

            {/* Cost Trend Card */}
            <div className="rounded-xl p-6 bg-[#1a1a1a] border border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Cost Trend</h3>
                <span className="text-xs text-zinc-500">Last 8 weeks</span>
              </div>

              <CostTrendChart data={costTrendData} />

              {weeklyBurn > 0 && (
                <p className="text-xs mt-4 text-zinc-500">
                  ~{formatUgx(weeklyBurn)} average weekly spend over the last 30 days
                </p>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — Real Alerts */}
          <div className="rounded-xl p-6 h-fit bg-[#1a1a1a] border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Alerts</h3>
              <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-zinc-400">
                {alerts.filter((a) => a.dotColor !== COLORS.green).length} active alert
                {alerts.filter((a) => a.dotColor !== COLORS.green).length !== 1 ? "s" : ""}
                    </span>
              <button className="text-zinc-500 hover:text-white">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            <div>
              {alerts.map((alert, i) => (
                <AlertItem key={i} {...alert} />
              ))}
            </div>
          </div>
        </div>

        {/* BOTTOM — Recent Transactions */}
        <div className="rounded-xl p-6 bg-[#1a1a1a] border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
            <span className="text-xs text-zinc-500">
              Showing {recentTransactions.length} of {expenses.length}
            </span>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm">No transactions yet.</p>
              <p className="text-zinc-600 text-xs mt-1">
                Log expenses via WhatsApp to see them here.
              </p>
            </div>
          ) : (
            <div>
              {recentTransactions.map((tx, i) => (
                <TransactionItem key={i} {...tx} />
              ))}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}