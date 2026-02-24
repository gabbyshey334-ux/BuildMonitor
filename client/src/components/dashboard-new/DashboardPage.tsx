import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Upload, AlertCircle, FileText } from 'lucide-react';
import { useProjectSummary } from '@/hooks/useDashboard';
import { useProject } from '@/contexts/ProjectContext';

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
    <div className="min-h-screen bg-background p-6 animate-pulse">
      <div className="h-9 bg-muted rounded w-64 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 bg-muted rounded-lg" />
          <div className="h-96 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
        <div className="space-y-6">
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage({ projectId: projectIdProp }: DashboardPageProps) {
  const { currentProject } = useProject();
  const effectiveProjectId = projectIdProp ?? currentProject?.id ?? null;

  const {
    data: summaryData,
    isLoading,
    isError,
    error,
    refetch,
  } = useProjectSummary(effectiveProjectId);

  if (effectiveProjectId == null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-2xl font-bold mb-2">No project selected</h2>
            <p className="text-muted-foreground mb-4">
              Select a project from the list or go to My Projects to get started.
            </p>
            <Button asChild>
              <Link href="/projects">
                <a>← Back to My Projects</a>
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
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-2xl font-bold mb-2 text-destructive">Error loading dashboard</h2>
            <p className="text-muted-foreground mb-4">
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
    <div className="min-h-screen bg-background p-6">
      <section className="mb-8">
        <h1 className="text-3xl font-bold mb-6">Project Dashboard</h1>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/budget">
                  <a>
                    <Plus className="w-4 h-4 mr-2" />
                    Log Expense
                  </a>
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <AlertCircle className="w-4 h-4 mr-2" />
                Report Issue
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/daily">
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
