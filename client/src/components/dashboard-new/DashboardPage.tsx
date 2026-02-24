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
                <a>← Go to My Projects</a>
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
  const summaryHealth = summary.summaryHealth ?? {
    overallProgress: 0,
    onTimeStatus: { isDelayed: false, daysDelayed: 0 },
    budgetHealth: { percent: 0, remaining: 0 },
    activeIssues: { total: 0, critical: 0 },
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <section className="mb-8">
        <h1 className="text-3xl font-bold mb-6">Project Dashboard</h1>
        <ProjectHealthSummary data={summaryHealth} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ProgressScheduleSection data={summary.progressSection as any} />
          <BudgetCostsSection data={summary.budgetSection as any} />
          <MaterialsInventorySection data={summary.inventorySection as any} />
          <IssuesRisksSection data={summary.issuesSection as any} />
          <SiteReportsMediaSection data={summary.mediaSection as any} />
        </div>

        <div className="space-y-6">
          <TrendsQuickInsightsSection data={summary.trendsSection as any} />
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
