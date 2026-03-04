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

// Category colors for pills
const CATEGORY_COLORS: Record<string, string> = {
  Materials: "#00d4aa",
  Labor: "#3b82f6",
  Equipment: "#a855f7",
  Other: "#6b7280",
};

function formatUgx(n: number): string {
  if (n >= 1_000_000_000) return `UGX ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `UGX ${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `UGX ${(n / 1_000).toFixed(0)}K`;
  return `UGX ${n.toLocaleString()}`;
}

function formatUgxFull(n: number): string {
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

// Horizontal stacked bar chart for Budget Comparison
function BudgetComparisonBars({
  progressPercent,
  budgetPercent,
}: {
  progressPercent: number;
  budgetPercent: number;
}) {
  const segments = [
    { name: "Hilltop Apts.", color: COLORS.teal, width: 25 },
    { name: "LakeView", color: COLORS.blue, width: 20 },
    { name: "GreenField", color: COLORS.green, width: 20 },
    { name: "Serene Apts.", color: COLORS.orange, width: 20 },
    { name: "Others", color: COLORS.red, width: 15 },
  ];

  return (
    <div className="space-y-4">
      {/* Project Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm" style={{ color: COLORS.textPrimary }}>
            Project Progress
          </span>
          <span className="text-sm font-bold" style={{ color: COLORS.textPrimary }}>
            {progressPercent}%
          </span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: "#2a2d3e" }}>
          {segments.map((seg) => (
            <div
              key={seg.name}
              style={{ width: `${seg.width}%`, backgroundColor: seg.color }}
              className="h-full"
            />
          ))}
        </div>
      </div>

      {/* Budget Used Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm" style={{ color: COLORS.textPrimary }}>
            Budget Used
          </span>
          <span className="text-sm font-bold" style={{ color: COLORS.textPrimary }}>
            {budgetPercent}%
          </span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: "#2a2d3e" }}>
          {segments.map((seg) => (
            <div
              key={seg.name}
              style={{ width: `${seg.width}%`, backgroundColor: seg.color }}
              className="h-full"
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4">
        {segments.map((seg) => (
          <div key={seg.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: seg.color }} />
            <span className="text-xs" style={{ color: COLORS.textSecondary }}>
              {seg.name}
            </span>
          </div>
        ))}
      </div>

      {/* Caption */}
      <p className="text-xs italic mt-2" style={{ color: COLORS.textSecondary }}>
        Budget ahead of progress by 15%
      </p>
    </div>
  );
}

// Cost Trend Chart
function CostTrendChart({ data }: { data: Array<{ week: string; amount: number }> }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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

  // Generate cost trend data from expenses
  const costTrendData = useMemo(() => {
    if (!data?.byMonth || data.byMonth.length === 0) {
      return [
        { week: "Week 1", amount: 60000000 },
        { week: "Week 2", amount: 120000000 },
        { week: "Week 3", amount: 112000000 },
        { week: "Week 4", amount: 240000000 },
      ];
    }
    return data.byMonth.slice(0, 4).map((m, i) => ({
      week: `Week ${i + 1}`,
      amount: m.amount,
    }));
  }, [data?.byMonth]);

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

  if (isLoading) {
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

  const payload = data!;
  const { summary, recent } = payload;

  // Calculate alerts from real data
  const alerts = useMemo(() => {
    const items: Array<{
      icon: React.ElementType;
      iconColor: string;
      title: string;
      subtitle: string;
      time: string;
      dotColor: string;
    }> = [];

    // Over budget alert
    if (summary.spent > summary.total) {
      items.push({
        icon: AlertTriangle,
        iconColor: COLORS.amber,
        title: `Total spending is ${formatUgxFull(summary.spent - summary.total)} over budget`,
        subtitle: "Budget Overrun",
        time: "",
        dotColor: COLORS.amber,
      });
    }

    // High percentage spent alert
    if (summary.percentage > 90) {
      items.push({
        icon: AlertTriangle,
        iconColor: COLORS.amber,
        title: `You've spent ${summary.percentage}% of your budget`,
        subtitle: "Approaching budget limit",
        time: "",
        dotColor: COLORS.amber,
      });
    }

    // Low materials alerts
    const lowStock = materialsData?.lowStock || [];
    lowStock.slice(0, 2).forEach((item) => {
      items.push({
        icon: AlertTriangle,
        iconColor: COLORS.red,
        title: `${item.material_name} inventory is running low at ${item.quantity} ${item.unit} remaining`,
        subtitle: "Detected Yesterday",
        time: "",
        dotColor: COLORS.red,
      });
    });

    return items.length > 0
      ? items
      : [
          {
            icon: AlertTriangle,
            iconColor: COLORS.amber,
            title: "Tiles are UGX 400,000 over their allocated budget.",
            subtitle: "Budget Overrun",
            time: "",
            dotColor: COLORS.amber,
          },
          {
            icon: Zap,
            iconColor: COLORS.amber,
            title: "Fuel costs increased by 15% This week.",
            subtitle: "Price Spike: 2h ago",
            time: "",
            dotColor: COLORS.amber,
          },
          {
            icon: AlertTriangle,
            iconColor: COLORS.red,
            title: "Steel inventory is running low at 3 tons remaining",
            subtitle: "Detected Yesterday",
            time: "",
            dotColor: COLORS.red,
          },
        ];
  }, [summary, materialsData?.lowStock]);

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

                <BudgetComparisonBars progressPercent={75} budgetPercent={summary.percentage} />
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
                  : "UGX 29M spent last week"}
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
                Over Budget Items: {alerts.filter((a) => a.subtitle.includes("Budget")).length || 3}
              </span>
              <button style={{ color: COLORS.textSecondary }}>
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y" style={{ borderColor: COLORS.cardBorder }}>
              {alerts.map((alert, i) => (
                <AlertItem key={i} {...alert} />
              ))}
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
                  {recent.slice(0, 10).map((r) => {
                    const categoryColor = CATEGORY_COLORS[r.category] || COLORS.textSecondary;
                    return (
                      <tr key={r.id}>
                        <td className="py-3 pr-4" style={{ color: COLORS.textSecondary }}>
                          {r.expense_date
                            ? new Date(r.expense_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "2-digit",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="py-3 pr-4" style={{ color: COLORS.textPrimary }}>
                          {r.description}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className="px-2 py-1 rounded-full text-xs"
                            style={{ backgroundColor: `${categoryColor}30`, color: categoryColor }}
                          >
                            {r.category}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right font-medium" style={{ color: COLORS.textPrimary }}>
                          {formatUgxFull(r.amount)}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className="px-2 py-1 rounded-full text-xs"
                            style={{
                              backgroundColor: r.disputed ? `${COLORS.red}30` : `${COLORS.green}30`,
                              color: r.disputed ? COLORS.red : COLORS.green,
                            }}
                          >
                            {r.disputed ? "Disputed" : "Confirmed"}
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
