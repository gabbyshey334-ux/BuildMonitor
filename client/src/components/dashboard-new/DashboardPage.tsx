"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  Plus,
  Upload,
  AlertCircle,
  FileText,
  X,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  BarChart3,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  Calendar,
  Flame,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useProjectSummary,
  useProjectTasks,
  useProjectExpenses,
  DASHBOARD_SUMMARY_QUERY_KEY,
} from "@/hooks/useDashboard";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/authToken";
import { useToast } from "@/hooks/use-toast";
import { uploadPhotoDirectly } from "@/lib/uploadPhoto";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  computeBudgetHealth,
  computeBurn,
  sumByCategory,
  spendOverTime,
  safeNum,
  formatCurrency,
  formatDaysRemaining,
} from "@/lib/analytics";
import { PageHeader } from "@/components/layout/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { BudgetRing } from "@/components/ui/BudgetRing";
import { CurrencyValue } from "@/components/ui/CurrencyValue";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  SkeletonKPI,
  SkeletonChart,
  SkeletonRing,
} from "@/components/ui/SkeletonCard";
import { SpendOverTimeChart } from "@/components/charts/SpendOverTimeChart";
import { CategoryBreakdownChart } from "@/components/charts/CategoryBreakdownChart";
import { usePageTitle } from "@/hooks/usePageTitle";

const PHOTO_TAGS = [
  "Foundation",
  "Structure",
  "Delivery",
  "Workers",
  "Inspection",
  "Other",
] as const;

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const date = dateStr.includes("T")
    ? new Date(dateStr)
    : new Date(dateStr + "T12:00:00");
  const ms = Date.now() - date.getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(ms / 86400000);
  if (ms < 60000) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

interface DashboardPageProps {
  projectId?: string | null;
}

export default function DashboardPage({ projectId: projectIdProp }: DashboardPageProps) {
  usePageTitle("Dashboard");
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const effectiveProjectId = projectIdProp ?? currentProject?.id ?? null;
  const [, setLocation] = useLocation();

  const currency = (currentProject as { currency?: string } | null)?.currency || "UGX";

  const {
    data: summaryData,
    isLoading,
    isError,
    refetch,
    dataUpdatedAt,
  } = useProjectSummary(effectiveProjectId);

  const { data: tasksData } = useProjectTasks(effectiveProjectId);
  const { data: expensesData, refetch: refetchExpenses } = useProjectExpenses(
    effectiveProjectId,
  );
  const { data: issuesData, refetch: refetchIssues } = useQuery({
    queryKey: ["issues", effectiveProjectId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/projects/${effectiveProjectId}/issues`,
      );
      return res.json();
    },
    enabled: !!effectiveProjectId,
    refetchInterval: 30_000,
  });

  const tasks = Array.isArray(tasksData)
    ? tasksData
    : (tasksData as { tasks?: unknown[] } | undefined)?.tasks ?? [];
  const expenses =
    ((expensesData as { expenses?: unknown[] })?.expenses as unknown[]) ??
    ((expensesData as { recent?: unknown[] })?.recent as unknown[]) ??
    [];
  const issuesList =
    (issuesData as { issues?: unknown[] } | undefined)?.issues ?? [];

  // ─── Computed analytics (via analytics.ts) ───────────────────────────
  //
  // IMPORTANT: the dashboard is locked to `effectiveProjectId`. We NEVER fall
  // back to `currentProject.totalBudget` (which is populated from the projects
  // list endpoint and could briefly hold the previous project's values during
  // a project switch). When the summary endpoint has not yet returned for the
  // active project we render a skeleton above; `budgetHealth` deliberately
  // returns a zero-state rather than fabricating numbers from context.
  const budgetHealth = useMemo(() => {
    const sb = (summaryData as { budget?: { total?: number; spent?: number } })?.budget;
    if (sb && typeof sb.total === "number") {
      return computeBudgetHealth(sb.total, sb.spent ?? 0);
    }
    return computeBudgetHealth(0, 0);
  }, [summaryData]);

  if (import.meta.env.DEV && summaryData) {
    const sb = (summaryData as { budget?: { total?: number; spent?: number; dailyBurnRate?: number; daysRemaining?: number | null; firstExpenseDate?: string | null } }).budget;
    if (sb) {
      // eslint-disable-next-line no-console
      console.debug("[dashboard]", {
        projectId: effectiveProjectId,
        total: sb.total,
        spent: sb.spent,
        firstExpenseDate: sb.firstExpenseDate,
        dailyRate: sb.dailyBurnRate,
        daysRemaining: sb.daysRemaining,
      });
    }
  }

  const burn = useMemo(
    () => computeBurn(expenses as never, budgetHealth.remaining),
    [expenses, budgetHealth.remaining],
  );

  const spendSeries = useMemo(
    () => spendOverTime(expenses as never, { fillGaps: true }),
    [expenses],
  );

  const categoryTotals = useMemo(
    () => sumByCategory(expenses as never),
    [expenses],
  );

  const progressInfo = useMemo(() => {
    const summaryProgress = (
      summaryData as {
        progress?: {
          overallPercentage?: number;
          completedTasks?: number;
          totalTasks?: number;
        };
      }
    )?.progress;

    const typedTasks = tasks as Array<{ status?: string }>;
    const fallbackTotal = typedTasks.length;
    const fallbackDone = typedTasks.filter(
      (tk) => tk.status === "completed" || tk.status === "done",
    ).length;

    const total =
      typeof summaryProgress?.totalTasks === "number"
        ? summaryProgress.totalTasks
        : fallbackTotal;
    const completed =
      typeof summaryProgress?.completedTasks === "number"
        ? summaryProgress.completedTasks
        : fallbackDone;

    let pct = 0;
    if (typeof summaryProgress?.overallPercentage === "number") {
      pct = Math.round(summaryProgress.overallPercentage);
    } else if (total > 0) {
      pct = Math.round((completed / total) * 100);
    }
    pct = Math.min(100, Math.max(0, pct));

    return { pct, completed, total };
  }, [tasks, summaryData]);

  const progressPct = progressInfo.pct;

  const scheduleStatus: {
    label: string;
    tone: "success" | "warning" | "danger" | "neutral";
  } = useMemo(() => {
    if (budgetHealth.overBudget) return { label: "Over Budget", tone: "danger" };
    if (budgetHealth.rawPercent >= 85)
      return { label: "At Risk", tone: "warning" };
    if (budgetHealth.rawPercent >= 70) return { label: "Attention", tone: "warning" };
    return { label: "On Track", tone: "success" };
  }, [budgetHealth]);

  const issuesSectionData = useMemo(() => {
    const list = issuesList as Array<{
      id: string;
      title: string;
      description: string | null;
      severity?: string;
      priority?: string;
      status: string;
      created_at: string;
      resolved_at?: string | null;
    }>;
    return {
      openIssues: list.filter((i) => i.status !== "resolved" && !i.resolved_at),
      criticalCount: list.filter((i) => i.severity === "critical").length,
      allIssues: list,
    };
  }, [issuesList]);

  // ─── Modal state (preserved from previous impl) ───────────────────────
  const [lastSyncLabel, setLastSyncLabel] = useState<string>("");
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "" });
  const [errors, setErrors] = useState<{ description?: string; amount?: string }>({});
  const [issueForm, setIssueForm] = useState({
    title: "",
    description: "",
    priority: "medium",
  });
  const [issueErrors, setIssueErrors] = useState<Record<string, string>>({});
  const getDefaultTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };
  const ACTIVITY_TYPES = [
    "Delivery",
    "Work Completed",
    "Workers",
    "Payment",
    "Issue",
    "Photo",
    "Other",
  ] as const;
  type ActivityType = (typeof ACTIVITY_TYPES)[number];
  const emptyEntry = () => ({
    log_time: getDefaultTime(),
    activity_type: "Other" as ActivityType,
    description: "",
    amount: "",
  });
  const [dailyForm, setDailyForm] = useState({
    workerCount: "",
    entries: [emptyEntry()],
  });
  const [dailyErrors, setDailyErrors] = useState<Record<string, string>>({});
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseDescription, setEditExpenseDescription] = useState("");
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [savingExpenseEdit, setSavingExpenseEdit] = useState(false);
  const [acknowledgingIssueId, setAcknowledgingIssueId] = useState<string | null>(
    null,
  );
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoTag, setPhotoTag] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = getToken();

  // ─── Handlers (preserved) ────────────────────────────────────────────
  const handleLogExpense = async () => {
    const nextErrors: { description?: string; amount?: string } = {};
    if (!expenseForm.description.trim()) {
      nextErrors.description = "Description is required";
    }
    const amountStr = expenseForm.amount.trim();
    const amount = amountStr ? parseFloat(amountStr.replace(/,/g, "")) : NaN;
    if (!amountStr || isNaN(amount) || amount <= 0) {
      nextErrors.amount = "Please enter a valid amount";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const res = await fetch(`/api/projects/${effectiveProjectId}/expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          description: expenseForm.description.trim(),
          amount,
          expense_date: new Date().toISOString().split("T")[0],
        }),
      });
      if (!res.ok) throw new Error("Failed to log expense");
      setShowExpenseModal(false);
      setExpenseForm({ description: "", amount: "" });
      setErrors({});
      queryClient.invalidateQueries({ queryKey: [DASHBOARD_SUMMARY_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["project-expenses"] });
      toast({ title: "Expense logged" });
    } catch {
      toast({ title: "Failed to log expense", variant: "destructive" });
    }
  };

  const handleReportIssue = async () => {
    const next: Record<string, string> = {};
    if (!issueForm.title.trim()) next.title = "Issue title is required";
    setIssueErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      const res = await fetch(`/api/projects/${effectiveProjectId}/issues`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          title: issueForm.title.trim(),
          description: issueForm.description.trim(),
          priority: issueForm.priority,
          status: "open",
          reported_date: new Date().toISOString().split("T")[0],
        }),
      });
      if (!res.ok) throw new Error("Failed to report issue");
      setShowIssueModal(false);
      setIssueForm({ title: "", description: "", priority: "medium" });
      setIssueErrors({});
      queryClient.invalidateQueries({
        queryKey: [DASHBOARD_SUMMARY_QUERY_KEY, effectiveProjectId],
      });
      queryClient.invalidateQueries({ queryKey: ["issues", effectiveProjectId] });
      toast({ title: "Issue reported" });
    } catch {
      toast({ title: "Failed to report issue", variant: "destructive" });
    }
  };

  const handleAcknowledgeIssue = async (issueId: string) => {
    if (acknowledgingIssueId) return;
    setAcknowledgingIssueId(issueId);
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ status: "acknowledged" }),
      });
      if (!res.ok) throw new Error("Failed to acknowledge issue");
      await refetchIssues();
      toast({ title: "Issue acknowledged" });
    } catch {
      toast({ title: "Failed to acknowledge issue", variant: "destructive" });
    } finally {
      setAcknowledgingIssueId(null);
    }
  };

  const handleDailyLog = async () => {
    const next: Record<string, string> = {};
    const workerStr = dailyForm.workerCount.trim();
    const workerNum = workerStr ? parseInt(workerStr, 10) : NaN;
    if (!workerStr || isNaN(workerNum) || workerNum < 0) {
      next.workerCount = "Please enter the number of workers on site";
    }
    setDailyErrors(next);
    if (Object.keys(next).length > 0) return;

    const entries = dailyForm.entries.map((e) => ({
      log_time: e.log_time,
      activity_type: e.activity_type,
      description: e.description.trim(),
      amount:
        (e.activity_type === "Payment" || e.activity_type === "Delivery") && e.amount
          ? parseFloat(String(e.amount).replace(/,/g, ""))
          : null,
    }));

    try {
      const res = await fetch(`/api/daily-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          project_id: effectiveProjectId,
          log_date: new Date().toISOString().split("T")[0],
          worker_count: workerNum,
          entries,
        }),
      });
      if (!res.ok) throw new Error("Failed to save daily log");
      setShowDailyModal(false);
      setDailyForm({ workerCount: "", entries: [emptyEntry()] });
      setDailyErrors({});
      queryClient.invalidateQueries({ queryKey: [DASHBOARD_SUMMARY_QUERY_KEY] });
      toast({ title: "Daily log saved" });
    } catch {
      toast({ title: "Failed to save daily log", variant: "destructive" });
    }
  };

  const updateDailyEntry = (idx: number, field: string, value: string | number) => {
    setDailyForm((p) => ({
      ...p,
      entries: p.entries.map((e, i) => (i === idx ? { ...e, [field]: value } : e)),
    }));
  };
  const addDailyEntry = () => {
    setDailyForm((p) => ({ ...p, entries: [...p.entries, emptyEntry()] }));
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm("Delete this expense?")) return;
    const t2 = getToken();
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
        headers: t2 ? { Authorization: `Bearer ${t2}` } : {},
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete");
      }
      await refetchExpenses();
      refetch();
      toast({ title: "Expense deleted" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to delete",
        variant: "destructive",
      });
    }
  };

  const handleSaveExpenseEdit = async (expenseId: string) => {
    const description = editExpenseDescription.trim();
    const amount = parseFloat(String(editExpenseAmount).replace(/,/g, ""));
    if (!description || isNaN(amount) || amount <= 0) {
      toast({ title: "Enter valid description and amount", variant: "destructive" });
      return;
    }
    const t2 = getToken();
    setSavingExpenseEdit(true);
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(t2 ? { Authorization: `Bearer ${t2}` } : {}),
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
      await refetchExpenses();
      refetch();
      toast({ title: "Expense updated" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to update",
        variant: "destructive",
      });
    } finally {
      setSavingExpenseEdit(false);
    }
  };

  const handleUploadPhoto = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !effectiveProjectId) return;
      const url = URL.createObjectURL(file);
      setPhotoPreviewUrl(url);
      setPendingPhoto(file);
      setPhotoCaption("");
      setPhotoTag("");
    };
    input.click();
  };

  const handleCancelPhotoModal = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
    setPendingPhoto(null);
    setPhotoCaption("");
    setPhotoTag("");
  };

  const handleConfirmUploadPhoto = async () => {
    if (!pendingPhoto || !effectiveProjectId) return;
    try {
      setUploading(true);
      const photoUrl = await uploadPhotoDirectly(pendingPhoto, effectiveProjectId);
      await apiRequest("POST", `/api/projects/${effectiveProjectId}/daily/photo`, {
        photoUrl,
        caption: photoCaption.trim() || undefined,
        tag: photoTag || undefined,
      });
      queryClient.invalidateQueries({
        queryKey: [DASHBOARD_SUMMARY_QUERY_KEY, effectiveProjectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-daily", effectiveProjectId],
      });
      toast({ title: "Photo uploaded successfully" });
      handleCancelPhotoModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    const update = () => {
      if (!dataUpdatedAt) {
        setLastSyncLabel("");
        return;
      }
      const ms = Date.now() - dataUpdatedAt;
      const sec = Math.floor(ms / 1000);
      const min = Math.floor(sec / 60);
      if (sec < 60) setLastSyncLabel("Just now");
      else if (min < 60) setLastSyncLabel(`${min}m ago`);
      else setLastSyncLabel(`${Math.floor(min / 60)}h ago`);
    };
    update();
    const t = setInterval(update, 10_000);
    return () => clearInterval(t);
  }, [dataUpdatedAt]);

  // ─── Empty / loading / error states ───────────────────────────────────
  if (effectiveProjectId == null) {
    return (
      <EmptyState
        icon={Calendar}
        title="Select a Project"
        description={
          hasProjects
            ? "Choose a project from the top to see its dashboard."
            : "Get started by creating your first project. You can track budget, materials, and daily site activity — all from one place."
        }
        action={
          <Link href="/projects">
            <Button className="bg-jenga-primary hover:bg-jenga-primary-hover text-[#0D0F0E]">
              {hasProjects ? "View Projects" : "Create Project"}
            </Button>
          </Link>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-14 rounded-card bg-muted/30 jt-shimmer" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonKPI key={i} />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <SkeletonRing className="xl:col-span-1" />
          <SkeletonChart className="xl:col-span-2" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load dashboard"
        description="There was a problem loading this project's data. Check your connection and try again."
        action={
          <Button onClick={() => refetch()} variant="outline">
            Try again
          </Button>
        }
      />
    );
  }

  const summary = (summaryData as {
    schedule?: { daysAhead?: number; daysBehind?: number };
    budget?: { dailyBurnRate?: number };
  })!;
  const recentExpenses = (expenses as Array<{
    id: string;
    description: string;
    amount: number;
    created_at?: string;
    expense_date?: string;
  }>).slice(0, 6);
  const openIssuesCount = issuesSectionData.openIssues.length;
  const criticalCount = issuesSectionData.criticalCount;

  return (
    <>
      <PageHeader
        eyebrow={currentProject?.name || "Project"}
        title="Dashboard"
        description="A live snapshot of your site — budget, schedule, materials, and activity."
        meta={
          <>
            <StatusBadge
              tone={scheduleStatus.tone === "success" ? "success" : scheduleStatus.tone === "warning" ? "warning" : "danger"}
              icon={CheckCircle}
              size="sm"
            >
              {scheduleStatus.label}
            </StatusBadge>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Clock size={12} />
              Synced {lastSyncLabel || "just now"}
            </span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowExpenseModal(true)}
              className="jt-btn-primary inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-sm"
            >
              <Plus className="h-4 w-4" /> Log Expense
            </button>
            <button
              type="button"
              onClick={() => setShowIssueModal(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn border border-border bg-jenga-raised/60 hover:bg-jenga-raised text-sm text-foreground"
            >
              <AlertCircle className="h-4 w-4 text-jenga-danger" /> Report Issue
            </button>
            <button
              type="button"
              onClick={() => setShowDailyModal(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn border border-border bg-jenga-raised/60 hover:bg-jenga-raised text-sm text-foreground"
            >
              <FileText className="h-4 w-4 text-jenga-info" /> Daily Log
            </button>
            <button
              type="button"
              onClick={handleUploadPhoto}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn border border-border bg-jenga-raised/60 hover:bg-jenga-raised text-sm text-foreground disabled:opacity-60"
            >
              <Upload className="h-4 w-4 text-jenga-success" />
              {uploading ? "Uploading…" : "Upload Photo"}
            </button>
          </>
        }
      />

      {/* KPI Row — grid (never flex) so cards wrap, shrink, and never overflow. */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 w-full min-w-0 overflow-hidden">
        <KPICard
          index={0}
          label="Progress"
          value={progressInfo.total > 0 ? `${progressPct}%` : "—"}
          sub={
            progressInfo.total > 0 ? (
              <span className="flex items-center gap-1.5">
                <span className="h-1 flex-1 rounded-full bg-muted/40 overflow-hidden">
                  <span
                    className="h-full block rounded-full bg-jenga-primary transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </span>
                <span className="text-[11px] shrink-0">
                  {progressInfo.completed}/{progressInfo.total} tasks
                </span>
              </span>
            ) : (
              <span className="text-[11px]">
                Add tasks to track progress
              </span>
            )
          }
          icon={TrendingUp}
          accent="primary"
        />

        <KPICard
          index={1}
          label="Budget Used"
          value={<CurrencyValue value={budgetHealth.spent} currency={currency} compact size="xl" />}
          sub={
            budgetHealth.total > 0 ? (
              <span className="block min-w-0">
                <span className="block truncate">
                  of{" "}
                  <CurrencyValue
                    value={budgetHealth.total}
                    currency={currency}
                    compact
                    size="xs"
                    tone="muted"
                  />
                </span>
                <span
                  className={cn(
                    "block truncate font-semibold",
                    budgetHealth.overBudget
                      ? "text-jenga-danger"
                      : budgetHealth.rawPercent >= 85
                        ? "text-jenga-danger"
                        : budgetHealth.rawPercent >= 70
                          ? "text-jenga-warning"
                          : "text-jenga-success",
                  )}
                >
                  {budgetHealth.overBudget
                    ? `${budgetHealth.rawPercent.toFixed(1)}% · OVER BUDGET`
                    : `${budgetHealth.rawPercent.toFixed(1)}%`}
                </span>
              </span>
            ) : (
              <span className="block truncate text-jenga-warning">No budget set</span>
            )
          }
          icon={DollarSign}
          accent={
            budgetHealth.status === "critical"
              ? "danger"
              : budgetHealth.status === "danger"
                ? "warning"
                : budgetHealth.status === "warning"
                  ? "warning"
                  : "success"
          }
          trend={
            burn.dailyRate > 0
              ? {
                  direction: "up",
                  label: `${formatCurrency(burn.weeklyRate, currency, { compact: true })}/wk`,
                }
              : undefined
          }
        />

        <KPICard
          index={2}
          label="Schedule"
          value={
            <span className="font-display font-semibold text-base sm:text-lg md:text-xl lg:text-[22px] leading-none block truncate max-w-full">
              {scheduleStatus.label}
            </span>
          }
          sub={
            summary?.schedule?.daysAhead
              ? `${summary.schedule.daysAhead} days ahead`
              : summary?.schedule?.daysBehind
                ? `${summary.schedule.daysBehind} days behind`
                : !Number.isFinite(burn.daysRemaining)
                  ? "No burn rate yet"
                  : `${formatDaysRemaining(burn.daysRemaining)} of runway`
          }
          icon={Calendar}
          accent={scheduleStatus.tone === "success" ? "success" : scheduleStatus.tone === "warning" ? "warning" : "danger"}
        />

        <KPICard
          index={3}
          label="Active Issues"
          value={openIssuesCount}
          sub={
            criticalCount > 0 ? (
              <span className="text-jenga-danger font-semibold">
                {criticalCount} critical
              </span>
            ) : (
              "All clear"
            )
          }
          icon={AlertTriangle}
          accent={criticalCount > 0 ? "danger" : openIssuesCount > 0 ? "warning" : "success"}
          onClick={() =>
            document.getElementById("issues-section")?.scrollIntoView({ behavior: "smooth" })
          }
        />
      </section>

      {/* Middle row: ring + spend chart */}
      <section className="grid gap-6 xl:grid-cols-3 mb-8">
        {/* Budget Health Ring */}
        <div className="jt-card xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="jt-h2">Budget Health</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Live spend vs. total allocation
              </p>
            </div>
            <StatusBadge
              tone={
                budgetHealth.status === "healthy"
                  ? "success"
                  : budgetHealth.status === "warning"
                    ? "warning"
                    : budgetHealth.status === "danger"
                      ? "warning"
                      : "danger"
              }
              size="sm"
            >
              {budgetHealth.status}
            </StatusBadge>
          </div>

          <div className="flex items-center justify-center py-2">
            <BudgetRing health={budgetHealth} currency={currency} size={240} />
          </div>

          <dl className="grid grid-cols-2 gap-3 mt-4 border-t border-border/50 pt-4">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Remaining</dt>
              <dd>
                <CurrencyValue
                  value={budgetHealth.remaining}
                  currency={currency}
                  compact
                  size="sm"
                  tone={budgetHealth.remaining < 0 ? "danger" : "default"}
                />
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Daily Burn</dt>
              <dd className="flex items-center gap-1">
                <Flame size={12} className="text-jenga-primary" />
                <CurrencyValue
                  value={burn.dailyRate}
                  currency={currency}
                  compact
                  size="sm"
                />
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Weekly Burn</dt>
              <dd>
                <CurrencyValue
                  value={burn.weeklyRate}
                  currency={currency}
                  compact
                  size="sm"
                />
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Runway</dt>
              <dd className="font-mono tabular-nums text-sm text-foreground">
                {formatDaysRemaining(burn.daysRemaining)}
                {burn.isEarlyEstimate && (
                  <span className="ml-1.5 text-[10px] text-jenga-warning">est.</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Spend over time — chart owns its own legend, range selector, and
            summary strip. We keep just the title/subtitle in the card frame. */}
        <div className="jt-card xl:col-span-2">
          <div className="mb-4">
            <h2 className="jt-h2">Spend Over Time</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Daily spend and running total
            </p>
          </div>
          <SpendOverTimeChart data={spendSeries} currency={currency} />
        </div>
      </section>

      {/* Third row: category breakdown + recent activity */}
      <section className="grid gap-6 lg:grid-cols-2 mb-8">
        <div className="jt-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="jt-h2">Category Breakdown</h2>
            <Link
              href={`/budget?project=${effectiveProjectId}`}
              className="jt-link text-xs"
            >
              View Budget →
            </Link>
          </div>
          <CategoryBreakdownChart
            data={categoryTotals}
            currency={currency}
            height={200}
          />
        </div>

        <div className="jt-card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="jt-h2">Recent Expenses</h2>
            <Link
              href={`/budget?project=${effectiveProjectId}`}
              className="jt-link text-xs"
            >
              View all →
            </Link>
          </div>
          <div className="flex-1 space-y-1">
            {recentExpenses.length === 0 ? (
              <EmptyState
                title="No expenses yet"
                description="Log your first expense to see it here."
                compact
                watermark={false}
              />
            ) : (
              recentExpenses.map((expense, i) => (
                <motion.div
                  key={expense.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group flex items-center gap-3 rounded-btn px-2 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  {editingExpenseId === expense.id ? (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={editExpenseDescription}
                          onChange={(e) => setEditExpenseDescription(e.target.value)}
                          placeholder="Description"
                          className="jt-input w-full h-8 text-sm"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editExpenseAmount}
                            onChange={(e) => setEditExpenseAmount(e.target.value)}
                            placeholder="Amount"
                            className="jt-input flex-1 h-8 text-sm font-mono"
                          />
                          <Button
                            size="sm"
                            disabled={savingExpenseEdit}
                            onClick={() => handleSaveExpenseEdit(expense.id)}
                            className="h-8 bg-jenga-primary hover:bg-jenga-primary-hover text-[#0D0F0E]"
                          >
                            {savingExpenseEdit ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jenga-primary/10 text-jenga-primary group-hover:bg-jenga-primary group-hover:text-[#0D0F0E] transition-colors">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      {/* Description + time: takes remaining space and CAN shrink/truncate. */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {expense.description || "—"}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground truncate">
                          {timeAgo(expense.created_at || expense.expense_date || "")}
                        </div>
                      </div>
                      {/* Amount: NEVER shrinks, NEVER wraps, always fully visible.
                          Use compact formatting on mobile so large numbers fit. */}
                      <div className="shrink-0 text-right">
                        <CurrencyValue
                          value={expense.amount}
                          currency={currency}
                          size="sm"
                          compact
                          className="font-semibold"
                        />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-all"
                            aria-label="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingExpenseId(expense.id);
                              setEditExpenseDescription(expense.description || "");
                              setEditExpenseAmount(String(expense.amount ?? ""));
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="text-jenga-danger focus:text-jenga-danger"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Issues + quick actions */}
      <section id="issues-section" className="grid gap-6 lg:grid-cols-2 mb-4">
        <div className="jt-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="jt-h2">Issues & Risks</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Open items that need attention
              </p>
            </div>
            <StatusBadge
              tone={openIssuesCount === 0 ? "success" : criticalCount > 0 ? "danger" : "warning"}
              size="sm"
            >
              {openIssuesCount} open
            </StatusBadge>
          </div>
          <div className="space-y-2">
            {issuesSectionData.openIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mb-2 text-jenga-success" />
                <p className="text-sm">No open issues.</p>
              </div>
            ) : (
              issuesSectionData.openIssues.slice(0, 5).map((issue) => {
                const acknowledged = issue.status === "acknowledged";
                const priority = (issue as { priority?: string; severity?: string }).priority || issue.severity || "medium";
                const priorityTone =
                  priority === "critical"
                    ? "danger"
                    : priority === "high"
                      ? "warning"
                      : priority === "low"
                        ? "neutral"
                        : "info";
                return (
                  <div
                    key={issue.id}
                    className={cn(
                      "flex items-center gap-3 rounded-btn border border-border/40 bg-muted/20 px-3 py-2.5 transition-all",
                      acknowledged && "opacity-50",
                      priority === "critical" && !acknowledged && "border-jenga-danger/40 jt-pulse-amber",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => !acknowledged && handleAcknowledgeIssue(issue.id)}
                      disabled={acknowledged || acknowledgingIssueId === issue.id}
                      className="h-5 w-5 shrink-0 rounded border border-border bg-card flex items-center justify-center text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                      aria-label={acknowledged ? "Acknowledged" : "Acknowledge"}
                    >
                      {acknowledged && <Check className="h-3 w-3 text-jenga-success" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm font-medium text-foreground truncate", acknowledged && "line-through")}>
                        {issue.title}
                      </div>
                      {issue.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {issue.description}
                        </div>
                      )}
                    </div>
                    <StatusBadge tone={priorityTone as "danger" | "warning" | "info" | "neutral"} size="sm">
                      {priority}
                    </StatusBadge>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="jt-card">
          <h2 className="jt-h2 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: Plus,
                label: "Log Expense",
                accent: "primary",
                onClick: () => setShowExpenseModal(true),
              },
              {
                icon: AlertCircle,
                label: "Report Issue",
                accent: "danger",
                onClick: () => setShowIssueModal(true),
              },
              {
                icon: FileText,
                label: "Daily Log",
                accent: "info",
                onClick: () => setShowDailyModal(true),
              },
              {
                icon: Upload,
                label: uploading ? "Uploading…" : "Upload Photo",
                accent: "success",
                onClick: handleUploadPhoto,
                disabled: uploading,
              },
              {
                icon: BarChart3,
                label: "View Trends",
                accent: "secondary",
                href: `/trends?project=${effectiveProjectId}`,
              },
              {
                icon: Users,
                label: "View Projects",
                accent: "info",
                href: "/projects",
              },
            ].map((action, i) => {
              const tone = {
                primary: "text-jenga-primary hover:border-jenga-primary/40 hover:bg-jenga-primary/5",
                danger: "text-jenga-danger hover:border-jenga-danger/40 hover:bg-jenga-danger/5",
                info: "text-jenga-info hover:border-jenga-info/40 hover:bg-jenga-info/5",
                success: "text-jenga-success hover:border-jenga-success/40 hover:bg-jenga-success/5",
                secondary: "text-jenga-secondary hover:border-jenga-secondary/40 hover:bg-jenga-secondary/5",
              }[action.accent as "primary" | "danger" | "info" | "success" | "secondary"];
              const content = (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-card border border-border/60 bg-muted/20 p-5 min-h-[110px] transition-all cursor-pointer group",
                    tone,
                    action.disabled && "pointer-events-none opacity-60",
                  )}
                >
                  <div className={cn("h-10 w-10 rounded-full bg-current/10 flex items-center justify-center group-hover:scale-110 transition-transform", tone)}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {action.label}
                  </span>
                </motion.div>
              );
              return action.href ? (
                <Link key={i} href={action.href}>
                  {content}
                </Link>
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="text-left"
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Modals (preserved from original) ─────────────────────────── */}
      {showExpenseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-card rounded-modal p-6 w-full max-w-md border border-border shadow-modal"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg font-semibold text-foreground">
                Log Expense
              </h3>
              <button
                onClick={() => {
                  setShowExpenseModal(false);
                  setErrors({});
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="jt-eyebrow mb-1.5 block">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Bought 50 bags cement"
                  value={expenseForm.description}
                  onChange={(e) => {
                    setExpenseForm((p) => ({ ...p, description: e.target.value }));
                    setErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                  className="jt-input w-full h-11"
                />
                {errors.description && (
                  <p className="text-jenga-danger text-xs mt-1">{errors.description}</p>
                )}
              </div>
              <div>
                <label className="jt-eyebrow mb-1.5 block">Amount ({currency})</label>
                <input
                  type="text"
                  placeholder="e.g. 500,000"
                  value={expenseForm.amount}
                  onChange={(e) => {
                    setExpenseForm((p) => ({ ...p, amount: e.target.value }));
                    setErrors((prev) => ({ ...prev, amount: undefined }));
                  }}
                  className="jt-input w-full h-11 font-mono"
                />
                {errors.amount && (
                  <p className="text-jenga-danger text-xs mt-1">{errors.amount}</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => {
                  setShowExpenseModal(false);
                  setErrors({});
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 bg-jenga-primary hover:bg-jenga-primary-hover text-[#0D0F0E] font-semibold"
                onClick={handleLogExpense}
              >
                Save Expense
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {showIssueModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-card rounded-modal p-6 w-full max-w-md border border-border shadow-modal"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg font-semibold text-foreground">
                Report Issue
              </h3>
              <button
                onClick={() => {
                  setShowIssueModal(false);
                  setIssueErrors({});
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="jt-eyebrow mb-1.5 block">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Foundation delay"
                  value={issueForm.title}
                  onChange={(e) => {
                    setIssueForm((p) => ({ ...p, title: e.target.value }));
                    setIssueErrors((prev) => ({ ...prev, title: "" }));
                  }}
                  className="jt-input w-full h-11"
                />
                {issueErrors.title && (
                  <p className="text-jenga-danger text-xs mt-1">{issueErrors.title}</p>
                )}
              </div>
              <div>
                <label className="jt-eyebrow mb-1.5 block">Description</label>
                <textarea
                  placeholder="Details about the issue…"
                  value={issueForm.description}
                  onChange={(e) =>
                    setIssueForm((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={3}
                  className="jt-input w-full resize-none"
                />
              </div>
              <div>
                <label className="jt-eyebrow mb-1.5 block">Priority</label>
                <select
                  value={issueForm.priority}
                  onChange={(e) =>
                    setIssueForm((p) => ({ ...p, priority: e.target.value }))
                  }
                  className="jt-input w-full h-11"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => {
                  setShowIssueModal(false);
                  setIssueErrors({});
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 bg-jenga-danger hover:bg-jenga-danger/90 text-white font-semibold"
                onClick={handleReportIssue}
              >
                Report Issue
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {pendingPhoto && photoPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-modal p-6 w-full max-w-md border border-border shadow-modal"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-foreground">
                Add photo details
              </h3>
              <button
                type="button"
                onClick={handleCancelPhotoModal}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <div className="rounded-card overflow-hidden bg-muted border border-border mb-4 aspect-video">
              <img
                src={photoPreviewUrl}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-4">
              <div>
                <label className="jt-eyebrow mb-1.5 block">Caption (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. North wall progress"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  className="jt-input w-full h-11"
                />
              </div>
              <div>
                <label className="jt-eyebrow mb-1.5 block">Tag</label>
                <div className="flex flex-wrap gap-2">
                  {PHOTO_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setPhotoTag(photoTag === tag ? "" : tag)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                        photoTag === tag
                          ? "bg-jenga-primary text-[#0D0F0E]"
                          : "bg-muted border border-border text-muted-foreground hover:border-jenga-primary/40 hover:text-foreground",
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1 h-11" onClick={handleCancelPhotoModal}>
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 bg-jenga-success hover:bg-jenga-success/90 text-white font-semibold"
                onClick={handleConfirmUploadPhoto}
                disabled={uploading}
              >
                {uploading ? "Uploading…" : "Upload Photo"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {showDailyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-card rounded-modal p-6 w-full max-w-lg border border-border shadow-modal my-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-foreground">
                Daily Site Log
              </h3>
              <button
                onClick={() => {
                  setShowDailyModal(false);
                  setDailyErrors({});
                  setDailyForm({ workerCount: "", entries: [emptyEntry()] });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <div className="text-muted-foreground text-xs font-mono mb-4 pb-3 border-b border-border">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
            <div className="mb-5">
              <label className="jt-eyebrow mb-1.5 block">Workers on site</label>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={dailyForm.workerCount}
                onChange={(e) => {
                  setDailyForm((p) => ({ ...p, workerCount: e.target.value }));
                  setDailyErrors((prev) => ({ ...prev, workerCount: "" }));
                }}
                className="jt-input w-full h-11 font-mono"
              />
              {dailyErrors.workerCount && (
                <p className="text-jenga-danger text-xs mt-1">{dailyErrors.workerCount}</p>
              )}
            </div>
            <div className="space-y-4 mb-5">
              <label className="jt-eyebrow block">Timeline entries</label>
              {dailyForm.entries.map((entry, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-card bg-muted/30 border border-border space-y-3"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="time"
                      value={entry.log_time}
                      onChange={(e) => updateDailyEntry(idx, "log_time", e.target.value)}
                      className="jt-input h-9 text-sm font-mono"
                    />
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {ACTIVITY_TYPES.map((tp) => (
                        <button
                          key={tp}
                          type="button"
                          onClick={() => updateDailyEntry(idx, "activity_type", tp)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                            entry.activity_type === tp
                              ? "bg-jenga-primary text-[#0D0F0E]"
                              : "bg-muted border border-border text-muted-foreground hover:border-jenga-primary/40",
                          )}
                        >
                          {tp}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="What happened?"
                    value={entry.description}
                    onChange={(e) => updateDailyEntry(idx, "description", e.target.value)}
                    className="jt-input w-full h-9 text-sm"
                  />
                  {(entry.activity_type === "Payment" || entry.activity_type === "Delivery") && (
                    <input
                      type="text"
                      placeholder={`Amount in ${currency}`}
                      value={entry.amount}
                      onChange={(e) => updateDailyEntry(idx, "amount", e.target.value)}
                      className="jt-input w-full h-9 text-sm font-mono"
                    />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addDailyEntry}
                className="flex items-center gap-1.5 text-xs text-jenga-primary hover:text-jenga-primary-hover font-medium"
              >
                <Plus className="h-3.5 w-3.5" /> Add another entry
              </button>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => {
                  setShowDailyModal(false);
                  setDailyErrors({});
                  setDailyForm({ workerCount: "", entries: [emptyEntry()] });
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 bg-jenga-info hover:bg-jenga-info/90 text-white font-semibold"
                onClick={handleDailyLog}
              >
                Save Log
              </Button>
            </div>
          </motion.div>
        </div>
      )}

    </>
  );
}
