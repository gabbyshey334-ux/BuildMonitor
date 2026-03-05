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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  Tooltip,
} from "recharts";
import { RefreshCw, ChevronRight, MoreHorizontal, AlertTriangle, Zap } from "lucide-react";

// Color palette matching the screenshot
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

// Category colors for budget comparison bars
const PROJECT_COLORS = [
  COLORS.green,
  COLORS.teal,
  COLORS.blue,
  COLORS.orange,
  COLORS.pink,
];

function formatUgx(n: number): string {
  const num = Number(n) || 0;
  if (num >= 1_000_000_000) return `UGX ${(num / 1_000_000_000).toFixed(0)}B`;
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
    <div className="rounded-xl p-4 bg-[#1a1a1a] border border-zinc-800 flex flex-col justify-between">
      <p className="text-sm text-zinc-400">{label}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-lg font-bold text-white">
          {value}
        </p>
        {showViewAll && (
          <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// Budget Comparison Component - Matches screenshot exactly
function BudgetComparison({
  projects,
}: {
  projects: Array<{ name: string; progress: number; budgetUsed: number }>;
}) {
  return (
    <div className="space-y-4">
      {/* Project Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-300">Project Progress</span>
          <span className="text-sm font-bold text-white">75%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex bg-zinc-800">
          {projects.map((project, i) => (
            <div
              key={project.name}
              style={{ 
                width: `${project.progress}%`, 
                backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] 
              }}
              className="h-full"
            />
          ))}
        </div>
      </div>

      {/* Budget Used Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-300">Budget Used</span>
          <span className="text-sm font-bold text-white">90%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex bg-zinc-800">
          {projects.map((project, i) => (
            <div
              key={project.name}
              style={{ 
                width: `${project.budgetUsed}%`, 
                backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] 
              }}
              className="h-full"
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4">
        {projects.map((project, i) => (
          <div key={project.name} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded" 
              style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }} 
            />
            <span className="text-xs text-zinc-400">{project.name}</span>
          </div>
        ))}
      </div>

      <p className="text-xs italic mt-2 text-zinc-500">
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
            stroke={COLORS.red}
            strokeWidth={3}
            dot={{ fill: COLORS.red, strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: COLORS.red }}
          />
          {/* Gradient fill under line */}
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={COLORS.red} stopOpacity={0}/>
            </linearGradient>
          </defs>
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
    <div className="flex items-start gap-3 py-3 border-b border-zinc-800">
      <div className="mt-0.5">
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed text-white">
          {title}
        </p>
        <p className="text-xs mt-1 text-zinc-500">
          {subtitle}
        </p>
        <p className="text-xs mt-1 text-zinc-500">
          {time}
        </p>
      </div>
      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: dotColor }} />
    </div>
  );
}

// Recent Transaction Item
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
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
          <span className="text-xs text-zinc-400">{date.split(" ")[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{description}</p>
          <p className="text-xs text-zinc-500">{category}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm text-white font-medium">{amount}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          status === "confirmed" 
            ? "bg-green-500/20 text-green-400" 
            : "bg-amber-500/20 text-amber-400"
        }`}>
          {status === "confirmed" ? "Confirmed" : "Pending"}
        </span>
      </div>
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

  const isProjectSwitch = projectId != null && data === undefined && !isError;
  const showLoading = isLoading || isProjectSwitch;

  // Mock data matching screenshot
  const mockProjects = [
    { name: "Hilltop Apts.", progress: 25, budgetUsed: 20 },
    { name: "LakeView", progress: 20, budgetUsed: 25 },
    { name: "GreenField", progress: 15, budgetUsed: 15 },
    { name: "Serene Apts.", progress: 10, budgetUsed: 20 },
    { name: "Others", progress: 5, budgetUsed: 10 },
  ];

  const costTrendData = [
    { week: "Week 1", amount: 60_000_000 },
    { week: "Week 2", amount: 80_000_000 },
    { week: "Week 3", amount: 85_000_000 },
    { week: "Week 4", amount: 112_000_000 },
  ];

  const alerts = [
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
      iconColor: COLORS.orange,
      title: "Fuel costs increased by 15% This week.",
      subtitle: "Price Spike: 2h ago",
      time: "",
      dotColor: COLORS.orange,
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

  const recentTransactions = [
    { date: "Jan 15", description: "Cement purchase - 50 bags", category: "Materials", amount: "UGX 2,500,000", status: "confirmed" as const },
    { date: "Jan 14", description: "Labor payment - Week 2", category: "Labor", amount: "UGX 5,000,000", status: "confirmed" as const },
    { date: "Jan 13", description: "Steel rods - 2 tons", category: "Materials", amount: "UGX 8,000,000", status: "pending" as const },
    { date: "Jan 12", description: "Transport costs", category: "Logistics", amount: "UGX 500,000", status: "confirmed" as const },
    { date: "Jan 11", description: "Equipment rental", category: "Equipment", amount: "UGX 1,200,000", status: "confirmed" as const },
  ];

  if (!projectId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-[#0a0a0a] min-h-screen">
          <h1 className="text-2xl font-bold mb-2 text-white">
            {t("budget.title")}
          </h1>
          <p className="max-w-md mx-auto mb-6 text-zinc-400">
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
        <div className="min-h-screen p-6 bg-[#0a0a0a]">
          <h1 className="text-2xl font-bold mb-6 text-white">
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
        <div className="py-16 px-4 text-center min-h-screen bg-[#0a0a0a]">
          <h1 className="text-2xl font-bold mb-2 text-white">
            {t("budget.title")}
          </h1>
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

  return (
    <AppLayout>
      <div className="min-h-screen p-6 bg-[#0a0a0a]">
        <h1 className="text-2xl font-bold mb-6 text-white">
          Budgets & Costs
        </h1>

        {/* TOP ROW — 5 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard label="Total Budget" value="UGX 400,000,000" />
          <StatCard label="Total Expenditure" value="UGX 360,000,000" />
          <StatCard label="Balance" value="UGX 40,000,000" />
          <StatCard label="Balance" value="UGX 40,000,000" />
          <StatCard
            label="Percentage Spent"
            value="90% spent"
            dotColor={COLORS.green}
            showViewAll
          />
        </div>

        {/* MAIN AREA — 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* LEFT COLUMN (~70%) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Budget Comparison Card */}
            <div className="rounded-xl p-6 bg-[#1a1a1a] border border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Budget Comparison
                </h3>
                <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#14b8a6]/20 text-[#14b8a6] hover:bg-[#14b8a6]/30 transition-colors">
                  View All <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-white">
                    Progress vs. Expenditure
                  </h4>
                  <div className="relative">
                    <select className="text-xs px-3 py-1.5 rounded-md appearance-none pr-8 bg-zinc-800 text-white border border-zinc-700 focus:outline-none">
                      <option>Budget (Descending)</option>
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">▼</span>
                  </div>
                </div>

                <BudgetComparison projects={mockProjects} />
              </div>
            </div>

            {/* Cost Trend Card */}
            <div className="rounded-xl p-6 bg-[#1a1a1a] border border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Cost Trend
                </h3>
                <div className="relative">
                  <select className="text-xs px-3 py-1.5 rounded-md appearance-none pr-8 bg-zinc-800 text-white border border-zinc-700 focus:outline-none">
                    <option>1 Month</option>
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">▼</span>
                </div>
              </div>

              <CostTrendChart data={costTrendData} />

              <p className="text-xs mt-4 text-zinc-500">
                UGX 29M spent last week
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN (~30%) — Alerts */}
          <div className="rounded-xl p-6 h-fit bg-[#1a1a1a] border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Alerts
              </h3>
              <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-zinc-400">
                Over Budget Items: 3
              </span>
              <button className="text-zinc-500 hover:text-white">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-zinc-800">
              {alerts.map((alert, i) => <AlertItem key={i} {...alert} />)}
            </div>
          </div>
        </div>

        {/* BOTTOM — Recent Transactions */}
        <div className="rounded-xl p-6 bg-[#1a1a1a] border border-zinc-800">
          <h3 className="text-lg font-semibold mb-4 text-white">
            Recent Transactions
          </h3>

          <div className="divide-y divide-zinc-800">
            {recentTransactions.map((transaction, i) => (
              <TransactionItem key={i} {...transaction} />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}