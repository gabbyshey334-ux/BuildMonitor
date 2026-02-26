import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Project } from "@/contexts/ProjectContext";

export const PROJECTS_QUERY_KEY = ["api", "projects"] as const;

/** API project shape from GET /api/projects */
interface ApiProject {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  budget?: string | number | null;
  budgetAmount?: string | null;
  status: string;
  totalSpent?: string;
  lastActivity?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

function mapApiProjectToProject(api: ApiProject): Project {
  const budget = api.budget != null ? parseFloat(String(api.budget)) : (api.budgetAmount != null ? parseFloat(String(api.budgetAmount)) : 0);
  const spent = api.totalSpent != null ? parseFloat(String(api.totalSpent)) : 0;
  return {
    id: api.id,
    name: api.name,
    location: api.description?.trim() || undefined,
    totalBudget: Number.isFinite(budget) ? budget : undefined,
    spentAmount: Number.isFinite(spent) ? spent : 0,
    lastActivityAt: api.lastActivity || undefined,
    status: api.status === "completed" ? "completed" : "active",
  };
}

async function fetchProjects(): Promise<Project[]> {
  const res = await apiRequest("GET", "/api/projects");
  const data = await res.json();
  if (!data.success || !Array.isArray(data.projects)) {
    throw new Error(data.error || "Failed to fetch projects");
  }
  return (data.projects as ApiProject[]).map(mapApiProjectToProject);
}

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: fetchProjects,
    staleTime: 60 * 1000,
  });
}

export function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
}
