import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Upload, AlertCircle, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// Import individual dashboard sections
import { ProjectHealthSummary } from './ProjectHealthSummary';
import { ProgressScheduleSection } from './ProgressScheduleSection';
import { BudgetCostsSection } from './BudgetCostsSection';
import { MaterialsInventorySection } from './MaterialsInventorySection';
import { IssuesRisksSection } from './IssuesRisksSection';
import { SiteReportsMediaSection } from './SiteReportsMediaSection';
import { TrendsQuickInsightsSection } from './TrendsQuickInsightsSection';

// Define fetcher functions for each endpoint
const fetchSummary = async () => {
  const res = await fetch('/api/dashboard/summary');
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
};

const fetchProgress = async () => {
  const res = await fetch('/api/dashboard/progress');
  if (!res.ok) throw new Error('Failed to fetch progress');
  return res.json();
};

const fetchBudget = async () => {
  const res = await fetch('/api/dashboard/budget');
  if (!res.ok) throw new Error('Failed to fetch budget');
  return res.json();
};

const fetchInventory = async () => {
  const res = await fetch('/api/dashboard/inventory');
  if (!res.ok) throw new Error('Failed to fetch inventory');
  return res.json();
};

const fetchIssues = async () => {
  const res = await fetch('/api/dashboard/issues');
  if (!res.ok) throw new Error('Failed to fetch issues');
  return res.json();
};

const fetchMedia = async () => {
  const res = await fetch('/api/dashboard/media');
  if (!res.ok) throw new Error('Failed to fetch media');
  return res.json();
};

const fetchTrends = async () => {
  const res = await fetch('/api/dashboard/trends');
  if (!res.ok) throw new Error('Failed to fetch trends');
  return res.json();
};

export default function DashboardPage() {
  const { data: summaryData, isLoading: isLoadingSummary, isError: isErrorSummary, error: errorSummary } = useQuery({ queryKey: ['dashboardSummary'], queryFn: fetchSummary });
  const { data: progressData, isLoading: isLoadingProgress, isError: isErrorProgress, error: errorProgress } = useQuery({ queryKey: ['dashboardProgress'], queryFn: fetchProgress });
  const { data: budgetData, isLoading: isLoadingBudget, isError: isErrorBudget, error: errorBudget } = useQuery({ queryKey: ['dashboardBudget'], queryFn: fetchBudget });
  const { data: inventoryData, isLoading: isLoadingInventory, isError: isErrorInventory, error: errorInventory } = useQuery({ queryKey: ['dashboardInventory'], queryFn: fetchInventory });
  const { data: issuesData, isLoading: isLoadingIssues, isError: isErrorIssues, error: errorIssues } = useQuery({ queryKey: ['dashboardIssues'], queryFn: fetchIssues });
  const { data: mediaData, isLoading: isLoadingMedia, isError: isErrorMedia, error: errorMedia } = useQuery({ queryKey: ['dashboardMedia'], queryFn: fetchMedia });
  const { data: trendsData, isLoading: isLoadingTrends, isError: isErrorTrends, error: errorTrends } = useQuery({ queryKey: ['dashboardTrends'], queryFn: fetchTrends });

  const isLoading = isLoadingSummary || isLoadingProgress || isLoadingBudget || isLoadingInventory || isLoadingIssues || isLoadingMedia || isLoadingTrends;
  const isError = isErrorSummary || isErrorProgress || isErrorBudget || isErrorInventory || isErrorIssues || isErrorMedia || isErrorTrends;
  const errorMessage = (
    errorSummary?.message ||
    errorProgress?.message ||
    errorBudget?.message ||
    errorInventory?.message ||
    errorIssues?.message ||
    errorMedia?.message ||
    errorTrends?.message ||
    'An unknown error occurred'
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center text-alert-red">
          <AlertCircle className="w-16 h-16 mx-auto mb-4" />
          <p className="text-2xl font-bold mb-2">Error Loading Dashboard</p>
          <p className="text-lg">{errorMessage}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Hero Section - Project Health */}
      <section className="mb-8">
        <h1 className="text-3xl font-bold mb-6">Project Dashboard</h1>
        <ProjectHealthSummary data={summaryData?.summary} />
      </section>

      {/* Main Content - 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Sections (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress & Schedule */}
          <ProgressScheduleSection data={progressData} />
          
          {/* Budget & Costs */}
          <BudgetCostsSection data={budgetData} />
          
          {/* Materials & Inventory */}
          <MaterialsInventorySection data={inventoryData} />
          
          {/* Issues & Risks */}
          <IssuesRisksSection data={issuesData} />
          
          {/* Site Reports & Media */}
          <SiteReportsMediaSection data={mediaData} />
        </div>

        {/* Right Sidebar - Trends & Insights (1/3 width) */}
        <div className="space-y-6">
          <TrendsQuickInsightsSection data={trendsData} />
          
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Log Expense
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <AlertCircle className="w-4 h-4 mr-2" />
                Report Issue
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                Daily Log
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

