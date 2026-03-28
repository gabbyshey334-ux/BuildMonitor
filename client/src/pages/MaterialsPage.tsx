"use client";

import React, { useMemo } from "react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectMaterials } from "@/hooks/useDashboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, ArrowLeft, Package, AlertTriangle, Clock, Box,
  ArrowUpRight, ArrowDownRight, Activity, Plus
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeDate(s: string) {
  const d = new Date(s);
  const today = new Date();
  const diffTime = today.getTime() - d.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return new Date(s).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
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

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    const groups: Record<string, NonNullable<typeof data.transactions>> = {};
    for (const tx of data.transactions) {
      if (!groups[tx.date]) groups[tx.date] = [];
      groups[tx.date].push(tx);
    }
    return Object.entries(groups)
      .map(([date, txs]) => ({ date, txs }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data?.transactions]);

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

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        
        {/* 1. Header Row */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Daily Materials Log</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
              <span className="font-medium text-cyan-400">{summary.totalItems} unique materials tracked</span>
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

        {/* 2. Main Layout: Daily Logs Timeline + Sidebar Inventory */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column: Daily Logs */}
          <div className="flex-1 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Material Activity Log
              </h2>
            </div>

            {groupedTransactions.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12">
                <EmptyState
                  message="No material logs yet"
                  hint='Log materials via WhatsApp by sending a message like "Received 50 bags of cement" or "Used 100 bricks".'
                />
              </div>
            ) : (
              <div className="space-y-10">
                {groupedTransactions.map((group) => (
                  <div key={group.date} className="relative">
                    {/* Date Header */}
                    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur py-2 mb-4">
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/50 border border-border">
                        <span className="text-sm font-bold text-foreground">{formatRelativeDate(group.date)}</span>
                        <span className="text-xs text-muted-foreground font-medium">{formatDate(group.date)}</span>
                      </div>
                    </div>

                    {/* Transactions List */}
                    <div className="space-y-3 pl-2 md:pl-6 border-l-2 border-border ml-4 md:ml-6 relative">
                      {group.txs.map((tx, idx) => {
                        const isPurchase = tx.transaction_type === 'purchase' || tx.transaction_type === 'adjustment' && tx.quantity > 0;
                        const isUsage = tx.transaction_type === 'usage' || tx.transaction_type === 'return' || tx.quantity < 0;
                        const isWhatsapp = tx.source === 'whatsapp';
                        
                        return (
                          <div 
                            key={tx.id || idx} 
                            className="relative group bg-card border border-border hover:border-border/80 rounded-xl p-4 transition-all duration-200 ml-4 shadow-sm"
                          >
                            {/* Dot on timeline */}
                            <div className={cn(
                              "absolute -left-[27px] top-5 w-4 h-4 rounded-full border-4 border-background z-10",
                              isPurchase ? "bg-emerald-500" : isUsage ? "bg-amber-500" : "bg-cyan-500"
                            )} />
                            
                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                              <div className="flex items-start gap-4">
                                <div className={cn(
                                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                  isPurchase ? "bg-emerald-500/10 text-emerald-500" : isUsage ? "bg-amber-500/10 text-amber-500" : "bg-cyan-500/10 text-cyan-500"
                                )}>
                                  {isPurchase ? <ArrowDownRight className="w-5 h-5" /> : isUsage ? <ArrowUpRight className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-foreground text-lg capitalize">{tx.material_name}</h4>
                                    {isWhatsapp && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#25D366]/10 text-[#25D366] uppercase tracking-wider">WhatsApp</span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-0.5">
                                    {tx.description || (isPurchase ? "Added to inventory" : isUsage ? "Used from inventory" : "Inventory updated")}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="text-right ml-14 sm:ml-0 bg-muted/30 px-4 py-2 rounded-lg min-w-[120px]">
                                <div className={cn(
                                  "text-xl font-bold tabular-nums",
                                  isPurchase ? "text-emerald-500" : isUsage ? "text-amber-500" : "text-cyan-500"
                                )}>
                                  {isPurchase ? "+" : isUsage && tx.quantity > 0 ? "-" : ""}{Math.abs(tx.quantity).toLocaleString()}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  {tx.unit}
                                </div>
                              </div>
                            </div>
                            
                            {(tx.total_cost > 0) && isPurchase && (
                              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Recorded Cost</span>
                                <span className="font-medium text-foreground">UGX {tx.total_cost.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Inventory Summary */}
          <div className="lg:w-1/3 space-y-6">
            <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-6">
              <div className="p-5 border-b border-border bg-muted/20">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Package className="w-5 h-5 text-cyan-400" />
                  Current Inventory
                </h3>
              </div>
              
              <div className="p-5 max-h-[600px] overflow-y-auto space-y-4">
                {inventory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No inventory tracked yet.</p>
                ) : (
                  inventory.map((m) => {
                    const isLowStock = m.quantity <= (m.low_stock_threshold ?? 5);
                    const isGoodStock = m.quantity > Math.max((m.low_stock_threshold ?? 5) * 2, 20);
                    
                    let statusColor = "bg-amber-500"; 
                    if (isGoodStock) statusColor = "bg-emerald-500";
                    if (isLowStock) statusColor = "bg-red-500";

                    return (
                      <div key={m.id} className="group">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-sm text-foreground capitalize truncate pr-2">
                            {m.name}
                            {isLowStock && <AlertTriangle className="w-3 h-3 inline ml-1.5 text-red-500 animate-pulse" />}
                          </span>
                          <span className="font-bold text-sm whitespace-nowrap">
                            {m.quantity.toLocaleString()} <span className="text-muted-foreground text-xs font-normal">{m.unit}</span>
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all duration-1000", statusColor)}
                            style={{ width: `${Math.max(Math.min((m.quantity / 100) * 100, 100), 5)}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              <div className="p-4 border-t border-border bg-muted/20">
                <Button variant="outline" className="w-full text-xs h-9 text-muted-foreground hover:text-cyan-400">
                  <Plus className="w-3 h-3 mr-1" />
                  Manual Inventory Update
                </Button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
