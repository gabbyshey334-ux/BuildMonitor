"use client";

import React from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectExpenses } from "@/hooks/useDashboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
} from "recharts";
import { RefreshCw, ChevronDown, MoreHorizontal, AlertTriangle, Zap, Triangle } from "lucide-react";

const COLORS = {
  green: "#22c55e",
  teal: "#14b8a6",
  blue: "#3b82f6",
  orange: "#f97316",
  red: "#ef4444",
  yellow: "#eab308",
  cyan: "#06b6d4",
  purple: "#8b5cf6",
};

const PROJECT_COLORS = [
  COLORS.green,
  COLORS.teal,
  COLORS.blue,
  COLORS.orange,
  COLORS.purple,
];

function formatUgx(n: number) {
  if (n >= 1000000) return `UGX ${(n / 1000000).toFixed(0)}M`;
  if (n >= 1000) return `UGX ${(n / 1000).toFixed(0)}K`;
  return `UGX ${n.toLocaleString()}`;
}

function formatUgxFull(n: number) {
  return `UGX ${n.toLocaleString()}`;
}

function BudgetSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 dark:bg-zinc-800 bg-slate-200 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 h-80 dark:bg-zinc-800 bg-slate-200 rounded-xl" />
        <div className="h-80 dark:bg-zinc-800 bg-slate-200 rounded-xl" />
      </div>
      <div className="h-64 dark:bg-zinc-800 bg-slate-200 rounded-xl" />
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

  if (!projectId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-2">{t("budget.title")}</h1>
          <p className="dark:text-zinc-400 text-slate-500 max-w-md mx-auto mb-6">
            {hasProjects ? t("budget.noProjectSelect") : t("budget.noProjectCreate")}
          </p>
          <Button asChild variant="outline" className="dark:border-zinc-600 dark:text-zinc-300 border-slate-300 text-slate-700">
            <Link href="/projects">{hasProjects ? t("projects.backToProjects") : t("projects.createFirst")}</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-6">Budgets & Costs</h1>
          <BudgetSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="py-16 px-4 text-center">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-2">{t("budget.title")}</h1>
          <p className="dark:text-zinc-400 text-slate-500 mb-4">{error instanceof Error ? error.message : t("common.error")}</p>
          <Button onClick={() => refetch()} className="dark:border-zinc-700 dark:text-white border-slate-300 text-slate-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("common.retry")}
          </Button>
        </div>
      </AppLayout>
    );
  }

  const payload = data!;
  const { summary, byCategory, recent } = payload;

  // Calculate progress percentages for visualization
  const budgetProgress = 75;
  const expenditureProgress = summary.percentage || 90;

  // Mock cost trend data (Week 1-4)
  const costTrendData = [
    { week: "Week 1", amount: 60000000, projected: 55000000 },
    { week: "Week 2", amount: 75000000, projected: 80000000 },
    { week: "Week 3", amount: 90000000, projected: 95000000 },
    { week: "Week 4", amount: 112000000, projected: 120000000 },
  ];

  // Calculate last week spending
  const lastWeekSpent = 29000000;

  // Mock alerts data
  const alerts = [
    {
      id: 1,
      icon: "warning",
      color: "yellow",
      title: "Tiles are UGX 400,000 over their allocated budget.",
      subtitle: "Budget Overrun",
      timestamp: "This week",
    },
    {
      id: 2,
      icon: "spike",
      color: "red",
      title: "Fuel costs increased by 15%",
      subtitle: "Price Spike",
      timestamp: "2h ago",
    },
    {
      id: 3,
      icon: "warning",
      color: "yellow",
      title: "Steel inventory is running low at 3 tons remaining",
      subtitle: "Detected Yesterday",
      timestamp: "",
    },
  ];

  // Mock category breakdown for colored segments
  const categoryBreakdown = byCategory.length > 0 
    ? byCategory.slice(0, 5).map((c, i) => ({ ...c, color: PROJECT_COLORS[i % PROJECT_COLORS.length] }))
    : [
        { category: "Hilltop Apts", total: summary.spent * 0.3, percentage: 30, color: COLORS.green },
        { category: "LakeView", total: summary.spent * 0.25, percentage: 25, color: COLORS.teal },
        { category: "GreenField", total: summary.spent * 0.2, percentage: 20, color: COLORS.blue },
        { category: "Serene Apts", total: summary.spent * 0.15, percentage: 15, color: COLORS.orange },
        { category: "Others", total: summary.spent * 0.1, percentage: 10, color: COLORS.purple },
      ];

  const getAlertIcon = (icon: string, color: string) => {
    if (icon === "spike") return <Zap className="w-5 h-5 text-red-500" />;
    return <AlertTriangle className={`w-5 h-5 ${color === "yellow" ? "text-yellow-500" : "text-red-500"}`} />;
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-6">Budgets & Costs</h1>

        {/* Top Stats Row */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {/* Total Budget */}
          <Card className="dark:bg-zinc-800/80 dark:border-zinc-700 bg-white border-slate-200 rounded-xl">
            <CardContent className="p-4">
              <p className="text-sm dark:text-zinc-400 text-slate-500 mb-1">Total Budget</p>
              <p className="text-lg font-semibold dark:text-white text-slate-800">{formatUgxFull(summary.total)}</p>
            </CardContent>
          </Card>

          {/* Total Expenditure */}
          <Card className="dark:bg-zinc-800/80 dark:border-zinc-700 bg-white border-slate-200 rounded-xl">
            <CardContent className="p-4">
              <p className="text-sm dark:text-zinc-400 text-slate-500 mb-1">Total Expenditure</p>
              <p className="text-lg font-semibold dark:text-white text-slate-800">{formatUgxFull(summary.spent)}</p>
            </CardContent>
          </Card>

          {/* Balance 1 */}
          <Card className="dark:bg-zinc-800/80 dark:border-zinc-700 bg-white border-slate-200 rounded-xl">
            <CardContent className="p-4">
              <p className="text-sm dark:text-zinc-400 text-slate-500 mb-1">Balance</p>
              <p className="text-lg font-semibold dark:text-white text-slate-800">{formatUgxFull(summary.remaining)}</p>
            </CardContent>
          </Card>

          {/* Balance 2 */}
          <Card className="dark:bg-zinc-800/80 dark:border-zinc-700 bg-white border-slate-200 rounded-xl">
            <CardContent className="p-4">
              <p className="text-sm dark:text-zinc-400 text-slate-500 mb-1">Balance</p>
              <p className="text-lg font-semibold dark:text-white text-slate-800">{formatUgxFull(summary.remaining)}</p>
            </CardContent>
          </Card>

          {/* Percentage Spent */}
          <Card className="dark:bg-zinc-800/80 dark:border-zinc-700 bg-white border-slate-200 rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm dark:text-zinc-400 text-slate-500">Percentage Spent</p>
                <Button variant="outline" size="sm" className="h-7 px-3 text-xs dark:border-zinc-600 dark:text-zinc-300 border-slate-300 text-slate-600 rounded-md">
                  View All →
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-lg font-semibold dark:text-emerald-400 text-emerald-600">{summary.percentage}% spent</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column (2/3 width) */}
          <div className="col-span-2 space-y-6">
            {/* Budget Comparison */}
            <Card className="dark:bg-zinc-800/80 dark:border-zinc-700 bg-white border-slate-200 rounded-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold dark:text-white text-slate-800">Budget Comparison</h3>
                  <Button variant="outline" size="sm" className="h-8 px-4 text-xs dark:border-zinc-600 dark:text-zinc-300 border-slate-300 text-slate-600 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/30">
                    View All
                  </Button>
                </div>

                {/* Progress vs Expenditure */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm dark:text-zinc-300 text-slate-600">Progress vs. Expenditure</span>
                    <Button variant="outline" size="sm" className="h-7 px-3 text-xs dark:border-zinc-600 dark:text-zinc-400 border-slate-300 text-slate-500 rounded-md">
                      Budget (Descending) <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </div>

                  {/* Project Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm dark:text-zinc-400 text-slate-500">Project Progress</span>
                      <span className="text-sm font-medium dark:text-white text-slate-800">{budgetProgress}%</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden flex">
                      {categoryBreakdown.map((cat, i) => (
                        <div
                          key={i}
                          className="h-full"
                          style={{
                            width: `${(cat.percentage / 100) * budgetProgress}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      ))}
                      <div className="h-full flex-1 dark:bg-zinc-700 bg-slate-200" />
                    </div>
                  </div>

                  {/* Budget Used Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm dark:text-zinc-400 text-slate-500">Budget Used</span>
                      <span className="text-sm font-medium dark:text-white text-slate-800">{expenditureProgress}%</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden flex">
                      {categoryBreakdown.map((cat, i) => (
                        <div
                          key={i}
                          className="h-full"
                          style={{
                            width: `${(cat.percentage / 100) * expenditureProgress}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      ))}
                      <div className="h-full flex-1 dark:bg-zinc-700 bg-slate-200" />
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 mt-4">
                    {categoryBreakdown.map((cat, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs dark:text-zinc-400 text-slate-500">{cat.category}</span>
                      </div>
                    ))}
                  </div>

                  {/* Status Note */}
                  <p className="text-xs dark:text-zinc-500 text-slate-400 mt-4">
                    Budget ahead of progress by 15%
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Cost Trend */}
            <Card className="dark:bg-zinc-800/80 dark:border-zinc-700 bg-white border-slate-200 rounded-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold dark:text-white text-slate-800">Cost Trend</h3>
                  <Button variant="outline" size="sm" className="h-7 px-3 text-xs dark:border-zinc-600 dark:text-zinc-400 border-slate-300 text-slate-500 rounded-md">
                    1 Month <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </div>

                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={costTrendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis 
                        dataKey="week" 
                        stroke="#64748b" 
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#64748b" 
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `UGX ${(v / 1000000).toFixed(0)}M`}
                      />
                      <Tooltip 
                        formatter={(v: number) => formatUgxFull(v)}
                        contentStyle={{ 
                          backgroundColor: "#1e293b", 
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          color: "#fff"
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke={COLORS.red}
                        strokeWidth={3}
                        fill="url(#colorAmount)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-center mt-2">
                  <Badge className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs px-3 py-1">
                    UGX 112M
                  </Badge>
                </div>

                <p className="text-xs dark:text-zinc-500 text-slate-400 mt-4 text-center">
                  UGX {lastWeekSpent.toLocaleString()} spent last week
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (1/3 width) - Alerts */}
          <div className="space-y-6">
            <Card className="dark:bg-zinc-800/80 dark:border-zinc-700 bg-white border-slate-200 rounded-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold dark:text-white text-slate-800">Alerts</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 px-3 text-xs dark:border-zinc-600 dark:text-zinc-300 border-slate-300 text-slate-600 rounded-md">
                      View All →
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 dark:text-zinc-400 text-slate-500">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Over Budget Items Badge */}
                <div className="mb-4">
                  <Badge className="dark:bg-zinc-700 bg-slate-200 dark:text-zinc-300 text-slate-600 text-xs px-3 py-1.5 rounded-md">
                    Over Budget Items: 3
                  </Badge>
                </div>

                {/* Alert Cards */}
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="dark:bg-zinc-700/50 bg-slate-100 rounded-lg p-3 border-l-4 border-yellow-500"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getAlertIcon(alert.icon, alert.color)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs dark:text-zinc-200 text-slate-700 leading-relaxed">
                            {alert.title}
                          </p>
                          <p className="text-xs dark:text-zinc-400 text-slate-500 mt-1">
                            {alert.subtitle}
                          </p>
                          {alert.timestamp && (
                            <p className="text-xs dark:text-zinc-500 text-slate-400 mt-1">
                              {alert.timestamp}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Transactions */}
        <Card className="dark:bg-zinc-800/80 dark:border-zinc-700 bg-white border-slate-200 rounded-xl mt-6">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold dark:text-white text-slate-800">Recent Transactions</h3>
              <Button variant="outline" size="sm" className="h-8 px-4 text-xs dark:border-zinc-600 dark:text-zinc-300 border-slate-300 text-slate-600 rounded-lg">
                View All →
              </Button>
            </div>

            {recent.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-zinc-700 border-slate-200">
                      <th className="text-left py-3 px-4 text-xs font-medium dark:text-zinc-400 text-slate-500">Date</th>
                      <th className="text-left py-3 px-4 text-xs font-medium dark:text-zinc-400 text-slate-500">Description</th>
                      <th className="text-right py-3 px-4 text-xs font-medium dark:text-zinc-400 text-slate-500">Amount</th>
                      <th className="text-left py-3 px-4 text-xs font-medium dark:text-zinc-400 text-slate-500">Category</th>
                      <th className="text-left py-3 px-4 text-xs font-medium dark:text-zinc-400 text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.slice(0, 5).map((r) => (
                      <tr key={r.id} className="border-b dark:border-zinc-700/50 border-slate-100 last:border-0">
                        <td className="py-3 px-4 text-sm dark:text-zinc-300 text-slate-600">
                          {r.expense_date ? new Date(r.expense_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="py-3 px-4 text-sm dark:text-white text-slate-800 font-medium">
                          {r.description}
                        </td>
                        <td className="py-3 px-4 text-sm dark:text-white text-slate-800 font-medium text-right">
                          {formatUgxFull(r.amount)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs dark:border-zinc-600 dark:text-zinc-300 border-slate-300 text-slate-600">
                            {r.category}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs dark:text-zinc-400 text-slate-500">Completed</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm dark:text-zinc-400 text-slate-500">No recent transactions</p>
                <p className="text-xs dark:text-zinc-500 text-slate-400 mt-1">Log expenses via WhatsApp or dashboard</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
