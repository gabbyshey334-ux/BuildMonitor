import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus, Upload, AlertCircle, FileText, X, RefreshCw,
  TrendingUp, Calendar, Clock, ArrowUpRight, CheckCircle,
  AlertTriangle, DollarSign, Activity, ChevronRight, BarChart3
} from 'lucide-react';
import { useProjectSummary, useProjectTasks, useProjectExpenses, DASHBOARD_SUMMARY_QUERY_KEY } from '@/hooks/useDashboard';
import { useProject } from '@/contexts/ProjectContext';
import { useProjects } from '@/hooks/useProjects';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { getToken } from '@/lib/authToken';
import { useToast } from '@/hooks/use-toast';
import { uploadPhotoDirectly } from '@/lib/uploadPhoto';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

// Helper for currency formatting
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper for time ago
const timeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

interface DashboardPageProps {
  projectId?: string | null;
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 animate-pulse">
      <div className="h-10 bg-muted rounded w-64 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-card rounded-xl border border-border" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-card rounded-xl border border-border" />
        <div className="h-96 bg-card rounded-xl border border-border" />
      </div>
    </div>
  );
}

export default function DashboardPage({ projectId: projectIdProp }: DashboardPageProps) {
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const effectiveProjectId = projectIdProp ?? currentProject?.id ?? null;

  const {
    data: summaryData,
    isLoading,
    isError,
    error,
    refetch,
    dataUpdatedAt,
  } = useProjectSummary(effectiveProjectId);

  const { data: tasksData } = useProjectTasks(effectiveProjectId);
  const { data: expensesData } = useProjectExpenses(effectiveProjectId);
  const { data: issuesData } = useQuery({
    queryKey: ['issues', effectiveProjectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${effectiveProjectId}/issues`);
      return res.json();
    },
    enabled: !!effectiveProjectId,
    refetchInterval: 30000,
  });
  const tasks = Array.isArray(tasksData) ? tasksData : (tasksData as any)?.tasks ?? [];
  const expenses = (expensesData as any)?.recent ?? (expensesData as any)?.expenses ?? [];
  const issuesList = issuesData?.issues ?? [];

  const budgetHealth = useMemo(() => {
    const budget = parseFloat(String((summaryData as any)?.budget?.total ?? currentProject?.budget ?? 0));
    const spent = expenses?.reduce((s: number, e: any) => s + parseFloat(String(e.amount || 0)), 0) ?? (summaryData as any)?.budget?.spent ?? 0;
    if (!budget) return { pct: 0, remaining: 0, total: 0, spent: spent };
    return {
      pct: parseFloat(((spent / budget) * 100).toFixed(1)),
      remaining: Math.max(0, budget - spent),
      total: budget,
      spent: spent
    };
  }, [currentProject, summaryData, expenses]);

  const progressPct = useMemo(() => {
    const completedTasks = tasks?.filter((t: any) => t.status === 'completed').length ?? 0;
    const totalTasks = tasks?.length ?? 0;
    if (totalTasks > 0) return Math.round((completedTasks / totalTasks) * 100);
    if (expenses?.length > 0) return Math.min(Math.round((expenses.length / 20) * 100), 95);
    return 0;
  }, [tasks, expenses]);

  const scheduleStatusFromTasks = useMemo((): 'On Track' | 'Slight Delay' | 'Behind Schedule' => {
    if (!tasks || tasks.length === 0) return 'On Track';
    const overdue = tasks.filter((t: any) =>
      t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date()
    ).length;
    if (overdue === 0) return 'On Track';
    if (overdue <= 2) return 'Slight Delay';
    return 'Behind Schedule';
  }, [tasks]);

  const issuesSectionData = useMemo(() => {
    const list = issuesList as Array<{ id: string; title: string; description: string | null; severity?: string; type?: string; status: string; created_at: string; resolved_at?: string | null }>;
    return {
      openIssues: list.filter((i) => i.status !== 'resolved' && !i.resolved_at),
      criticalCount: list.filter((i) => i.severity === 'critical').length,
      allIssues: list
    };
  }, [issuesList]);

  const [lastSyncLabel, setLastSyncLabel] = useState<string>('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' });
  const [issueForm, setIssueForm] = useState({ title: '', description: '', priority: 'medium' });
  const [dailyForm, setDailyForm] = useState({ workerCount: '', notes: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = getToken();

  const handleLogExpense = async () => {
    if (!expenseForm.description.trim() || !expenseForm.amount.trim()) return;
    try {
      const amount = parseFloat(expenseForm.amount.replace(/,/g, ''));
      if (isNaN(amount)) {
        toast({ title: 'Invalid amount', variant: 'destructive' });
        return;
      }
      const res = await fetch(`/api/projects/${effectiveProjectId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({
          description: expenseForm.description.trim(),
          amount,
          expense_date: new Date().toISOString().split('T')[0],
        }),
      });
      if (!res.ok) throw new Error('Failed to log expense');
      setShowExpenseModal(false);
      setExpenseForm({ description: '', amount: '' });
      queryClient.invalidateQueries({ queryKey: ['api/projects/summary'] });
      queryClient.invalidateQueries({ queryKey: ['project-expenses'] });
      toast({ title: 'Expense logged! ✅' });
    } catch {
      toast({ title: 'Failed to log expense', variant: 'destructive' });
    }
  };

  const handleReportIssue = async () => {
    if (!issueForm.title.trim()) return;
    try {
      const res = await fetch(`/api/projects/${effectiveProjectId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({
          title: issueForm.title.trim(),
          description: issueForm.description.trim(),
          priority: issueForm.priority,
          status: 'open',
          reported_date: new Date().toISOString().split('T')[0],
        }),
      });
      if (!res.ok) throw new Error('Failed to report issue');
      setShowIssueModal(false);
      setIssueForm({ title: '', description: '', priority: 'medium' });
      queryClient.invalidateQueries({ queryKey: [DASHBOARD_SUMMARY_QUERY_KEY, effectiveProjectId] });
      queryClient.invalidateQueries({ queryKey: ['issues', effectiveProjectId] });
      toast({ title: 'Issue reported! 🚩' });
    } catch {
      toast({ title: 'Failed to report issue', variant: 'destructive' });
    }
  };

  const handleDailyLog = async () => {
    if (!dailyForm.workerCount.trim() && !dailyForm.notes.trim()) return;
    try {
      const res = await fetch(`/api/projects/${effectiveProjectId}/daily/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({
          worker_count: parseInt(dailyForm.workerCount, 10) || 0,
          notes: dailyForm.notes.trim(),
          log_date: new Date().toISOString().split('T')[0],
        }),
      });
      if (!res.ok) throw new Error('Failed to save daily log');
      setShowDailyModal(false);
      setDailyForm({ workerCount: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['api/projects/summary'] });
      toast({ title: 'Daily log saved! ✅' });
    } catch {
      toast({ title: 'Failed to save daily log', variant: 'destructive' });
    }
  };

  const handleUploadPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !effectiveProjectId) return;
      try {
        setUploading(true);
        const photoUrl = await uploadPhotoDirectly(file, effectiveProjectId);
        await apiRequest('POST', `/api/projects/${effectiveProjectId}/daily/photo`, { photoUrl });
        queryClient.invalidateQueries({ queryKey: [DASHBOARD_SUMMARY_QUERY_KEY, effectiveProjectId] });
        queryClient.invalidateQueries({ queryKey: ['project-daily', effectiveProjectId] });
        toast({ title: 'Photo uploaded successfully!' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        toast({ title: 'Upload failed', description: message, variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  useEffect(() => {
    const update = () => {
      if (!dataUpdatedAt) {
        setLastSyncLabel('');
        return;
      }
      const ms = Date.now() - dataUpdatedAt;
      const sec = Math.floor(ms / 1000);
      const min = Math.floor(sec / 60);
      if (sec < 60) setLastSyncLabel('Just now');
      else if (min < 60) setLastSyncLabel(`${min}m ago`);
      else setLastSyncLabel(`${Math.floor(min / 60)}h ago`);
    };
    update();
    const t = setInterval(update, 10000);
    return () => clearInterval(t);
  }, [dataUpdatedAt]);

  if (effectiveProjectId == null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full bg-card border-border">
          <CardContent className="pt-6 text-center">
            <h2 className="text-2xl font-bold mb-2 text-foreground">Select a Project</h2>
            <p className="text-muted-foreground mb-6">
              {hasProjects ? 'Please select a project to view its dashboard.' : 'Get started by creating your first project.'}
            </p>
            <Button asChild className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-semibold">
              <Link href="/projects">
                <a>{hasProjects ? 'View Projects' : 'Create Project'}</a>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">Error loading dashboard</h2>
          <Button onClick={() => refetch()} variant="outline" className="border-border text-foreground">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const summary = summaryData!;
  const recentExpenses = expenses.slice(0, 6);
  const openIssuesCount = issuesSectionData.openIssues.length;
  const criticalCount = issuesSectionData.criticalCount;

  // Donut chart calculation
  const donutRadius = 70;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutStrokeDashoffset = donutCircumference - (Math.min(budgetHealth.pct, 100) / 100) * donutCircumference;
  const donutColor = budgetHealth.pct > 100 ? '#ef4444' : budgetHealth.pct > 80 ? '#f59e0b' : '#00bcd4';

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      {/* 1. Header Row */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{currentProject?.name || 'Project Dashboard'}</h1>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm">
            <Clock className="w-4 h-4" />
            <span>Last updated: {lastSyncLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border hover:border-[#00bcd4]/50 hover:bg-[#00bcd4]/10 transition-all group"
          >
            <div className="w-6 h-6 rounded-full bg-[#00bcd4]/20 flex items-center justify-center group-hover:bg-[#00bcd4] transition-colors">
              <Plus className="w-4 h-4 text-[#00bcd4] group-hover:text-black" />
            </div>
            <span className="font-medium text-sm">Log Expense</span>
          </button>
          <button
            onClick={() => setShowIssueModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border hover:border-[#ef4444]/50 hover:bg-[#ef4444]/10 transition-all group"
          >
            <div className="w-6 h-6 rounded-full bg-[#ef4444]/20 flex items-center justify-center group-hover:bg-[#ef4444] transition-colors">
              <AlertCircle className="w-4 h-4 text-[#ef4444] group-hover:text-black" />
            </div>
            <span className="font-medium text-sm">Report Issue</span>
          </button>
          <button
            onClick={() => setShowDailyModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border hover:border-[#3b82f6]/50 hover:bg-[#3b82f6]/10 transition-all group"
          >
            <div className="w-6 h-6 rounded-full bg-[#3b82f6]/20 flex items-center justify-center group-hover:bg-[#3b82f6] transition-colors">
              <FileText className="w-4 h-4 text-[#3b82f6] group-hover:text-white" />
            </div>
            <span className="font-medium text-sm">Daily Log</span>
          </button>
        </div>
      </header>

      {/* 2. KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Progress Card */}
        <div className="relative bg-card rounded-xl border border-border p-5 hover:scale-[1.02] transition-transform duration-300 overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#00bcd4] opacity-[0.08] blur-2xl rounded-full -mr-10 -mt-10 pointer-events-none transition-opacity" />
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 rounded-lg bg-[#00bcd4]/10 text-[#00bcd4]">
              <TrendingUp className="w-5 h-5" />
            </div>
            {tasks.length > 0 && <span className="text-xs font-medium text-[#00bcd4] bg-[#00bcd4]/10 px-2 py-1 rounded-full">Active</span>}
          </div>
          <div className="mt-2">
            <span className="text-3xl font-bold text-foreground">{progressPct}%</span>
            <span className="text-muted-foreground text-sm ml-2">Complete</span>
          </div>
          <div className="w-full bg-muted h-1 mt-4 rounded-full overflow-hidden">
            <div className="bg-[#00bcd4] h-full rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Budget Card */}
        <div className="relative bg-card rounded-xl border border-border p-5 hover:scale-[1.02] transition-transform duration-300 overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500 opacity-[0.08] blur-2xl rounded-full -mr-10 -mt-10 pointer-events-none transition-opacity" />
          <div className="flex justify-between items-start mb-2">
            <div className={`p-2 rounded-lg ${budgetHealth.pct > 100 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${budgetHealth.pct > 90 ? 'text-red-400 bg-red-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
              {budgetHealth.pct}% Used
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-bold text-foreground">{formatCurrency(budgetHealth.spent)}</span>
          </div>
          <p className="text-muted-foreground text-xs mt-1">of {formatCurrency(budgetHealth.total)} total budget</p>
        </div>

        {/* Schedule Card */}
        <div className="relative bg-card rounded-xl border border-border p-5 hover:scale-[1.02] transition-transform duration-300 overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500 opacity-[0.08] blur-2xl rounded-full -mr-10 -mt-10 pointer-events-none transition-opacity" />
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Calendar className="w-5 h-5" />
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${scheduleStatusFromTasks === 'On Track' ? 'text-emerald-400 bg-emerald-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
              {scheduleStatusFromTasks}
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-foreground">{scheduleStatusFromTasks}</span>
          </div>
          <p className="text-muted-foreground text-xs mt-1">
            {summary.schedule?.daysAhead ? `${summary.schedule.daysAhead} days ahead` : summary.schedule?.daysBehind ? `${summary.schedule.daysBehind} days behind` : 'On schedule'}
          </p>
        </div>

        {/* Issues Card */}
        <div className="relative bg-card rounded-xl border border-border p-5 hover:scale-[1.02] transition-transform duration-300 overflow-hidden group" onClick={() => document.getElementById('issues-section')?.scrollIntoView({ behavior: 'smooth' })}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500 opacity-[0.08] blur-2xl rounded-full -mr-10 -mt-10 pointer-events-none transition-opacity" />
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            {criticalCount > 0 && (
              <span className="text-xs font-medium text-red-400 bg-red-400/10 px-2 py-1 rounded-full animate-pulse">
                {criticalCount} Critical
              </span>
            )}
          </div>
          <div className="mt-2">
            <span className="text-3xl font-bold text-foreground">{openIssuesCount}</span>
            <span className="text-muted-foreground text-sm ml-2">Active Issues</span>
          </div>
          <p className="text-muted-foreground text-xs mt-1 cursor-pointer hover:text-[#00bcd4] flex items-center gap-1">
            View details <ArrowUpRight className="w-3 h-3" />
          </p>
        </div>
      </div>

      {/* 3. Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Budget Breakdown - 2/3 */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-foreground">Budget Breakdown</h3>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#00bcd4]" />
              <span className="text-xs text-muted-foreground">Spent</span>
              <div className="w-3 h-3 rounded-full bg-zinc-700 ml-2" />
              <span className="text-xs text-muted-foreground">Remaining</span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* SVG Donut */}
            <div className="relative w-48 h-48 shrink-0">
              <svg width="100%" height="100%" viewBox="0 0 160 160" className="transform -rotate-90">
                <circle cx="80" cy="80" r={donutRadius} fill="transparent" stroke="currentColor" className="text-muted" strokeWidth="12" />
                <circle
                  cx="80"
                  cy="80"
                  r={donutRadius}
                  fill="transparent"
                  stroke={donutColor}
                  strokeWidth="12"
                  strokeDasharray={donutCircumference}
                  strokeDashoffset={donutStrokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-foreground">{budgetHealth.pct}%</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Used</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Total Spent</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(budgetHealth.spent)}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-[#00bcd4]/10 flex items-center justify-center text-[#00bcd4]">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted border border-border">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Remaining Budget</p>
                  <p className="text-2xl font-bold text-foreground/80">{formatCurrency(budgetHealth.remaining)}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Weekly Burn Rate</span>
                  <span>{formatCurrency(summary.budget?.dailyBurnRate ? summary.budget.dailyBurnRate * 7 : 0)} / week</span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: '45%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity - 1/3 */}
        <div className="bg-card rounded-xl border border-border p-6 flex flex-col h-full">
          <h3 className="text-lg font-bold text-foreground mb-4">Recent Activity</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[300px] lg:max-h-none scrollbar-thin scrollbar-thumb-zinc-700">
            {recentExpenses.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No recent activity</p>
            ) : (
              recentExpenses.map((expense: any) => (
                <div key={expense.id} className="flex gap-3 group">
                  <div className="mt-1 w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border group-hover:border-[#00bcd4]/30 transition-colors">
                    <DollarSign className="w-4 h-4 text-muted-foreground group-hover:text-[#00bcd4]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-foreground/80 transition-colors">
                      {expense.description}
                    </p>
                    <p className="text-xs text-muted-foreground">{timeAgo(expense.expense_date || expense.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-[#00bcd4]">
                      {formatCurrency(expense.amount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <Button variant="ghost" className="w-full mt-4 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50">
            View All Activity <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* 4. Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="issues-section">
        {/* Issues List */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">Issues & Risks</h3>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full border border-border">
              {issuesSectionData.openIssues.length} Open
            </span>
          </div>
          <div className="space-y-3">
            {issuesSectionData.openIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
                <p>No open issues</p>
              </div>
            ) : (
              issuesSectionData.openIssues.slice(0, 4).map((issue) => (
                <div key={issue.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted border border-border hover:bg-muted/80 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    issue.priority === 'critical' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                    issue.priority === 'high' ? 'bg-amber-500' :
                    'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground truncate">{issue.title}</h4>
                    <p className="text-xs text-muted-foreground truncate">{issue.description}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                      issue.priority === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      issue.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {issue.priority}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setShowExpenseModal(true)}
              className="flex flex-col items-center justify-center p-6 rounded-xl bg-muted border border-border hover:bg-[#22c55e]/10 hover:border-[#22c55e]/30 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-[#22c55e]/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-[#22c55e]" />
              </div>
              <span className="font-medium text-foreground group-hover:text-[#22c55e] transition-colors">Log Expense</span>
            </button>

            <button
              onClick={() => setShowIssueModal(true)}
              className="flex flex-col items-center justify-center p-6 rounded-xl bg-muted border border-border hover:bg-[#ef4444]/10 hover:border-[#ef4444]/30 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-[#ef4444]/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <AlertCircle className="w-6 h-6 text-[#ef4444]" />
              </div>
              <span className="font-medium text-foreground group-hover:text-[#ef4444] transition-colors">Report Issue</span>
            </button>

            <button
              onClick={() => setShowDailyModal(true)}
              className="flex flex-col items-center justify-center p-6 rounded-xl bg-muted border border-border hover:bg-[#3b82f6]/10 hover:border-[#3b82f6]/30 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-[#3b82f6]/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-[#3b82f6]" />
              </div>
              <span className="font-medium text-foreground group-hover:text-[#3b82f6] transition-colors">Daily Log</span>
            </button>

            <Link href="/trends">
              <a className="flex flex-col items-center justify-center p-6 rounded-xl bg-muted border border-border hover:bg-[#8b5cf6]/10 hover:border-[#8b5cf6]/30 transition-all group h-full">
                <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-6 h-6 text-[#8b5cf6]" />
                </div>
                <span className="font-medium text-foreground group-hover:text-[#8b5cf6] transition-colors">View Trends</span>
              </a>
            </Link>
          </div>
        </div>
      </div>

      {/* Modals - Kept exactly as before but with dark theme wrappers if needed */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-card rounded-xl p-6 w-full max-w-md border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-foreground font-bold text-xl">Log Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-muted-foreground text-sm font-medium mb-2 block">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Bought 50 bags cement"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#00bcd4] placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-sm font-medium mb-2 block">Amount (UGX)</label>
                <input
                  type="text"
                  placeholder="e.g. 500,000"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#00bcd4] placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <Button type="button" variant="outline" className="flex-1 border-border hover:bg-muted hover:text-foreground text-muted-foreground h-12" onClick={() => setShowExpenseModal(false)}>Cancel</Button>
              <Button type="button" className="flex-1 bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold h-12" onClick={handleLogExpense}>Save Expense</Button>
            </div>
          </div>
        </div>
      )}

      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-card rounded-xl p-6 w-full max-w-md border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-foreground font-bold text-xl">Report Issue</h3>
              <button onClick={() => setShowIssueModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-muted-foreground text-sm font-medium mb-2 block">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Foundation delay"
                  value={issueForm.title}
                  onChange={(e) => setIssueForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#ef4444] placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-sm font-medium mb-2 block">Description</label>
                <textarea
                  placeholder="Details about the issue..."
                  value={issueForm.description}
                  onChange={(e) => setIssueForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#ef4444] placeholder:text-muted-foreground resize-none"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-sm font-medium mb-2 block">Priority</label>
                <select
                  value={issueForm.priority}
                  onChange={(e) => setIssueForm((p) => ({ ...p, priority: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#ef4444]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <Button type="button" variant="outline" className="flex-1 border-border hover:bg-muted hover:text-foreground text-muted-foreground h-12" onClick={() => setShowIssueModal(false)}>Cancel</Button>
              <Button type="button" className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold h-12" onClick={handleReportIssue}>Report Issue</Button>
            </div>
          </div>
        </div>
      )}

      {showDailyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-card rounded-xl p-6 w-full max-w-md border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-foreground font-bold text-xl">Daily Log</h3>
              <button onClick={() => setShowDailyModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-muted-foreground text-sm font-medium mb-2 block">Workers on site</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={dailyForm.workerCount}
                  onChange={(e) => setDailyForm((p) => ({ ...p, workerCount: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#3b82f6] placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-sm font-medium mb-2 block">Notes</label>
                <textarea
                  placeholder="e.g. Foundation 80% complete, rain delayed work..."
                  value={dailyForm.notes}
                  onChange={(e) => setDailyForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#3b82f6] placeholder:text-muted-foreground resize-none"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <Button type="button" variant="outline" className="flex-1 border-border hover:bg-muted hover:text-foreground text-muted-foreground h-12" onClick={() => setShowDailyModal(false)}>Cancel</Button>
              <Button type="button" className="flex-1 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-bold h-12" onClick={handleDailyLog}>Save Log</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
