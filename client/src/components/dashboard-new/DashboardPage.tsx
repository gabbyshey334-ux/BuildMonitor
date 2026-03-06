import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Upload, AlertCircle, FileText, X, RefreshCw } from 'lucide-react';
import { useProjectSummary, useProjectTasks, useProjectExpenses, DASHBOARD_SUMMARY_QUERY_KEY } from '@/hooks/useDashboard';
import { useProject } from '@/contexts/ProjectContext';
import { useProjects } from '@/hooks/useProjects';
import { useQueryClient } from '@tanstack/react-query';
import { getToken } from '@/lib/authToken';
import { useToast } from '@/hooks/use-toast';

import { ProjectHealthSummary } from './ProjectHealthSummary';
import { ProgressScheduleSection } from './ProgressScheduleSection';
import { BudgetCostsSection } from './BudgetCostsSection';
import { MaterialsInventorySection } from './MaterialsInventorySection';
import { IssuesRisksSection } from './IssuesRisksSection';
import { SiteReportsMediaSection } from './SiteReportsMediaSection';
import { TrendsQuickInsightsSection } from './TrendsQuickInsightsSection';

interface DashboardPageProps {
  projectId?: string | null;
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen dark:bg-[#0a0a0a] bg-slate-50 p-6 animate-pulse">
      <div className="h-9 dark:bg-zinc-800 bg-slate-200 rounded w-64 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 dark:bg-zinc-800/50 bg-slate-200 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 dark:bg-zinc-800/50 bg-slate-200 rounded-lg" />
          <div className="h-96 dark:bg-zinc-800/50 bg-slate-200 rounded-lg" />
          <div className="h-64 dark:bg-zinc-800/50 bg-slate-200 rounded-lg" />
        </div>
        <div className="space-y-6">
          <div className="h-48 dark:bg-zinc-800/50 bg-slate-200 rounded-lg" />
        </div>
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
  const tasks = Array.isArray(tasksData) ? tasksData : (tasksData as any)?.tasks ?? [];
  const expenses = (expensesData as any)?.recent ?? (expensesData as any)?.expenses ?? [];

  const budgetHealth = useMemo(() => {
    const budget = parseFloat(String(currentProject?.budget ?? (summaryData as any)?.budget?.total ?? 0));
    const spent = expenses?.reduce((s: number, e: any) => s + parseFloat(String(e.amount || 0)), 0) || 0;
    if (!budget) return { pct: 0, remaining: 0 };
    return {
      pct: Math.min(100, Math.round((spent / budget) * 100)),
      remaining: Math.max(0, budget - spent),
    };
  }, [currentProject, summaryData, expenses]);

  const progressPct = useMemo(() => {
    if (tasks && tasks.length > 0) {
      const completed = tasks.filter((t: any) => t.status === 'completed').length;
      return Math.round((completed / tasks.length) * 100);
    }
    const dailyLogs = (summaryData as any)?.activity?.recentUpdates ?? [];
    if (dailyLogs.length > 0) return Math.min(95, dailyLogs.length * 2);
    return 0;
  }, [tasks, summaryData]);

  const [lastSyncLabel, setLastSyncLabel] = useState<string>('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
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
      queryClient.invalidateQueries({ queryKey: ['api', 'projects'] });
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
      queryClient.invalidateQueries({ queryKey: ['api/projects/summary'] });
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
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        try {
          const res = await fetch(`/api/projects/${effectiveProjectId}/daily/photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            credentials: 'include',
            body: JSON.stringify({ photoUrl: dataUrl }),
          });
          if (!res.ok) throw new Error('Upload failed');
          queryClient.invalidateQueries({ queryKey: ['api/projects/summary'] });
          toast({ title: 'Photo saved to daily log! 📸' });
        } catch {
          toast({ title: 'Upload failed', variant: 'destructive' });
        }
      };
      reader.readAsDataURL(file);
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
      if (sec < 60) setLastSyncLabel('just now');
      else if (min === 1) setLastSyncLabel('1 minute ago');
      else if (min < 60) setLastSyncLabel(`${min} minutes ago`);
      else setLastSyncLabel(`${Math.floor(min / 60)} hour(s) ago`);
    };
    update();
    const t = setInterval(update, 10000);
    return () => clearInterval(t);
  }, [dataUpdatedAt]);

  if (effectiveProjectId == null) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-[#0a0a0a] bg-slate-50 p-6">
        <Card className="max-w-md w-full dark:bg-[#1e2235] dark:border-zinc-700 bg-white border-slate-200">
          <CardContent className="pt-6 text-center">
            <h2 className="text-2xl font-bold mb-2 dark:text-white text-slate-800">
              {hasProjects ? 'No project selected' : 'Create your first project'}
            </h2>
            <p className="dark:text-[#CBD5E1] text-slate-600 mb-4">
              {hasProjects
                ? 'Select a project from the list or go to My Projects to get started.'
                : 'Get started by creating your first project.'}
            </p>
            <Button asChild>
              <Link href="/projects">
                <a>{hasProjects ? '← Back to My Projects' : 'Create your first project'}</a>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-[#0a0a0a] bg-slate-50 p-6">
        <Card className="max-w-md w-full dark:bg-[#1e2235] dark:border-zinc-700 bg-white border-slate-200">
          <CardContent className="pt-6 text-center">
            <h2 className="text-2xl font-bold mb-2 text-destructive">Error loading dashboard</h2>
            <p className="dark:text-[#CBD5E1] text-slate-600 mb-4">
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </p>
            <Button onClick={() => refetch()}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = summaryData!;
  const summaryHealth = {
    overallProgress: progressPct ?? summary.progress?.overallPercentage ?? summary.summaryHealth?.overallProgress ?? 0,
    onTimeStatus: {
      isDelayed: summary.schedule?.status === 'Delayed',
      daysDelayed: summary.schedule?.daysBehind ?? summary.summaryHealth?.onTimeStatus?.daysDelayed ?? 0,
      scheduleStatus: summary.schedule?.status,
      daysAhead: summary.schedule?.daysAhead,
    },
    budgetHealth: {
      percent: budgetHealth.pct || summary.budget?.percentage ?? summary.summaryHealth?.budgetHealth?.percent ?? 0,
      remaining: budgetHealth.remaining ?? summary.budget?.remaining ?? summary.summaryHealth?.budgetHealth?.remaining ?? 0,
    },
    activeIssues: {
      total: summary.issues?.total ?? summary.summaryHealth?.activeIssues?.total ?? 0,
      critical: summary.issues?.critical ?? summary.summaryHealth?.activeIssues?.critical ?? 0,
    },
    schedule: summary.schedule,
  };

  // Map API progress.phases (status "not-started") to UI "pending" for ProgressScheduleSection
  const progressSectionData = summary.progressSection
    ? summary.progressSection
    : summary.progress
      ? {
          phases: summary.progress.phases.map((p, i) => ({
            id: String(i + 1),
            name: p.name,
            percentComplete: p.percentage,
            status: (p.status === 'not-started' ? 'pending' : p.status) as 'pending' | 'in-progress' | 'completed',
          })),
          upcomingMilestones: (summary.progress.milestones ?? []).map((m) => ({
            id: m.id,
            title: m.title,
            dueDate: new Date(m.due_date),
            priority: 'medium' as const,
          })),
        }
      : undefined;

  const trendsSectionData = summary.trendsSection ?? (summary.insights && summary.budget
    ? {
        progressTrend: summary.insights.progressTrend ?? [],
        costBurnTrend: (summary.insights.dailyCostBurn ?? []).map((p) => ({ date: p.date, value: p.amount })),
        dailyBurnRate: summary.budget.dailyBurnRate ?? 0,
        insights: [
          ...(summary.insights.topDelayCause ? [{ id: '1', text: `Top delay cause: ${summary.insights.topDelayCause}` }] : []),
          ...(summary.insights.mostUsedMaterial ? [{ id: '2', text: `Most used material: ${summary.insights.mostUsedMaterial}` }] : []),
          ...(summary.insights.recentHighlight ? [{ id: '3', text: summary.insights.recentHighlight }] : []),
        ],
        topDelayCause: summary.insights.topDelayCause,
        mostUsedMaterial: summary.insights.mostUsedMaterial,
        recentHighlight: summary.insights.recentHighlight,
      }
    : undefined);

  return (
    <div className="min-h-screen dark:bg-[#0a0a0a] bg-slate-50 p-6">
      <section className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold dark:text-white text-slate-800">Project Dashboard</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetch();
                queryClient.invalidateQueries({ queryKey: [DASHBOARD_SUMMARY_QUERY_KEY] });
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
                queryClient.invalidateQueries({ queryKey: ['project-expenses'] });
                queryClient.invalidateQueries({ queryKey: ['project-daily'] });
                queryClient.invalidateQueries({ queryKey: ['project-materials'] });
              }}
              className="dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            {lastSyncLabel && (
              <p className="text-sm dark:text-zinc-500 text-slate-500">
                Last updated: {lastSyncLabel}
              </p>
            )}
          </div>
        </div>
        <ProjectHealthSummary data={summaryHealth} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ProgressScheduleSection data={progressSectionData} />
          <BudgetCostsSection data={summary.budgetSection} />
          <MaterialsInventorySection data={summary.inventorySection} />
          <IssuesRisksSection data={summary.issuesSection} />
          <SiteReportsMediaSection data={summary.mediaSection} />
        </div>

        <div className="space-y-6">
          <TrendsQuickInsightsSection data={trendsSectionData} />
          <Card className="dark:bg-[#1e2235] dark:border-zinc-700 bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg dark:text-white text-slate-800 font-bold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full justify-start dark:text-white dark:border-white/20 dark:hover:bg-white/10 text-slate-800 border-slate-200 hover:bg-slate-100"
                variant="outline"
                onClick={() => setShowExpenseModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Log Expense
              </Button>
              <Button
                className="w-full justify-start dark:text-white dark:border-white/20 dark:hover:bg-white/10 text-slate-800 border-slate-200 hover:bg-slate-100"
                variant="outline"
                onClick={handleUploadPhoto}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </Button>
              <Button
                className="w-full justify-start dark:text-white dark:border-white/20 dark:hover:bg-white/10 text-slate-800 border-slate-200 hover:bg-slate-100"
                variant="outline"
                onClick={() => setShowIssueModal(true)}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Report Issue
              </Button>
              <Button
                className="w-full justify-start dark:text-white dark:border-white/20 dark:hover:bg-white/10 text-slate-800 border-slate-200 hover:bg-slate-100"
                variant="outline"
                onClick={() => setShowDailyModal(true)}
              >
                <FileText className="w-4 h-4 mr-2" />
                Daily Log
              </Button>
            </CardContent>
          </Card>

          {showExpenseModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="dark:bg-[#1e2235] bg-white rounded-xl p-6 w-full max-w-md mx-4 dark:border-zinc-700 border-slate-200 border shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="dark:text-white text-slate-900 font-semibold text-lg">Log Expense</h3>
                  <button type="button" onClick={() => setShowExpenseModal(false)} className="dark:text-zinc-400 text-slate-500 hover:text-red-500">
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="dark:text-zinc-300 text-slate-700 text-sm mb-1 block">Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Bought 50 bags cement"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg dark:bg-zinc-800 bg-slate-50 dark:border-zinc-700 border-slate-200 border dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="dark:text-zinc-300 text-slate-700 text-sm mb-1 block">Amount (UGX)</label>
                    <input
                      type="text"
                      placeholder="e.g. 500,000"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg dark:bg-zinc-800 bg-slate-50 dark:border-zinc-700 border-slate-200 border dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowExpenseModal(false)}>Cancel</Button>
                  <Button type="button" className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white" onClick={handleLogExpense}>Save Expense</Button>
                </div>
              </div>
            </div>
          )}

          {showIssueModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="dark:bg-[#1e2235] bg-white rounded-xl p-6 w-full max-w-md mx-4 dark:border-zinc-700 border-slate-200 border shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="dark:text-white text-slate-900 font-semibold text-lg">Report Issue</h3>
                  <button type="button" onClick={() => setShowIssueModal(false)} className="dark:text-zinc-400 text-slate-500 hover:text-red-500">
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="dark:text-zinc-300 text-slate-700 text-sm mb-1 block">Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Foundation delay"
                      value={issueForm.title}
                      onChange={(e) => setIssueForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg dark:bg-zinc-800 bg-slate-50 dark:border-zinc-700 border-slate-200 border dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="dark:text-zinc-300 text-slate-700 text-sm mb-1 block">Description</label>
                    <textarea
                      placeholder="Optional details"
                      value={issueForm.description}
                      onChange={(e) => setIssueForm((p) => ({ ...p, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg dark:bg-zinc-800 bg-slate-50 dark:border-zinc-700 border-slate-200 border dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="dark:text-zinc-300 text-slate-700 text-sm mb-1 block">Priority</label>
                    <select
                      value={issueForm.priority}
                      onChange={(e) => setIssueForm((p) => ({ ...p, priority: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg dark:bg-zinc-800 bg-slate-50 dark:border-zinc-700 border-slate-200 border dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowIssueModal(false)}>Cancel</Button>
                  <Button type="button" className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white" onClick={handleReportIssue}>Report Issue</Button>
                </div>
              </div>
            </div>
          )}

          {showDailyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="dark:bg-[#1e2235] bg-white rounded-xl p-6 w-full max-w-md mx-4 dark:border-zinc-700 border-slate-200 border shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="dark:text-white text-slate-900 font-semibold text-lg">Daily Log</h3>
                  <button type="button" onClick={() => setShowDailyModal(false)} className="dark:text-zinc-400 text-slate-500 hover:text-red-500">
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="dark:text-zinc-300 text-slate-700 text-sm mb-1 block">Workers on site</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={dailyForm.workerCount}
                      onChange={(e) => setDailyForm((p) => ({ ...p, workerCount: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg dark:bg-zinc-800 bg-slate-50 dark:border-zinc-700 border-slate-200 border dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="dark:text-zinc-300 text-slate-700 text-sm mb-1 block">Notes</label>
                    <textarea
                      placeholder="e.g. Foundation 80% complete"
                      value={dailyForm.notes}
                      onChange={(e) => setDailyForm((p) => ({ ...p, notes: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg dark:bg-zinc-800 bg-slate-50 dark:border-zinc-700 border-slate-200 border dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowDailyModal(false)}>Cancel</Button>
                  <Button type="button" className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white" onClick={handleDailyLog}>Save Log</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
