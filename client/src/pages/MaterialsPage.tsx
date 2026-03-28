"use client";

import React, { useState } from "react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import {
  useProjectMaterials,
  useMaterialsDailySummary,
  useMaterialsForDate,
} from "@/hooks/useDashboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  ArrowLeft,
  Package,
  AlertTriangle,
  Calendar,
  Plus,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Boxes,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

function getDateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatLongDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type TxType = "purchase" | "usage";

interface LogRow {
  id: number;
  name: string;
  quantity: string;
  unit: string;
  transaction_type: TxType;
}

function MaterialsSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 animate-pulse">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="h-10 bg-muted rounded w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-card border border-border rounded-xl" />
          ))}
        </div>
        <div className="h-32 bg-card border border-border rounded-xl" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-card border border-border rounded-xl" />
          ))}
        </div>
      </div>
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

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(getDateKey(new Date()));
  const todayKey = getDateKey(new Date());
  const isToday = selectedDate === todayKey;

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([
    { id: Date.now(), name: "", quantity: "", unit: "bags", transaction_type: "purchase" },
  ]);

  const { data: stockData, isLoading: stockLoading, isError: stockError, error: stockErr, refetch: refetchStock } =
    useProjectMaterials(projectId);

  const {
    data: summaryData,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useMaterialsDailySummary(projectId);

  const {
    data: dayData,
    isLoading: dayLoading,
    isError: dayError,
    refetch: refetchDay,
  } = useMaterialsForDate(projectId, selectedDate);

  const entries = dayData?.entries ?? [];

  const mergedLoading = summaryLoading && !summaryData;
  const stats = summaryData?.stats;
  const heatmap = summaryData?.heatmap ?? [];

  const lowStockCount = stockData?.summary?.lowStockCount ?? 0;

  const openModal = () => {
    setRows([{ id: Date.now(), name: "", quantity: "", unit: "bags", transaction_type: "purchase" }]);
    setShowModal(true);
  };

  const addRow = () => {
    setRows((r) => [
      ...r,
      { id: Date.now(), name: "", quantity: "", unit: "bags", transaction_type: "purchase" },
    ]);
  };

  const removeRow = (id: number) => {
    if (rows.length <= 1) return;
    setRows((r) => r.filter((x) => x.id !== id));
  };

  const updateRow = (id: number, patch: Partial<LogRow>) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const handleSave = async () => {
    if (!projectId) return;
    const payload = rows
      .filter((r) => r.name.trim() && r.quantity.trim())
      .map((r) => ({
        name: r.name.trim(),
        quantity: parseFloat(r.quantity.replace(/,/g, "")),
        unit: r.unit.trim() || "units",
        transaction_type: r.transaction_type,
      }))
      .filter((r) => Number.isFinite(r.quantity) && r.quantity > 0);

    if (payload.length === 0) {
      toast({ title: "Add at least one line with name and quantity", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiRequest("POST", `/api/projects/${projectId}/materials/daily`, {
        log_date: selectedDate,
        entries: payload,
      });
      toast({ title: "Materials logged for " + formatLongDate(selectedDate) });
      setShowModal(false);
      await Promise.all([refetchSummary(), refetchDay(), refetchStock()]);
      queryClient.invalidateQueries({ queryKey: ["project-materials", projectId] });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Could not save",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const goPrev = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(getDateKey(d));
  };

  const goNext = () => {
    if (isToday) return;
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setSelectedDate(getDateKey(d));
  };

  const refreshAll = () => {
    refetchSummary();
    refetchDay();
    refetchStock();
  };

  const showTodayReminder = isToday && stats && !stats.todayLogged;

  if (mergedLoading) {
    return <MaterialsSkeleton />;
  }

  if (!projectId) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-[#00bcd4]/10 flex items-center justify-center mx-auto ring-1 ring-[#00bcd4]/20">
            <Package className="w-10 h-10 text-[#00bcd4]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t("materials.title")}</h1>
            <p className="text-muted-foreground">
              {hasProjects ? t("materials.noProjectSelect") : t("materials.noProjectCreate")}
            </p>
          </div>
          <Button
            onClick={() => setLocation("/projects")}
            className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {hasProjects ? t("projects.backToProjects") : t("projects.createFirst")}
          </Button>
        </div>
      </div>
    );
  }

  if (summaryError && !summaryData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="text-muted-foreground">Could not load materials calendar.</p>
          <Button variant="outline" onClick={() => refetchSummary()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const inventory = stockData?.inventory ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans pb-28">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Materials — daily log</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Log what you receive or use each day. Pick a date to review history; heatmap shows activity.
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full w-10 h-10 border-border"
            onClick={refreshAll}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {showTodayReminder && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-amber-200">
              <span className="font-semibold text-amber-100">Daily habit:</span> You have not logged materials today.
              Quick log keeps inventory accurate.
            </p>
            <Button
              size="sm"
              className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-semibold shrink-0"
              onClick={openModal}
            >
              Log today
            </Button>
          </div>
        )}

        {/* KPI row — DailyPage style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Days logged</span>
            </div>
            <p className="text-3xl font-bold">{stats?.totalDaysWithMaterials ?? 0}</p>
            <p className="text-sm text-muted-foreground">distinct days with material moves</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Flame className="w-20 h-20 text-amber-500" />
            </div>
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Flame className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Streak</span>
            </div>
            <p className="text-3xl font-bold relative z-10">{stats?.currentStreak ?? 0}</p>
            <p className="text-sm text-muted-foreground">consecutive days (UTC)</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#00bcd4]/10 text-[#00bcd4]">
                <Boxes className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock SKUs</span>
            </div>
            <p className="text-3xl font-bold">{stockData?.summary?.totalItems ?? 0}</p>
            <p className="text-sm text-muted-foreground">current inventory lines</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={cn(
                  "p-2 rounded-lg",
                  lowStockCount > 0 ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500",
                )}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("materials.lowStockItems")}
              </span>
            </div>
            <p className={cn("text-3xl font-bold", lowStockCount > 0 && "text-amber-500")}>{lowStockCount}</p>
            <p className="text-sm text-muted-foreground">need attention</p>
          </div>
        </div>

        {/* Heatmap */}
        <div id="materials-heatmap" className="bg-card border border-border rounded-xl p-6 scroll-mt-24">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Activity — last 60 days</h2>
            <span className="text-xs text-muted-foreground">Tap a square to open that day</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {heatmap.map((h) => {
              const ec = h.entryCount ?? 0;
              let bg = "bg-muted";
              if (h.active) {
                if (ec <= 1) bg = "bg-cyan-900";
                else if (ec <= 3) bg = "bg-cyan-600";
                else bg = "bg-cyan-400";
              }
              return (
                <button
                  key={h.date}
                  type="button"
                  onClick={() => setSelectedDate(h.date)}
                  className="relative group"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-md transition-all hover:scale-110",
                      h.active ? `${bg} shadow-[0_0_8px_rgba(0,188,212,0.25)]` : "opacity-40 hover:opacity-70",
                    )}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20">
                    {h.date} · {ec} moves
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected date */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                aria-label="Previous day"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <span className="font-semibold min-w-[240px] text-center text-sm sm:text-base">
                {formatLongDate(selectedDate)}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={isToday}
                className={cn(
                  "p-2 rounded-lg",
                  isToday ? "text-muted-foreground/30" : "hover:bg-muted text-muted-foreground",
                )}
                aria-label="Next day"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-border"
                onClick={() => document.getElementById("materials-heatmap")?.scrollIntoView({ behavior: "smooth" })}
              >
                Heatmap
              </Button>
              <Button
                className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-semibold"
                onClick={openModal}
              >
                <Plus className="w-4 h-4 mr-1" />
                Log for this day
              </Button>
            </div>
          </div>

          {/* Day entries */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Logged on this date
            </h3>
            {dayLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-card border border-border rounded-xl" />
                ))}
              </div>
            ) : dayError ? (
              <p className="text-red-500 text-sm">Could not load this day.</p>
            ) : entries.length === 0 ? (
              <div className="text-center py-14 border border-dashed border-border rounded-xl bg-muted/20">
                <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground mb-4">No material moves on this date.</p>
                <Button onClick={openModal} className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-semibold">
                  Log materials
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((e) => {
                  const isUsage = e.transaction_type === "usage";
                  const qtyDisplay = isUsage ? Math.abs(e.quantity) : e.quantity;
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        "rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-l-4",
                        isUsage
                          ? "border-border bg-card border-l-amber-500"
                          : "border-border bg-card border-l-[#00bcd4]",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "p-2 rounded-lg shrink-0",
                            isUsage ? "bg-amber-500/10 text-amber-500" : "bg-[#00bcd4]/10 text-[#00bcd4]",
                          )}
                        >
                          {isUsage ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground capitalize">{e.material_name}</p>
                          <p className="text-sm text-muted-foreground">{e.description || "—"}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {e.source === "whatsapp" ? "WhatsApp" : e.source === "dashboard" ? "Dashboard" : e.source || "—"}
                            {e.created_at && ` · ${new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold tabular-nums">
                          {isUsage ? "−" : "+"}
                          {qtyDisplay.toLocaleString()}{" "}
                          <span className="text-sm font-normal text-muted-foreground">{e.unit}</span>
                        </p>
                        <p className="text-xs text-muted-foreground uppercase">{isUsage ? "Used" : "Received"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Current stock — compact */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Current stock</h2>
            {stockLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
          </div>
          {stockError ? (
            <p className="text-sm text-red-500">{stockErr instanceof Error ? stockErr.message : "Stock error"}</p>
          ) : inventory.length === 0 ? (
            <p className="text-sm text-muted-foreground border border-border rounded-xl p-6 text-center">
              No inventory rows yet. Log a purchase for a new material to create stock.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {inventory.slice(0, 12).map((m) => {
                const threshold = (m as { low_stock_threshold?: number }).low_stock_threshold ?? 5;
                const low = m.quantity <= threshold;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border border-border px-4 py-3 bg-card",
                      low && "border-amber-500/40",
                    )}
                  >
                    <span className="font-medium truncate pr-2">{m.name}</span>
                    <span className="tabular-nums text-sm shrink-0">
                      {m.quantity.toLocaleString()} <span className="text-muted-foreground">{m.unit}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {inventory.length > 12 && (
            <p className="text-xs text-muted-foreground text-center">Showing 12 of {inventory.length} items</p>
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={openModal}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3 rounded-full bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold shadow-lg z-40"
      >
        <Plus className="w-5 h-5" />
        Log materials
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <h3 className="text-xl font-bold mb-1">Log materials</h3>
            <p className="text-sm text-muted-foreground mb-4">{formatLongDate(selectedDate)}</p>

            <div className="space-y-4">
              {rows.map((r, idx) => (
                <div key={r.id} className="rounded-lg border border-border/60 p-3 space-y-2 bg-muted/30">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Line {idx + 1}</span>
                    {rows.length > 1 && (
                      <button type="button" className="text-xs text-red-400" onClick={() => removeRow(r.id)}>
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
                    placeholder="Material name (e.g. cement)"
                    value={r.name}
                    onChange={(e) => updateRow(r.id, { name: e.target.value })}
                  />
                  <div className="grid grid-cols-12 gap-2">
                    <input
                      className="col-span-4 px-3 py-2 rounded-md bg-background border border-border text-sm"
                      inputMode="decimal"
                      placeholder="Qty"
                      value={r.quantity}
                      onChange={(e) => updateRow(r.id, { quantity: e.target.value })}
                    />
                    <input
                      className="col-span-4 px-3 py-2 rounded-md bg-background border border-border text-sm"
                      placeholder="Unit"
                      value={r.unit}
                      onChange={(e) => updateRow(r.id, { unit: e.target.value })}
                    />
                    <select
                      className="col-span-4 px-2 py-2 rounded-md bg-background border border-border text-sm"
                      value={r.transaction_type}
                      onChange={(e) => updateRow(r.id, { transaction_type: e.target.value as TxType })}
                    >
                      <option value="purchase">Received</option>
                      <option value="usage">Used</option>
                    </select>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addRow}
                className="w-full py-2 text-sm border border-dashed border-border rounded-lg text-muted-foreground hover:bg-muted/50"
              >
                + Add line
              </button>
            </div>

            <div className="flex flex-col gap-2 mt-6">
              <Button variant="ghost" className="w-full" onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                className="w-full bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save log"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
