import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Upload, AlertCircle, FileText } from 'lucide-react';
import { useProjectSummary } from '@/hooks/useDashboard';
import { useProject } from '@/contexts/ProjectContext';
import { useProjects } from '@/hooks/useProjects';

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

  const [lastSyncLabel, setLastSyncLabel] = useState<string>('');
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
    overallProgress: summary.progress?.overallPercentage ?? summary.summaryHealth?.overallProgress ?? 0,
    onTimeStatus: {
      isDelayed: summary.schedule?.status === 'Delayed',
      daysDelayed: summary.schedule?.daysBehind ?? summary.summaryHealth?.onTimeStatus?.daysDelayed ?? 0,
      scheduleStatus: summary.schedule?.status,
      daysAhead: summary.schedule?.daysAhead,
    },
    budgetHealth: {
      percent: summary.budget?.percentage ?? summary.summaryHealth?.budgetHealth?.percent ?? 0,
      remaining: summary.budget?.remaining ?? summary.summaryHealth?.budgetHealth?.remaining ?? 0,
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
          {lastSyncLabel && (
            <p className="text-sm dark:text-zinc-500 text-slate-500">
              Last updated: {lastSyncLabel}
            </p>
          )}
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
              <Button className="w-full justify-start dark:text-white dark:border-white/20 dark:hover:bg-white/10 text-slate-800 border-slate-200 hover:bg-slate-100" variant="outline" asChild>
                <Link href={effectiveProjectId ? `/budget?project=${effectiveProjectId}` : "/budget"}>
                  <a>
                    <Plus className="w-4 h-4 mr-2" />
                    Log Expense
                  </a>
                </Link>
              </Button>
              <Button className="w-full justify-start dark:text-white dark:border-white/20 dark:hover:bg-white/10 text-slate-800 border-slate-200 hover:bg-slate-100" variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </Button>
              <Button className="w-full justify-start dark:text-white dark:border-white/20 dark:hover:bg-white/10 text-slate-800 border-slate-200 hover:bg-slate-100" variant="outline">
                <AlertCircle className="w-4 h-4 mr-2" />
                Report Issue
              </Button>
              <Button className="w-full justify-start dark:text-white dark:border-white/20 dark:hover:bg-white/10 text-slate-800 border-slate-200 hover:bg-slate-100" variant="outline" asChild>
                <Link href={effectiveProjectId ? `/daily?project=${effectiveProjectId}` : "/daily"}>
                  <a>
                    <FileText className="w-4 h-4 mr-2" />
                    Daily Log
                  </a>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
