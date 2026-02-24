import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const DASHBOARD_SUMMARY_QUERY_KEY = "api/projects/summary";

export interface ProjectSummaryResponse {
  success: boolean;
  project: {
    id: string;
    name: string;
    budget_amount: string | null;
    status: string;
    created_at: string;
  };
  budget: {
    total: number;
    spent: number;
    remaining: number;
    percentage: number;
    weeklyBurnRate: number;
    weeksRemaining: number;
  };
  expenses: {
    total: number;
    recent: Array<{
      id: string;
      description: string;
      amount: number;
      category: string;
      expense_date: string;
      created_at: string;
    }>;
    byCategory: Array<{ category: string; total: number }>;
  };
  materials: {
    inventory: Array<{ material_name: string; quantity: number; unit: string }>;
    lowStock: Array<{ material_name: string; quantity: number; unit: string }>;
  };
  dailyLog: {
    todayActive: boolean;
    workerCount: number;
    recentPhotos: string[];
    streak: number;
  };
  activity: {
    heatmap: Array<{ date: string; active: boolean; workerCount: number }>;
    recentUpdates: Array<{
      log_date: string;
      worker_count: number | null;
      notes: string | null;
      weather_condition: string | null;
    }>;
  };
  summaryHealth?: {
    overallProgress: number;
    onTimeStatus: { isDelayed: boolean; daysDelayed: number };
    budgetHealth: { percent: number; remaining: number };
    activeIssues: { total: number; critical: number };
  };
  budgetSection?: Record<string, unknown>;
  progressSection?: Record<string, unknown>;
  inventorySection?: Record<string, unknown>;
  issuesSection?: Record<string, unknown>;
  mediaSection?: Record<string, unknown>;
  trendsSection?: Record<string, unknown>;
}

async function fetchProjectSummary(projectId: string): Promise<ProjectSummaryResponse> {
  const res = await apiRequest("GET", `/api/projects/${projectId}/summary`);
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to fetch project summary");
  }
  return data as ProjectSummaryResponse;
}

/**
 * Fetches the full dashboard summary for a project.
 * Refetches every 30 seconds (staleTime: 30000).
 */
export function useProjectSummary(projectId: string | null | undefined) {
  return useQuery({
    queryKey: [DASHBOARD_SUMMARY_QUERY_KEY, projectId],
    queryFn: () => fetchProjectSummary(projectId!),
    staleTime: 30 * 1000,
    enabled: !!projectId,
  });
}
