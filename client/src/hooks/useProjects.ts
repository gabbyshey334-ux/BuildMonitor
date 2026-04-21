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
  currency?: string | null;
  status: string;
  totalSpent?: string | number;
  /**
   * Whether this project has a budget configured. When false, ProjectCard
   * shows "No budget set" instead of a misleading percentage bar.
   */
  hasBudget?: boolean;
  lastActivity?: string | null;
  /**
   * @deprecated The list endpoint no longer returns a progress field; it used
   * to return budget-used-% masquerading as construction progress (see
   * Investigation 1 RC #3). Kept here only so a stale server during rollout
   * can be consumed without crashing; the value is ignored on the client.
   */
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

function mapApiProjectToProject(api: ApiProject): Project {
  const budgetRaw =
    api.budget != null
      ? parseFloat(String(api.budget))
      : api.budgetAmount != null
        ? parseFloat(String(api.budgetAmount))
        : 0;
  const budget = Number.isFinite(budgetRaw) && budgetRaw > 0 ? budgetRaw : 0;
  const spentRaw = api.totalSpent != null ? parseFloat(String(api.totalSpent)) : 0;
  const spent = Number.isFinite(spentRaw) && spentRaw > 0 ? spentRaw : 0;
  return {
    id: api.id,
    name: api.name,
    location: api.description?.trim() || undefined,
    totalBudget: budget > 0 ? budget : undefined,
    spentAmount: spent,
    // NOTE: intentionally NOT reading api.progress — see @deprecated above.
    // Without a real milestone source, no progress value is trustworthy.
    progress: undefined,
    currency: api.currency ?? undefined,
    lastActivityAt: api.lastActivity ? String(api.lastActivity) : undefined,
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
