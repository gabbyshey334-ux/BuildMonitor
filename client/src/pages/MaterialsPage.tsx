"use client";

import React from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectMaterials } from "@/hooks/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowLeft } from "lucide-react";

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function MaterialsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 dark:bg-zinc-800 bg-slate-200 rounded w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 dark:bg-zinc-800/50 bg-slate-100 rounded-lg" />
        ))}
      </div>
      <div className="h-64 dark:bg-zinc-800/50 bg-slate-100 rounded-lg" />
      <div className="h-32 dark:bg-zinc-800/50 bg-slate-100 rounded-lg" />
    </div>
  );
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="py-8 px-4 text-center">
      <p className="dark:text-zinc-400 text-slate-600 text-sm font-medium">{message}</p>
      {hint && <p className="dark:text-zinc-500 text-slate-500 text-xs mt-2 max-w-sm mx-auto">{hint}</p>}
    </div>
  );
}

export default function MaterialsPage() {
  const [, setLocation] = useLocation();
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const search = typeof window !== "undefined" ? window.location.search : "";
  const projectId = new URLSearchParams(search).get("project") ?? currentProject?.id ?? null;

  const { data, isLoading, isError, error, refetch } = useProjectMaterials(projectId);

  if (!projectId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-2">Materials & Inventory</h1>
          <p className="dark:text-zinc-400 text-slate-500 mb-4">
            {hasProjects
              ? "No project selected. Select a project from the sidebar or dashboard."
              : "Create your first project to track materials and inventory."}
          </p>
          <Button
            onClick={() => setLocation("/projects")}
            className="dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800/50 dark:hover:border-zinc-600 border-slate-300 text-slate-700 hover:bg-slate-100 bg-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {hasProjects ? "Back to Projects" : "Create your first project"}
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-6">Materials & Inventory</h1>
          <MaterialsSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="py-16 px-4 text-center">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-2">Materials & Inventory</h1>
          <p className="dark:text-zinc-400 text-slate-500 mb-4">{error instanceof Error ? error.message : "Something went wrong."}</p>
          <Button
            onClick={() => refetch()}
            className="dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800/50 dark:hover:border-zinc-600 border-slate-300 text-slate-700 hover:bg-slate-100 bg-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { inventory, lowStock, summary } = data!;
  const maxQty = inventory.length ? Math.max(...inventory.map((m) => m.quantity), 1) : 1;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-6">Materials & Inventory</h1>

        {inventory.length === 0 ? (
          <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
            <CardContent className="pt-6">
              <EmptyState
                message="No materials tracked yet."
                hint="Send 'Received 50 bags cement' or 'Used 5 bags for foundation' via WhatsApp to start tracking."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm dark:text-zinc-500 text-slate-500 mb-1">Total Materials</p>
                  <p className="text-2xl font-bold dark:text-white text-slate-800">{summary.totalItems}</p>
                </CardContent>
              </Card>
              <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm dark:text-zinc-500 text-slate-500 mb-1">Low Stock Items</p>
                  <p className={`text-2xl font-bold ${summary.lowStockCount > 0 ? "text-red-500" : "dark:text-white text-slate-800"}`}>
                    {summary.lowStockCount}
                  </p>
                </CardContent>
              </Card>
              <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm dark:text-zinc-500 text-slate-500 mb-1">Last Updated</p>
                  <p className="text-lg font-medium dark:text-white text-slate-800">{formatDate(summary.lastUpdated)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Low stock alerts */}
            <Card className="border-border bg-card mb-6">
              <CardHeader>
                <CardTitle className="dark:text-white text-slate-800 font-bold">Low Stock Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {lowStock.length > 0 ? (
                  <div className="space-y-3">
                    {lowStock.map((m) => (
                      <div
                        key={m.material_name}
                        className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                      >
                        <span className="font-medium dark:text-white text-slate-800">{m.material_name}</span>
                        <span className="text-red-500 text-sm font-semibold">
                          {m.quantity} {m.unit}
                        </span>
                      </div>
                    ))}
                    <p className="dark:text-zinc-400 text-slate-500 text-sm">Consider restocking these materials.</p>
                  </div>
                ) : (
                  <p className="dark:text-zinc-400 text-slate-500 text-sm font-medium">All materials well stocked</p>
                )}
              </CardContent>
            </Card>

            {/* Inventory list */}
            <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
              <CardHeader>
                <CardTitle className="dark:text-white text-slate-800 font-bold">Inventory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {inventory.map((m) => {
                    const qty = m.quantity;
                    const pct = Math.min(100, (qty / maxQty) * 100);
                    const badge =
                      qty <= 5 ? (
                        <span className="text-xs font-semibold text-red-500">Low</span>
                      ) : qty > 20 ? (
                        <span className="text-xs font-semibold text-[#22c55e]">Good</span>
                      ) : (
                        <span className="text-xs font-semibold text-yellow-500">Medium</span>
                      );
                    return (
                      <div
                        key={m.id}
                        className="flex flex-col gap-2 p-4 rounded-lg border dark:border-zinc-800 dark:bg-zinc-900/30 border-slate-200 bg-slate-50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium dark:text-white text-slate-800">{m.material_name}</span>
                          <div className="flex items-center gap-2">
                            {badge}
                            <span className="text-sm dark:text-zinc-400 text-slate-500">
                              {m.quantity.toLocaleString()} {m.unit}
                            </span>
                          </div>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <p className="text-xs dark:text-zinc-500 text-slate-500">Last updated: {formatDate(m.last_updated)}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
