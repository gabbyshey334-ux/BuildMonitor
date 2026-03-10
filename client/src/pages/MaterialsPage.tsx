"use client";

import React from "react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectMaterials } from "@/hooks/useDashboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowLeft, Package, AlertTriangle, Clock, Box } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function MaterialsSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 space-y-8">
      {/* Header Skeleton */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-10 w-10 bg-muted rounded animate-pulse" />
      </div>

      {/* KPI Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-card border border-border rounded-xl animate-pulse" />
        ))}
      </div>

      {/* List Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Box className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-medium text-foreground mb-2">{message}</h3>
      {hint && <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">{hint}</p>}
    </div>
  );
}

export default function MaterialsPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const search = typeof window !== "undefined" ? window.location.search : "";
  const projectId = new URLSearchParams(search).get("project") ?? currentProject?.id ?? null;

  const { data, isLoading, isError, error, refetch } = useProjectMaterials(projectId);

  // Loading State
  if (isLoading) {
    return <MaterialsSkeleton />;
  }

  // No Project Selected State
  if (!projectId) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto ring-1 ring-cyan-500/20">
            <Package className="w-10 h-10 text-cyan-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t("materials.title")}</h1>
            <p className="text-muted-foreground">
              {hasProjects ? t("materials.noProjectSelect") : t("materials.noProjectCreate")}
            </p>
          </div>
          <Button
            onClick={() => setLocation("/projects")}
            className="bg-cyan-500 hover:bg-cyan-600 text-white border-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {hasProjects ? t("projects.backToProjects") : t("projects.createFirst")}
          </Button>
        </div>
      </div>
    );
  }

  // Error State
  if (isError) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">{t("common.error")}</h1>
            <p className="text-muted-foreground">{error instanceof Error ? error.message : "Failed to load materials"}</p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const { inventory, lowStock, summary } = data!;
  const maxQty = inventory.length ? Math.max(...inventory.map((m) => m.quantity), 1) : 1;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 1. Header Row */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Materials & Supplies</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
              <span className="font-medium text-cyan-400">{summary.totalItems} unique materials</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span className={cn("font-medium", summary.lowStockCount > 0 ? "text-amber-500" : "text-muted-foreground")}>
                {summary.lowStockCount} low stock alerts
              </span>
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="icon"
            className="rounded-full w-10 h-10 bg-card border-border text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/50 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* 2. Summary KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Items Card */}
          <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group hover:border-border transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Package className="w-24 h-24 text-cyan-500" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Package className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("materials.totalMaterials")}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{summary.totalItems}</span>
                <span className="text-sm text-muted-foreground">items logged</span>
              </div>
            </div>
          </div>

          {/* Low Stock Alerts Card */}
          <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <AlertTriangle className="w-24 h-24 text-amber-500" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className={cn("p-2 rounded-lg", summary.lowStockCount > 0 ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500")}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("materials.lowStockItems")}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-3xl font-bold", summary.lowStockCount > 0 ? "text-amber-500" : "text-foreground")}>
                  {summary.lowStockCount}
                </span>
                <span className="text-sm text-muted-foreground">requiring attention</span>
              </div>
            </div>
          </div>

          {/* Last Updated Card */}
          <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group hover:border-border transition-all duration-300">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Clock className="w-24 h-24 text-purple-500" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("materials.lastUpdated")}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-medium text-foreground">{formatDate(summary.lastUpdated)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Most recent activity</p>
            </div>
          </div>
        </div>

        {/* 3. Main Content - Inventory List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-semibold text-foreground">Inventory List</h2>
            {inventory.length > 0 && (
               <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Quantity • Status</span>
            )}
          </div>

          {inventory.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12">
              <EmptyState
                message="No materials logged yet"
                hint='You can log materials via WhatsApp by sending a message like "Received 50 bags of cement" or "Used 100 bricks".'
              />
            </div>
          ) : (
            <div className="grid gap-3">
              {inventory.map((m) => {
                const qty = m.quantity;
                const threshold = m.low_stock_threshold ?? 5;
                const isLowStock = qty <= threshold;
                const isGoodStock = qty > Math.max(threshold * 2, 20);
                
                // Color logic
                let statusColor = "bg-amber-500"; // Medium/Warning default
                if (isGoodStock) statusColor = "bg-emerald-500";
                if (isLowStock) statusColor = "bg-red-500";

                // Calculate percentage for bar (capped at 100%)
                const pct = Math.min(100, (qty / maxQty) * 100);

                return (
                  <div
                    key={m.id}
                    className="group bg-card border border-border rounded-xl p-5 hover:bg-muted/50 hover:border-border transition-all duration-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", 
                          isLowStock ? "bg-red-500/10 text-red-500" : "bg-cyan-500/10 text-cyan-400"
                        )}>
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-lg">{m.name}</h3>
                          <p className="text-xs text-muted-foreground">Last updated: {formatDate(m.updated_at || m.last_updated)}</p>
                          {(m.unit_cost != null && m.unit_cost > 0) && (
                            <p className="text-xs text-muted-foreground">Unit cost: {m.unit_cost.toLocaleString()} · Total: {m.total_cost != null ? m.total_cost.toLocaleString() : '—'}</p>
                          )}
                          {m.last_purchased_at && (
                            <p className="text-xs text-muted-foreground">Last purchased: {formatDate(m.last_purchased_at)}</p>
                          )}
                          {m.source && m.source !== 'manual' && (
                            <p className="text-xs text-muted-foreground capitalize">Source: {m.source}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {isLowStock && (
                          <div className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-wide animate-pulse">
                            Low Stock {threshold > 0 ? `(≤${threshold})` : ''}
                          </div>
                        )}
                        <div className="text-right">
                          <span className="text-2xl font-bold text-foreground tabular-nums">{m.quantity.toLocaleString()}</span>
                          <span className="text-sm text-muted-foreground ml-1 font-medium">{m.unit}</span>
                          {(m.total_cost != null && m.total_cost > 0) && (
                            <p className="text-xs text-muted-foreground mt-0.5">{m.total_cost.toLocaleString()} total</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stock Bar */}
                    <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-1000 ease-out", statusColor)}
                        style={{ width: `${Math.max(pct, 5)}%` }} // Minimum width for visibility
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
