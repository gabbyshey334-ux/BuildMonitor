import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateProjectQueries } from "@/lib/queryClient";

/** How often to sync dashboard data while the app is open (WhatsApp / other writers). */
const POLL_MS = 4000;

function refreshProjectData(client: QueryClient, projectId: string) {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return;
  }
  invalidateProjectQueries(client, projectId);
}

/**
 * Keeps Budgets, Materials, Daily, Trends, Issues, and dashboard summary in sync
 * with the server without a full page reload (e.g. after WhatsApp logs data).
 */
export function useProjectLiveRefresh(projectId: string | null | undefined) {
  const client = useQueryClient();
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const tick = () => refreshProjectData(client, projectId);
    idRef.current = projectId;

    const interval = setInterval(tick, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible" && idRef.current) {
        refreshProjectData(client, idRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      idRef.current = null;
    };
  }, [client, projectId]);
}
