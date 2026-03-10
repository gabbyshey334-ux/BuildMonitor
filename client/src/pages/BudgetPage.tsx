"use client";

import React, { useMemo, useState } from "react";
import { Link } from "wouter";
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
  CartesianGrid
} from "recharts";
import {
  RefreshCw,
  AlertTriangle,
  Zap,
  PackageOpen,
  DollarSign,
  PieChart,
  TrendingUp,
  CreditCard,
  Clock,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getToken } from "@/lib/authToken";
import { cn } from "@/lib/utils";

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
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
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
    <div className="min-h-screen bg-background p-6 space-y-8 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-10 w-10 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-card border border-border rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 bg-card border border-border rounded-xl" />
        <div className="h-80 bg-card border border-border rounded-xl" />
      </div>
      <div className="h-80 bg-card border border-border rounded-xl" />
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
  icon: Icon
}: {
  label: string;
  value: string;
  sub?: string;
  extraSub?: React.ReactNode;
  valueClassName?: string;
  dotColor?: string;
  icon?: any;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between min-h-[100px] relative overflow-hidden group hover:border-white/10 transition-all">
      {Icon && (
        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
          <Icon className="w-12 h-12" />
        </div>
      )}
      <div className="relative z-10">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="mt-2">
          <div className="flex items-center gap-2">
            {dotColor && (
              <span
                className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px_currentColor]"
                style={{ backgroundColor: dotColor, color: dotColor }}
              />
            )}
            <p className={cn("text-xl font-bold leading-tight", valueClassName ?? "text-foreground")}>
              {value}
            </p>
          </div>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          {extraSub && <div className="text-[11px] text-muted-foreground mt-1">{extraSub}</div>}
        </div>
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

  const budgetUsedPct =
    budget > 0 ? parseFloat(((totalSpent / budget) * 100).toFixed(6)) : 0;

  const gap = budgetUsedPct - progressPct;
  const footerText =
    gap > 5
      ? `Spending is ${gap.toFixed(1)}% ahead of progress`
      : gap < -5
      ? `Progress is ahead of spending by ${Math.abs(gap).toFixed(1)}%`
      : `Spending and progress are aligned`;

  return (
    <div className="bg-card border border-border rounded-xl p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <PieChart className="w-5 h-5 text-[#00bcd4]" />
          Budget Comparison
        </h3>
      </div>

      <div className="space-y-8 flex-1">
        {/* Project Progress bar */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-muted-foreground">Project Progress</span>
            <span className="text-[#00bcd4] font-medium">
              {tasksPct !== null
                ? `${progressPct}%`
                : expenses.length > 0
                ? `~${progressPct}% (estimated)`
                : "0%"}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00bcd4] to-[#0097a7] shadow-[0_0_10px_rgba(0,188,212,0.3)] transition-all duration-1000 ease-out"
              style={{ width: `${Math.max(progressPct, progressPct > 0 ? 1 : 0)}%` }}
            />
          </div>
        </div>

        {/* Budget Used bar */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-muted-foreground">Budget Used</span>
            <span className={cn(
              "font-medium",
              budgetUsedPct > 80 ? "text-red-500" : budgetUsedPct > 60 ? "text-amber-500" : "text-emerald-500"
            )}>
              {formatUgx(totalSpent)} ({budgetUsedPct.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-1000 ease-out", 
                budgetUsedPct > 80 ? "bg-gradient-to-r from-red-500 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.3)]" :
                budgetUsedPct > 60 ? "bg-gradient-to-r from-amber-500 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.3)]" :
                "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-[0_0_10px_rgba(34,197,94,0.3)]"
              )}
              style={{ width: `${budgetUsedPct > 0 ? Math.max(budgetUsedPct, 2) : 0}%` }}
            />
          </div>
        </div>

        {/* Category legend */}
        {categoryTotals.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-3 pt-4 border-t border-border">
            {categoryTotals.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }}
                />
                <span className="text-xs text-muted-foreground">
                  {d.name} <span className="text-muted-foreground">({formatUgx(d.amount)})</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={cn(
        "mt-6 py-3 px-4 rounded-lg text-xs font-medium flex items-center gap-2",
        gap > 5 ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : 
        gap < -5 ? "bg-[#00bcd4]/10 text-[#00bcd4] border border-[#00bcd4]/20" : 
        "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
      )}>
        {gap > 5 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
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
    <div className="bg-card border border-border rounded-xl p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          Alerts
        </h3>
        {overBudgetCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold border border-red-500/20 uppercase">
            {overBudgetCount} Critical
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-2 space-y-3 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <CheckCircle className="w-12 h-12 text-emerald-500/20 mb-3" />
            <p className="text-sm font-medium text-emerald-500">All Systems Normal</p>
            <p className="text-xs text-muted-foreground mt-1">No budget alerts detected.</p>
          </div>
        ) : (
          alerts.map((a, i) => (
            <div 
              key={i} 
              className={cn(
                "p-3 rounded-lg border transition-colors flex items-start gap-3",
                a.subtitle === "Budget Overrun" || a.subtitle === "Price Spike" 
                  ? "bg-red-500/5 border-red-500/20 hover:bg-red-500/10"
                  : a.subtitle === "Budget on track"
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-md shrink-0",
                a.subtitle === "Budget Overrun" || a.subtitle === "Price Spike" 
                  ? "bg-red-500/10 text-red-500"
                  : a.subtitle === "Budget on track"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-amber-500/10 text-amber-500"
              )}>
                <a.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground leading-snug">{a.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    "text-[10px] uppercase font-bold tracking-wide",
                    a.subtitle === "Budget Overrun" || a.subtitle === "Price Spike" ? "text-red-400" :
                    a.subtitle === "Budget on track" ? "text-emerald-400" : "text-[#00bcd4]"
                  )}>
                    {a.subtitle}
                  </span>
                  {a.timestamp && (
                    <>
                      <span className="text-muted-foreground text-[10px]">•</span>
                      <span className="text-[10px] text-muted-foreground">{a.timestamp}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Cost Trend ───────────────────────────────────────────────────────────────
function CostTrendChart({
  allData,
  period,
  lastWeekSpend,
  lastWeekKey,
  onPeriodChange
}: {
  allData: Array<{ week: string; total: number; date: Date }>;
  period: "1w" | "1m" | "3m" | "all";
  lastWeekSpend: number;
  lastWeekKey?: string;
  onPeriodChange: (p: "1w" | "1m" | "3m" | "all") => void;
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
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted">
        <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">No expense history for this period.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#00bcd4]" />
          Cost Trend
        </h3>
        <div className="flex bg-muted p-1 rounded-lg border border-border">
          {(["1w", "1m", "3m", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                period === p 
                  ? "bg-[#00bcd4] text-black shadow-lg" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              {p === "all" ? "All" : p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[300px] w-full text-card">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" vertical={false} />
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#52525b", fontSize: 11 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              domain={[0, "auto"]}
              tick={{ fill: "#52525b", fontSize: 11 }}
              tickFormatter={yAxisTickFormatter}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e2235",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "13px",
                color: "#fff",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)"
              }}
              itemStyle={{ color: "#fff" }}
              labelStyle={{ color: "#9ca3af", marginBottom: "4px" }}
              formatter={(value: number) => [formatUgx(value), "Spent"]}
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#00bcd4"
              strokeWidth={3}
              dot={{ r: 4, fill: "currentColor", stroke: "#00bcd4", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "#00bcd4", stroke: "#fff", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-3 pl-4 border-l-4 border-[#00bcd4]">
          <div>
            <span className="text-2xl font-bold text-foreground block leading-none">
              {formatUgx(lastWeekSpend)}
            </span>
            <span className="text-xs text-muted-foreground mt-1 block">
              spent last week {lastWeekKey ? `(${lastWeekKey})` : ""}
            </span>
          </div>
        </div>
        <div className="text-right">
             <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[#00bcd4] hover:bg-[#00bcd4]/10">
               View Full Report <ArrowLeft className="w-3 h-3 ml-1 rotate-180" />
             </Button>
        </div>
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

  const { data, isLoading, isError, error, refetch } = useProjectExpenses(projectId ?? undefined);
  const isResolvingProject = !projectId && !isError;

  const { data: materialsData } = useProjectMaterials(projectId);
  const { data: tasksData } = useProjectTasks(projectId);

  const [costTrendPeriod, setCostTrendPeriod] = useState<"1w" | "1m" | "3m" | "all">("1m");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseDescription, setEditExpenseDescription] = useState("");
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [savingExpenseEdit, setSavingExpenseEdit] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseDateFrom, setExpenseDateFrom] = useState("");
  const [expenseDateTo, setExpenseDateTo] = useState("");
  const [expenseSort, setExpenseSort] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const token = getToken();

  const tasks = useMemo(() => {
    const raw = (tasksData as any)?.tasks ?? tasksData;
    return Array.isArray(raw) ? raw : [];
  }, [tasksData]);

  const isProjectSwitch = projectId != null && data === undefined && !isError;
  const showLoading = isLoading || isProjectSwitch || isResolvingProject;

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

  const filteredExpenses = useMemo(() => {
    let list = [...expenses];
    const search = expenseSearch.trim().toLowerCase();
    if (search) {
      list = list.filter((e: any) =>
        String(e.description || "").toLowerCase().includes(search)
      );
    }
    if (expenseDateFrom) {
      list = list.filter((e: any) => {
        const d = e.expense_date || e.created_at || "";
        const dateStr = typeof d === "string" ? d : d?.split?.("T")[0] || "";
        return dateStr >= expenseDateFrom;
      });
    }
    if (expenseDateTo) {
      list = list.filter((e: any) => {
        const d = e.expense_date || e.created_at || "";
        const dateStr = typeof d === "string" ? d : d?.split?.("T")[0] || "";
        return dateStr <= expenseDateTo;
      });
    }
    const sorted = [...list];
    if (expenseSort === "newest") {
      sorted.sort((a: any, b: any) => {
        const ta = new Date(a.created_at || a.expense_date || 0).getTime();
        const tb = new Date(b.created_at || b.expense_date || 0).getTime();
        return tb - ta;
      });
    } else if (expenseSort === "oldest") {
      sorted.sort((a: any, b: any) => {
        const ta = new Date(a.created_at || a.expense_date || 0).getTime();
        const tb = new Date(b.created_at || b.expense_date || 0).getTime();
        return ta - tb;
      });
    } else if (expenseSort === "highest") {
      sorted.sort((a: any, b: any) => {
        const amtA = parseFloat(String(a.amount || 0));
        const amtB = parseFloat(String(b.amount || 0));
        return amtB - amtA;
      });
    } else {
      sorted.sort((a: any, b: any) => {
        const amtA = parseFloat(String(a.amount || 0));
        const amtB = parseFloat(String(b.amount || 0));
        return amtA - amtB;
      });
    }
    return sorted;
  }, [expenses, expenseSearch, expenseDateFrom, expenseDateTo, expenseSort]);

  const expenseFiltersActive =
    expenseSearch.trim() !== "" || expenseDateFrom !== "" || expenseDateTo !== "" || expenseSort !== "newest";

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
  const budget = useMemo(() => {
    const raw =
      (currentProject as any)?.budget ??
      (currentProject as any)?.totalBudget ??
      0;
    const parsed = parseFloat(String(raw).replace(/,/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }, [currentProject]);

  const totalSpent = useMemo(
    () =>
      expenses.reduce(
        (sum, e) =>
          sum + (parseFloat(String(e.amount ?? 0).replace(/,/g, "")) || 0),
        0
      ),
    [expenses]
  );

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
        icon: CheckCircle,
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

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete");
      }
      await refetch();
    } catch (err) {
      // Optionally toast; refetch already available
      if (err instanceof Error) window.alert(err.message);
    }
  };

  const handleSaveExpenseEdit = async (expenseId: string) => {
    const description = editExpenseDescription.trim();
    const amount = parseFloat(String(editExpenseAmount).replace(/,/g, ""));
    if (!description || isNaN(amount) || amount <= 0) {
      window.alert("Enter valid description and amount");
      return;
    }
    setSavingExpenseEdit(true);
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ description, amount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update");
      }
      setEditingExpenseId(null);
      setEditExpenseDescription("");
      setEditExpenseAmount("");
      await refetch();
    } catch (err) {
      if (err instanceof Error) window.alert(err.message);
    } finally {
      setSavingExpenseEdit(false);
    }
  };

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (!projectId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-6">
          <div className="w-20 h-20 rounded-full bg-[#00bcd4]/10 flex items-center justify-center mx-auto ring-1 ring-[#00bcd4]/20">
            <DollarSign className="w-10 h-10 text-[#00bcd4]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t("budget.title")}</h1>
            <p className="text-muted-foreground">
              {hasProjects ? t("budget.noProjectSelect") : t("budget.noProjectCreate")}
            </p>
          </div>
          <Button asChild className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-semibold">
            <Link href="/projects">
              {hasProjects ? t("projects.backToProjects") : t("projects.createFirst")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (showLoading) return <BudgetSkeleton />;

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{t("budget.title")}</h1>
          <p className="text-muted-foreground">{error instanceof Error ? error.message : t("common.error")}</p>
          <Button onClick={() => refetch()} variant="outline" className="border-border text-muted-foreground">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
             <h1 className="text-3xl font-bold text-foreground tracking-tight">Budgets & Costs</h1>
             <p className="text-muted-foreground mt-1">Track expenditure, analyze costs, and manage budget health.</p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="icon"
            className="rounded-full w-10 h-10 bg-card border-border text-muted-foreground hover:text-[#00bcd4] hover:border-[#00bcd4]/50 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* TOP ROW — 5 stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Budget"
            value={formatUgx(budget)}
            sub={budget === 0 ? "Not set" : undefined}
            icon={DollarSign}
          />
          <StatCard
            label="Total Expenditure"
            value={formatUgx(totalSpent)}
            sub={`${expenses.length} transaction${expenses.length !== 1 ? "s" : ""}`}
            icon={CreditCard}
          />
          <StatCard
            label="Balance"
            value={formatUgx(balance)}
            valueClassName={balance < 0 ? "text-red-500" : "text-foreground"}
            sub={balance < 0 ? "Over budget" : `${formatUgx(budget - balance)} spent`}
            dotColor={balance < 0 ? COLORS.red : COLORS.teal}
          />
          <StatCard
            label="Budget Used"
            value={`${percentSpent}%`}
            dotColor={budgetUsedDotColor}
            sub={percentSpent > 100 ? "Limit exceeded" : "of total budget"}
          />
          <StatCard
            label="Weeks Remaining"
            value={weeksRemaining != null && weeksRemaining < 200 ? `~${weeksRemaining}` : "—"}
            sub="Based on current burn rate"
            icon={Clock}
          />
        </div>

        {/* MIDDLE ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
        <CostTrendChart
          allData={costTrendDataRaw}
          period={costTrendPeriod}
          lastWeekSpend={lastWeekSpent}
          lastWeekKey={lastWeekKey}
          onPeriodChange={setCostTrendPeriod}
        />

        {/* Expense list — edit/delete per row */}
        {expenses.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#00bcd4]" />
              Expense history
            </h3>
            <div className="space-y-3 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search expenses..."
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-[#00bcd4] focus:border-transparent placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-muted-foreground text-sm whitespace-nowrap">From</label>
                  <input
                    type="date"
                    value={expenseDateFrom}
                    onChange={(e) => setExpenseDateFrom(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-[#00bcd4]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-muted-foreground text-sm whitespace-nowrap">To</label>
                  <input
                    type="date"
                    value={expenseDateTo}
                    onChange={(e) => setExpenseDateTo(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-[#00bcd4]"
                  />
                </div>
                <select
                  value={expenseSort}
                  onChange={(e) => setExpenseSort(e.target.value as "newest" | "oldest" | "highest" | "lowest")}
                  className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-[#00bcd4]"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="highest">Highest amount</option>
                  <option value="lowest">Lowest amount</option>
                </select>
                {expenseFiltersActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setExpenseSearch("");
                      setExpenseDateFrom("");
                      setExpenseDateTo("");
                      setExpenseSort("newest");
                    }}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear filters
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Showing {filteredExpenses.length} of {expenses.length} expenses
              </p>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {filteredExpenses.slice(0, 50).map((expense: any) => (
                <div key={expense.id} className="flex gap-3 group items-center py-2 border-b border-border last:border-0">
                  {editingExpenseId === expense.id ? (
                    <>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editExpenseDescription}
                          onChange={(e) => setEditExpenseDescription(e.target.value)}
                          placeholder="Description"
                          className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-[#00bcd4]"
                        />
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={editExpenseAmount}
                          onChange={(e) => setEditExpenseAmount(e.target.value)}
                          placeholder="Amount"
                          className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-[#00bcd4]"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="bg-[#00bcd4] hover:bg-[#00acc1] text-black shrink-0"
                        disabled={savingExpenseEdit}
                        onClick={() => handleSaveExpenseEdit(expense.id)}
                      >
                        {savingExpenseEdit ? "Saving..." : "Save"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            const dateStr = expense.created_at || expense.expense_date;
                            if (!dateStr) return "—";
                            const d = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T12:00:00");
                            return timeAgo(d);
                          })()}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-[#00bcd4] shrink-0">{formatUgx(parseFloat(String(expense.amount || 0)))}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                            aria-label="Expense options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingExpenseId(expense.id);
                              setEditExpenseDescription(expense.description || "");
                              setEditExpenseAmount(String(expense.amount ?? ""));
                            }}
                            className="cursor-pointer"
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="cursor-pointer text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              ))}
            </div>
            {filteredExpenses.length > 50 && (
              <p className="text-xs text-muted-foreground mt-3">Showing latest 50 of {filteredExpenses.length} expenses.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
