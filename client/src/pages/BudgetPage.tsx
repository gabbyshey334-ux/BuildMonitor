"use client";

import React, { useMemo } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectExpenses, useProjectMaterials } from "@/hooks/useDashboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  Tooltip,
} from "recharts";
import { RefreshCw, ChevronRight, MoreHorizontal, AlertTriangle, Zap } from "lucide-react";

// Exact color palette from reference
const COLORS = {
  teal: "#00d4aa",
  blue: "#3b82f6",
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
  amber: "#f59e0b",
  purple: "#a855f7",
  pageBg: "#0f1117",
  cardBg: "#1a1d2e",
  cardBorder: "#2a2d3e",
  textPrimary: "#ffffff",
  textSecondary: "#9ca3af",
};

// Category colors for pills and bars (real categories from DB)
const CATEGORY_COLORS: Record<string, string> = {
  Materials: "#00d4aa",
  Labor: "#3b82f6",
  Equipment: "#a855f7",
  General: "#6b7280",
  Other: "#6b7280",
};
const CATEGORY_COLOR_FALLBACKS = ["#f97316", "#ef4444", "#22c55e", "#a855f7"]; // orange, red, green, purple for unknown categories

function getCategoryColor(category: string, index: number): string {
  const key = category in CATEGORY_COLORS ? category : "Other";
  if (key !== "Other") return CATEGORY_COLORS[key];
  return CATEGORY_COLOR_FALLBACKS[index % CATEGORY_COLOR_FALLBACKS.length];
}

function formatUgx(n: number): string {
  const num = Number(n) || 0;
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

function BudgetSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top 5 cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-xl" style={{ backgroundColor: COLORS.cardBg }} />
        ))}
      </div>
      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 rounded-xl" style={{ backgroundColor: COLORS.cardBg }} />
          <div className="h-72 rounded-xl" style={{ backgroundColor: COLORS.cardBg }} />
        </div>
        <div className="h-96 rounded-xl" style={{ backgroundColor: COLORS.cardBg }} />
      </div>
      {/* Transactions skeleton */}
      <div className="h-80 rounded-xl" style={{ backgroundColor: COLORS.cardBg }} />
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  dotColor,
  showViewAll,
}: {
  label: string;
  value: string;
  dotColor?: string;
  showViewAll?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col justify-between"
      style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}` }}
    >
      <p className="text-sm" style={{ color: COLORS.textSecondary }}>
        {label}
      </p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xl font-bold" style={{ color: COLORS.textPrimary }}>
          {dotColor && <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: dotColor }} />}
          {value}
        </p>
        {showViewAll && (
          <button className="text-xs flex items-center gap-1 px-2 py-1 rounded border" style={{ color: COLORS.teal, borderColor: COLORS.teal }}>
            View All <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// Horizontal stacked bar chart for Budget Comparison — 100% real data
function BudgetComparisonBars({
  categorySegments,
  budgetPercent,
  caption,
  empty,
}: {
  categorySegments: Array<{ name: string; color: string; width: number }>;
  budgetPercent: number;
  caption: string;
  empty: boolean;
}) {
  // Budget Used bar color by percentage
  const budgetBarColor =
    budgetPercent <= 50
      ? COLORS.teal
      : budgetPercent <= 75
        ? COLORS.amber
        : budgetPercent <= 90
          ? COLORS.orange
          : COLORS.red;

  if (empty) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm" style={{ color: COLORS.textSecondary }}>
          No spending data yet. Log expenses via WhatsApp to see budget breakdown.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Spending by Category (stacked bar) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm" style={{ color: COLORS.textPrimary }}>
            Spending by Category
          </span>
          <span className="text-sm font-bold" style={{ color: COLORS.textPrimary }}>
            {categorySegments.reduce((s, seg) => s + seg.width, 0).toFixed(0)}%
          </span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: "#2a2d3e" }}>
          {categorySegments.map((seg) => (
            <div
              key={seg.name}
              style={{ width: `${seg.width}%`, backgroundColor: seg.color, minWidth: seg.width > 0 ? "4px" : 0 }}
              className="h-full"
            />
          ))}
        </div>
      </div>

      {/* Budget Used bar — single bar, width = % of budget spent */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm" style={{ color: COLORS.textPrimary }}>
            Budget Used
          </span>
          <span className="text-sm font-bold" style={{ color: COLORS.textPrimary }}>
            {Math.round(budgetPercent)}%
          </span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: "#2a2d3e" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, budgetPercent)}%`, backgroundColor: budgetBarColor }}
          />
        </div>
      </div>

      {/* Legend — real category names from DB */}
      {categorySegments.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-4">
          {categorySegments.map((seg) => (
            <div key={seg.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: seg.color }} />
              <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                {seg.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Dynamic caption */}
      <p className="text-xs italic mt-2" style={{ color: COLORS.textSecondary }}>
        {caption}
      </p>
    </div>
  );
}

// Cost Trend Chart — always receives a valid array
function CostTrendChart({ data }: { data: Array<{ week: string; amount: number }> }) {
  const safeData = Array.isArray(data) && data.length > 0 ? data : [
    { week: "Week 1", amount: 0 },
    { week: "Week 2", amount: 0 },
    { week: "Week 3", amount: 0 },
    { week: "Week 4", amount: 0 },
  ];
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={safeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.textSecondary, fontSize: 11 }}
            tickFormatter={(v) => `UGX ${(v / 1_000_000).toFixed(0)}M`}
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
            formatter={(value: number) => [formatUgxFull(value), "Amount"]}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke={COLORS.teal}
            strokeWidth={3}
            dot={{ fill: COLORS.teal, strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: COLORS.red }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Alert Item Component
function AlertItem({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  time,
  dotColor,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle: string;
  time: string;
  dotColor: string;
  tag?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b" style={{ borderColor: COLORS.cardBorder }}>
      <div className="mt-0.5">
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed" style={{ color: COLORS.textPrimary }}>
          {title}
        </p>
        <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
          {subtitle}
        </p>
        <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
          {time}
        </p>
      </div>
      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: dotColor }} />
    </div>
  );
}

export default function BudgetPage() {
  const { t } = useLanguage();
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const projectIdFromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("project") : null;
  const projectId = projectIdFromUrl || currentProject?.id || null;

  const { data, isLoading, isError, error, refetch } = useProjectExpenses(projectId);
  const { data: materialsData } = useProjectMaterials(projectId);

  // When projectId changes, treat as loading until we have data for this project (avoid stale data crash)
  const isProjectSwitch = projectId != null && data === undefined && !isError;
  const showLoading = isLoading || isProjectSwitch;

  // Safe summary and recent — never undefined
  const summary = useMemo(() => {
    if (!data?.summary) {
      return {
        total: 0,
        spent: 0,
        remaining: 0,
        percentage: 0,
        weeklyBurnRate: 0,
        weeksRemaining: null as number | null,
      };
    }
    const s = data.summary;
    const total = Number(s.total) ?? 0;
    const spent = Number(s.spent) ?? 0;
    const remaining = total > 0 ? Math.max(0, total - spent) : 0;
    const percentage = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
    return {
      total,
      spent,
      remaining,
      percentage,
      weeklyBurnRate: Number(s.weeklyBurnRate) ?? 0,
      weeksRemaining: s.weeksRemaining ?? null,
    };
  }, [data?.summary]);

  const recent = useMemo(() => (Array.isArray(data?.recent) ? data.recent : []), [data?.recent]);

  // Category segments for Budget Comparison bar (from real byCategory)
  const categorySegments = useMemo(() => {
    const byCat = Array.isArray(data?.byCategory) ? data.byCategory : [];
    const spent = summary.spent;
    if (spent <= 0 || byCat.length === 0) return [];
    return byCat.map((c, i) => ({
      name: c.category || "General",
      color: getCategoryColor(c.category || "General", i),
      width: Math.round((Number(c.total) / spent) * 1000) / 10,
    })).filter((s) => s.width > 0);
  }, [data?.byCategory, summary.spent]);

  // Dynamic caption: budget vs progress (use project progress if available, else spending % as proxy)
  const budgetCaption = useMemo(() => {
    const percentageBudgetUsed = summary.percentage;
    const percentageProgress = currentProject?.progress ?? percentageBudgetUsed;
    const diff = percentageBudgetUsed - percentageProgress;
    if (diff > 0) return `Budget spending is ahead of progress by ${Math.abs(diff).toFixed(0)}%`;
    if (diff < 0) return `Progress is ahead of spending by ${Math.abs(diff).toFixed(0)}%`;
    return "Budget and progress are aligned";
  }, [summary.percentage, currentProject?.progress]);

  // Generate cost trend data — always return a valid array for charts
  const costTrendData = useMemo(() => {
    const byMonth = data?.byMonth;
    if (!Array.isArray(byMonth) || byMonth.length === 0) {
      return [
        { week: "Week 1", amount: 0 },
        { week: "Week 2", amount: 0 },
        { week: "Week 3", amount: 0 },
        { week: "Week 4", amount: 0 },
      ];
    }
    return byMonth.slice(0, 4).map((m, i) => ({
      week: `Week ${i + 1}`,
      amount: Number(m?.amount) ?? 0,
    }));
  }, [data?.byMonth]);

  // Alerts — must be called unconditionally (Rules of Hooks); 100% real data, no hardcoded fallbacks
  const alerts = useMemo(() => {
    const items: Array<{
      icon: React.ElementType;
      iconColor: string;
      title: string;
      subtitle: string;
      time: string;
      dotColor: string;
      tag: string;
    }> = [];

    const total = summary.total;
    const spent = summary.spent;
    const pct = summary.percentage;

    // Over budget
    if (total > 0 && spent > total) {
      items.push({
        icon: AlertTriangle,
        iconColor: COLORS.red,
        title: "Project is over budget",
        subtitle: `Spent ${formatUgxFull(spent)} of ${formatUgxFull(total)} budget`,
        time: "",
        dotColor: COLORS.red,
        tag: "Budget Overrun",
      });
    }

    // Budget warning (80%+ and < 100%)
    if (total > 0 && pct >= 80 && pct < 100) {
      items.push({
        icon: Zap,
        iconColor: COLORS.amber,
        title: `${Math.round(pct)}% of budget used`,
        subtitle: `UGX ${formatUgxFull(summary.remaining)} remaining`,
        time: "",
        dotColor: COLORS.orange,
        tag: "Budget Warning",
      });
    }

    // Weekly spending spike
    const thisWeek = Number(data?.thisWeekTotal) ?? 0;
    const lastWeek = Number(data?.lastWeekTotal) ?? 0;
    if (lastWeek > 0 && thisWeek > lastWeek * 1.2) {
      const pctIncrease = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
      items.push({
        icon: Zap,
        iconColor: COLORS.amber,
        title: `Spending up ${pctIncrease}% this week`,
        subtitle: `${formatUgxFull(thisWeek)} vs ${formatUgxFull(lastWeek)} last week`,
        time: "",
        dotColor: COLORS.orange,
        tag: "Price Spike",
      });
    }

    // Low materials (from materialsData.lowStock)
    const lowStock = Array.isArray(materialsData?.lowStock) ? materialsData.lowStock : [];
    lowStock.forEach((item) => {
      const name = item?.material_name ?? "Material";
      const qty = Number(item?.quantity) ?? 0;
      const unit = (item?.unit ?? "units") as string;
      items.push({
        icon: AlertTriangle,
        iconColor: COLORS.red,
        title: `${name} running low`,
        subtitle: `Only ${qty} ${unit} remaining`,
        time: "",
        dotColor: COLORS.red,
        tag: "Low Stock",
      });
    });

    return items;
  }, [
    summary.total,
    summary.spent,
    summary.percentage,
    summary.remaining,
    materialsData?.lowStock,
    data,
  ]);

  if (!projectId) {
    return (
      <AppLayout>
        <div
          className="flex flex-col items-center justify-center py-16 px-4 text-center"
          style={{ backgroundColor: COLORS.pageBg, minHeight: "100vh" }}
        >
          <h1 className="text-2xl font-bold mb-2" style={{ color: COLORS.textPrimary }}>
            {t("budget.title")}
          </h1>
          <p className="max-w-md mx-auto mb-6" style={{ color: COLORS.textSecondary }}>
            {hasProjects ? t("budget.noProjectSelect") : t("budget.noProjectCreate")}
          </p>
          <Button asChild variant="outline">
            <Link href="/projects">{hasProjects ? t("projects.backToProjects") : t("projects.createFirst")}</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (showLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen p-6" style={{ backgroundColor: COLORS.pageBg }}>
          <h1 className="text-2xl font-bold mb-6" style={{ color: COLORS.textPrimary }}>
            Budgets & Costs
          </h1>
          <BudgetSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div
          className="py-16 px-4 text-center min-h-screen"
          style={{ backgroundColor: COLORS.pageBg }}
        >
          <h1 className="text-2xl font-bold mb-2" style={{ color: COLORS.textPrimary }}>
            {t("budget.title")}
          </h1>
          <p className="mb-4" style={{ color: COLORS.textSecondary }}>
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

  // Safety: if we still have no data, show loading (e.g. after project switch before refetch)
  if (!data) {
    return (
      <AppLayout>
        <div className="min-h-screen p-6 flex items-center justify-center" style={{ backgroundColor: COLORS.pageBg }}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen p-6" style={{ backgroundColor: COLORS.pageBg }}>
        <h1 className="text-2xl font-bold mb-6" style={{ color: COLORS.textPrimary }}>
          Budgets & Costs
        </h1>

        {/* TOP ROW — 5 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard label="Total Budget" value={formatUgxFull(summary.total)} />
          <StatCard label="Total Expenditure" value={formatUgxFull(summary.spent)} />
          <StatCard label="Balance" value={formatUgxFull(summary.remaining)} />
          <StatCard label="Balance" value={formatUgxFull(summary.remaining)} />
          <StatCard
            label="Percentage Spent"
            value={`${summary.percentage}% spent`}
            dotColor={COLORS.teal}
            showViewAll
          />
        </div>

        {/* MAIN AREA — 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* LEFT COLUMN (~70%) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Budget Comparison Card */}
            <div
              className="rounded-xl p-6"
              style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}` }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>
                  Budget Comparison
                </h3>
                <button
                  className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-md"
                  style={{ color: COLORS.teal, backgroundColor: `${COLORS.teal}20` }}
                >
                  View All <ChevronRight className="w-3 h-3" />
                </button>
        </div>

        <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                    Progress vs. Expenditure
                  </h4>
                  <div className="relative">
                    <select
                      className="text-xs px-3 py-1.5 rounded-md appearance-none pr-8"
                      style={{ backgroundColor: "#2a2d3e", color: COLORS.textPrimary, border: `1px solid ${COLORS.cardBorder}` }}
                    >
                      <option>Budget (Descending)</option>
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs">▼</span>
                  </div>
          </div>

                <BudgetComparisonBars
                  categorySegments={categorySegments}
                  budgetPercent={summary.percentage}
                  caption={budgetCaption}
                  empty={categorySegments.length === 0 && summary.spent === 0}
                />
          </div>
        </div>

            {/* Cost Trend Card */}
            <div
              className="rounded-xl p-6"
              style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}` }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>
                  Cost Trend
                </h3>
                <div className="relative">
                  <select
                    className="text-xs px-3 py-1.5 rounded-md appearance-none pr-8"
                    style={{ backgroundColor: "#2a2d3e", color: COLORS.textPrimary, border: `1px solid ${COLORS.cardBorder}` }}
                  >
                    <option>1 Month</option>
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs">▼</span>
                </div>
              </div>

              <CostTrendChart data={costTrendData} />

              <p className="text-xs mt-4" style={{ color: COLORS.textSecondary }}>
                {summary.weeklyBurnRate && summary.weeklyBurnRate > 0
                  ? `UGX ${(summary.weeklyBurnRate / 1_000_000).toFixed(0)}M spent last week`
                  : "No spending last week"}
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN (~30%) — Alerts */}
          <div
            className="rounded-xl p-6 h-fit"
            style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}` }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>
                Alerts
              </h3>
              <button
                className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-md"
                style={{ color: COLORS.teal, backgroundColor: `${COLORS.teal}20` }}
              >
                View All <ChevronRight className="w-3 h-3" />
              </button>
                      </div>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm" style={{ color: COLORS.textSecondary }}>
                Over Budget Items: {alerts.filter((a) => a.tag === "Budget Overrun").length}
                      </span>
              <button style={{ color: COLORS.textSecondary }}>
                <MoreHorizontal className="w-4 h-4" />
              </button>
                    </div>

            <div className="divide-y" style={{ borderColor: COLORS.cardBorder }}>
              {alerts.length === 0 ? (
                <div className="flex items-center gap-2 py-4" style={{ color: COLORS.green }}>
                  <span>✅</span>
                  <span>All budgets on track</span>
                </div>
              ) : (
                alerts.map((alert, i) => <AlertItem key={i} {...alert} />)
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM — Recent Transactions */}
        <div
          className="rounded-xl p-6"
          style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}` }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.textPrimary }}>
            Recent Transactions
          </h3>

            {recent.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }}>
                    <th className="py-3 pr-4 text-left font-medium" style={{ color: COLORS.textSecondary }}>
                      Date
                    </th>
                    <th className="py-3 pr-4 text-left font-medium" style={{ color: COLORS.textSecondary }}>
                      Description
                    </th>
                    <th className="py-3 pr-4 text-left font-medium" style={{ color: COLORS.textSecondary }}>
                      Category
                    </th>
                    <th className="py-3 pr-4 text-right font-medium" style={{ color: COLORS.textSecondary }}>
                      Amount
                    </th>
                    <th className="py-3 pr-4 text-left font-medium" style={{ color: COLORS.textSecondary }}>
                      Status
                    </th>
                    </tr>
                  </thead>
                <tbody className="divide-y" style={{ borderColor: COLORS.cardBorder }}>
                  {recent.slice(0, 10).map((r, index) => {
                    const id = r?.id ?? `row-${index}`;
                    const categoryColor = CATEGORY_COLORS[String(r?.category ?? "Other")] || COLORS.textSecondary;
                    const amount = Number(r?.amount) ?? 0;
                    const disputed = Boolean(r?.disputed);
                    return (
                      <tr key={id}>
                        <td className="py-3 pr-4" style={{ color: COLORS.textSecondary }}>
                          {r?.expense_date
                            ? new Date(r.expense_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "2-digit",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="py-3 pr-4" style={{ color: COLORS.textPrimary }}>
                          {String(r?.description ?? "—")}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className="px-2 py-1 rounded-full text-xs"
                            style={{ backgroundColor: `${categoryColor}30`, color: categoryColor }}
                          >
                            {String(r?.category ?? "Other")}
                            </span>
                        </td>
                        <td className="py-3 pr-4 text-right font-medium" style={{ color: COLORS.textPrimary }}>
                          {formatUgxFull(amount)}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className="px-2 py-1 rounded-full text-xs"
                            style={{
                              backgroundColor: disputed ? `${COLORS.red}30` : `${COLORS.green}30`,
                              color: disputed ? COLORS.red : COLORS.green,
                            }}
                          >
                            {disputed ? "Disputed" : "Confirmed"}
                            </span>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            ) : (
            <div className="py-12 text-center">
              <p style={{ color: COLORS.textSecondary }}>No transactions yet.</p>
              <p className="text-sm mt-2" style={{ color: COLORS.textSecondary }}>
                Log your first expense via WhatsApp
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
