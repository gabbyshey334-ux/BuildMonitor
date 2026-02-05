import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Upload, AlertCircle, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getToken } from '@/lib/authToken';

// Import individual dashboard sections
import { ProjectHealthSummary } from './ProjectHealthSummary';
import { ProgressScheduleSection } from './ProgressScheduleSection';
import { BudgetCostsSection } from './BudgetCostsSection';
import { MaterialsInventorySection } from './MaterialsInventorySection';
import { IssuesRisksSection } from './IssuesRisksSection';
import { SiteReportsMediaSection } from './SiteReportsMediaSection';
import { TrendsQuickInsightsSection } from './TrendsQuickInsightsSection';

interface DashboardPageProps {
  projectId?: string;
}

export default function DashboardPage({ projectId }: DashboardPageProps = {}) {
  // Helper to get auth headers - defined inside component to avoid hoisting issues
  const getAuthHeaders = React.useCallback(() => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  // Define fetcher functions inside component to use projectId prop
  const fetchSummary = React.useCallback(async () => {
    const url = projectId ? `/api/dashboard/summary?projectId=${projectId}` : '/api/dashboard/summary';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch summary');
    }
    const data = await res.json();
    return data;
  }, [projectId, getAuthHeaders]);

  const fetchProgress = React.useCallback(async () => {
    const url = projectId ? `/api/dashboard/progress?projectId=${projectId}` : '/api/dashboard/progress';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch progress');
    }
    const data = await res.json();
    return data;
  }, [projectId, getAuthHeaders]);

  const fetchBudget = React.useCallback(async () => {
    const url = projectId ? `/api/dashboard/budget?projectId=${projectId}` : '/api/dashboard/budget';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch budget');
    }
    const data = await res.json();
    return data;
  }, [projectId, getAuthHeaders]);

  const fetchInventory = React.useCallback(async () => {
    const url = projectId ? `/api/dashboard/inventory?projectId=${projectId}` : '/api/dashboard/inventory';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch inventory');
    }
    const data = await res.json();
    return data;
  }, [projectId, getAuthHeaders]);

  const fetchIssues = React.useCallback(async () => {
    const url = projectId ? `/api/dashboard/issues?projectId=${projectId}` : '/api/dashboard/issues';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch issues');
    }
    const data = await res.json();
    return data;
  }, [projectId, getAuthHeaders]);

  const fetchMedia = React.useCallback(async () => {
    const url = projectId ? `/api/dashboard/media?projectId=${projectId}` : '/api/dashboard/media';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch media');
    }
    const data = await res.json();
    return data;
  }, [projectId, getAuthHeaders]);

  const fetchTrends = React.useCallback(async () => {
    const url = projectId ? `/api/dashboard/trends?projectId=${projectId}` : '/api/dashboard/trends';
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch trends');
    }
    const data = await res.json();
    return data;
  }, [projectId]);

  const { data: summaryData, isLoading: isLoadingSummary, isError: isErrorSummary, error: errorSummary } = useQuery({ 
    queryKey: ['dashboardSummary', projectId], 
    queryFn: fetchSummary,
    retry: 2,
    retryDelay: 1000,
    enabled: !!projectId, // Only fetch if projectId is provided
  });
  const { data: progressData, isLoading: isLoadingProgress, isError: isErrorProgress, error: errorProgress } = useQuery({ 
    queryKey: ['dashboardProgress', projectId], 
    queryFn: fetchProgress,
    retry: 2,
    retryDelay: 1000,
    enabled: !!projectId,
  });
  const { data: budgetData, isLoading: isLoadingBudget, isError: isErrorBudget, error: errorBudget } = useQuery({ 
    queryKey: ['dashboardBudget', projectId], 
    queryFn: fetchBudget,
    retry: 2,
    retryDelay: 1000,
    enabled: !!projectId,
  });
  const { data: inventoryData, isLoading: isLoadingInventory, isError: isErrorInventory, error: errorInventory } = useQuery({ 
    queryKey: ['dashboardInventory', projectId], 
    queryFn: fetchInventory,
    retry: 2,
    retryDelay: 1000,
    enabled: !!projectId,
  });
  const { data: issuesData, isLoading: isLoadingIssues, isError: isErrorIssues, error: errorIssues } = useQuery({ 
    queryKey: ['dashboardIssues', projectId], 
    queryFn: fetchIssues,
    retry: 2,
    retryDelay: 1000,
    enabled: !!projectId,
  });
  const { data: mediaData, isLoading: isLoadingMedia, isError: isErrorMedia, error: errorMedia } = useQuery({ 
    queryKey: ['dashboardMedia', projectId], 
    queryFn: fetchMedia,
    retry: 2,
    retryDelay: 1000,
    enabled: !!projectId,
  });
  const { data: trendsData, isLoading: isLoadingTrends, isError: isErrorTrends, error: errorTrends } = useQuery({ 
    queryKey: ['dashboardTrends', projectId], 
    queryFn: fetchTrends,
    retry: 2,
    retryDelay: 1000,
    enabled: !!projectId,
  });

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

  if (!projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">No Project Selected</h2>
            <p className="text-muted-foreground mb-4">
              Please select a project from the projects list to view the dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center text-alert-red">
              <AlertCircle className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Error Loading Dashboard</h2>
              <p className="text-muted-foreground mb-4">{errorMessage}</p>
              <div className="space-y-2">
                <Button onClick={() => window.location.reload()} className="w-full">
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
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

