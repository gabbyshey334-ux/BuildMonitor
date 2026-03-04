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
    dailyBurnRate: number;
    weeklyBurnRate: number;
    weeksRemaining: number;
  };
  schedule: {
    status: "On Track" | "At Risk" | "Delayed";
    daysAhead: number;
    daysBehind: number;
  };
  progress: {
    overallPercentage: number;
    phases: Array<{ name: string; percentage: number; status: "completed" | "in-progress" | "not-started" }>;
    milestones: Array<{ id: string; title: string; due_date: string; status: string }>;
  };
  issues: { total: number; critical: number };
  insights: {
    topDelayCause: string | null;
    mostUsedMaterial: string | null;
    recentHighlight: string | null;
    progressTrend: Array<{ date: string; value: number }>;
    dailyCostBurn: Array<{ date: string; amount: number }>;
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
    onTimeStatus: {
      isDelayed: boolean;
      daysDelayed: number;
      scheduleStatus?: "On Track" | "At Risk" | "Delayed";
      daysAhead?: number;
    };
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
    staleTime: 0,
    refetchInterval: 30000,
    enabled: !!projectId,
  });
}

export interface ProjectExpensesResponse {
  success: boolean;
  summary: {
    total: number;
    spent: number;
    remaining: number;
    percentage: number;
    dailyBurnRate: number;
    weeklyBurnRate: number;
    weeksRemaining: number | null;
  };
  byCategory: Array<{
    category: string;
    total: number;
    count: number;
    percentage: number;
  }>;
  byMonth: Array<{ month: string; amount: number }>;
  thisWeekTotal?: number;
  lastWeekTotal?: number;
  recent: Array<{
    id: string;
    description: string;
    amount: number;
    category: string;
    expense_date: string;
    vendor: string | null;
    source: string | null;
    created_at: string;
    disputed: boolean;
  }>;
  vendors: Array<{ name: string; total: number; count: number }>;
}

export function useProjectExpenses(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-expenses", projectId],
    queryFn: async (): Promise<ProjectExpensesResponse> => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/expenses`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch expenses");
      }
      return data as ProjectExpensesResponse;
    },
    enabled: !!projectId,
    staleTime: 30000,
    refetchInterval: 30000,
  });
}

export interface ProjectMaterialsResponse {
  success: boolean;
  inventory: Array<{
    id: string;
    material_name: string;
    quantity: number;
    unit: string;
    last_updated: string | null;
  }>;
  lowStock: Array<{ material_name: string; quantity: number; unit: string }>;
  usage: Array<{ material_name: string; used: number; received: number }>;
  summary: {
    totalItems: number;
    lowStockCount: number;
    lastUpdated: string | null;
  };
}

export function useProjectMaterials(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-materials", projectId],
    queryFn: async (): Promise<ProjectMaterialsResponse> => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/materials`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch materials");
      }
      return data as ProjectMaterialsResponse;
    },
    enabled: !!projectId,
    staleTime: 30000,
    refetchInterval: 30000,
  });
}

export interface ProjectDailyResponse {
  success: boolean;
  heatmap: Array<{
    date: string;
    active: boolean;
    workerCount: number;
    hasNotes: boolean;
  }>;
  recentLogs: Array<{
    id: string;
    log_date: string;
    worker_count: number | null;
    notes: string | null;
    weather_condition: string | null;
    photo_urls: string[];
    created_at: string;
  }>;
  stats: {
    totalActiveDays: number;
    currentStreak: number;
    avgWorkerCount: number;
    totalPhotos: number;
    thisWeekActive: number;
  };
  today: {
    active: boolean;
    workerCount: number;
    notes: string;
    photos: string[];
  };
}

export function useProjectDaily(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-daily", projectId],
    queryFn: async (): Promise<ProjectDailyResponse> => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/daily`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch daily logs");
      }
      return data as ProjectDailyResponse;
    },
    enabled: !!projectId,
    staleTime: 30000,
    refetchInterval: 30000,
  });
}

export interface ProjectTrendsResponse {
  success: boolean;
  spending: {
    byMonth: Array<{ month: string; amount: number }>;
    byWeek: Array<{ week: string; amount: number }>;
    trend: "increasing" | "decreasing" | "stable";
    projectedCompletion: string | null;
  };
  workers: {
    byDay: Array<{ date: string; count: number }>;
    average: number;
    peak: number;
    trend: "increasing" | "decreasing" | "stable";
  };
  materials: {
    mostUsed: Array<{ name: string; quantity: number; unit: string }>;
    topVendors: Array<{ name: string; total: number }>;
  };
  alerts: Array<{
    type: "price_anomaly" | "low_stock" | "budget_warning" | "inactivity";
    message: string;
    severity: "low" | "medium" | "high";
    date: string;
  }>;
  predictions: {
    estimatedCompletion: string | null;
    budgetRunout: string | null;
    weeklyBurnRate: number;
  };
}

export function useProjectTrends(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-trends", projectId],
    queryFn: async (): Promise<ProjectTrendsResponse> => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/trends`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch trends");
      }
      return data as ProjectTrendsResponse;
    },
    enabled: !!projectId,
    staleTime: 30000,
    refetchInterval: 30000,
  });
}
