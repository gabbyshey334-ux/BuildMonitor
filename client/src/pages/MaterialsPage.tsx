"use client";

import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatMaterialDisplayName, normalizeMaterialStorageName } from "@shared/materialNames";

let __materialsCurrency = "UGX";
function formatUGX(n: number) {
  return `${__materialsCurrency} ${Math.round(Number(n) || 0).toLocaleString()}`;
}

function humanDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const s = String(dateStr).split("T")[0];
  return new Date(s + "T12:00:00").toLocaleDateString("en-UG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type InventoryRow = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  total_cost: number | null;
  low_stock_threshold: number;
  last_purchased_at: string | null;
  updated_at: string | null;
  last_updated?: string | null;
};

async function fetchMaterialsInventory(projectId: string) {
  const res = await apiRequest("GET", `/api/projects/${projectId}/materials`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to load materials");
  return data as {
    success: boolean;
    inventory: InventoryRow[];
    summary?: { totalItems: number; lowStockCount: number; lastUpdated: string | null };
  };
}

function stockStatus(qty: number, threshold: number): "out" | "low" | "ok" {
  if (qty === 0) return "out";
  if (qty <= threshold) return "low";
  return "ok";
}

function stockBarPercent(qty: number, threshold: number) {
  const denom = Math.max((threshold || 5) * 6, 1);
  return Math.min(100, (qty / denom) * 100);
}

export default function MaterialsPage() {
  usePageTitle("Materials");
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const search = typeof window !== "undefined" ? window.location.search : "";
  const projectId = new URLSearchParams(search).get("project") ?? currentProject?.id ?? null;

  React.useEffect(() => {
    __materialsCurrency = currentProject?.currency || "UGX";
  }, [currentProject?.currency]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<InventoryRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<InventoryRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formUnit, setFormUnit] = useState("bags");
  const [formUnitCost, setFormUnitCost] = useState("");
  const [formThreshold, setFormThreshold] = useState("5");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["materials", projectId],
    queryFn: () => fetchMaterialsInventory(projectId!),
    enabled: !!projectId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const inventory = data?.inventory ?? [];

  const kpis = useMemo(() => {
    const totalMaterials = inventory.length;
    // Current inventory value = quantity × unit_cost (not historical total_cost)
    const totalValue = inventory.reduce(
      (s, m) => s + (Number(m.quantity) || 0) * (Number(m.unit_cost) || 0),
      0,
    );
    const lowStockItems = inventory.filter((m) => {
      const th = m.low_stock_threshold != null ? Number(m.low_stock_threshold) : 5;
      const q = Number(m.quantity) || 0;
      return q > 0 && q <= th;
    }).length;
    let lastTs = 0;
    for (const m of inventory) {
      const u = m.updated_at || m.last_updated;
      if (u) {
        const t = new Date(u).getTime();
        if (t > lastTs) lastTs = t;
      }
    }
    const lastUpdatedLabel = lastTs ? humanDate(new Date(lastTs).toISOString()) : "—";
    return { totalMaterials, totalValue, lowStockItems, lastUpdatedLabel };
  }, [inventory]);

  const openAdd = () => {
    setEditRow(null);
    setFormName("");
    setFormQty("");
    setFormUnit("bags");
    setFormUnitCost("");
    setFormThreshold("5");
    setAddOpen(true);
  };

  const openEdit = (row: InventoryRow) => {
    setEditRow(row);
    setFormName(row.name);
    setFormQty(String(row.quantity ?? ""));
    setFormUnit(row.unit || "units");
    setFormUnitCost(row.unit_cost != null ? String(row.unit_cost) : "");
    setFormThreshold(String(row.low_stock_threshold ?? 5));
    setAddOpen(true);
  };

  const handleSaveAddOrEdit = async () => {
    if (!projectId) return;
    const nameRaw = formName.trim();
    if (!nameRaw) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const qty = parseFloat(String(formQty).replace(/,/g, ""));
    if (!Number.isFinite(qty) || qty <= 0) {
      toast({ title: "Enter a valid quantity", variant: "destructive" });
      return;
    }
    const unit = formUnit.trim() || "units";
    const uc = formUnitCost.trim() ? parseFloat(formUnitCost.replace(/,/g, "")) : 0;
    const th = parseFloat(formThreshold);
    const threshold = Number.isFinite(th) && th >= 0 ? th : 5;

    setSaving(true);
    try {
      if (editRow) {
        const totalCost =
          Number.isFinite(uc) && uc >= 0 ? qty * uc : parseFloat(String(editRow.total_cost ?? 0)) || 0;
        const res = await apiRequest("PATCH", `/api/projects/${projectId}/materials/${editRow.id}`, {
          quantity: qty,
          unit,
          unit_cost: Number.isFinite(uc) ? uc : editRow.unit_cost ?? 0,
          total_cost: totalCost,
          low_stock_threshold: threshold,
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Update failed");
        toast({ title: "Material updated" });
      } else {
        const res = await apiRequest("POST", `/api/projects/${projectId}/materials`, {
          name: nameRaw,
          quantity: qty,
          unit,
          unit_cost: Number.isFinite(uc) ? uc : 0,
          total_cost: Number.isFinite(uc) && uc >= 0 ? qty * uc : 0,
          source: "dashboard",
          low_stock_threshold: threshold,
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not add material");
        toast({ title: "Material added" });
      }
      setAddOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["materials", projectId] });
      await refetch();
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!projectId || !deleteRow) return;
    setSaving(true);
    try {
      const res = await apiRequest("DELETE", `/api/projects/${projectId}/materials/${deleteRow.id}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Delete failed");
      toast({ title: "Material removed" });
      setDeleteRow(null);
      await queryClient.invalidateQueries({ queryKey: ["materials", projectId] });
      await refetch();
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Delete failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) {
    return (
      <div className="w-full min-h-[60vh] bg-background text-foreground flex flex-col items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto ring-1 ring-border">
            <Package className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t("materials.title")}</h1>
            <p className="text-muted-foreground">
              {hasProjects ? t("materials.noProjectSelect") : t("materials.noProjectCreate")}
            </p>
          </div>
          <Button onClick={() => setLocation("/projects")} variant="default">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {hasProjects ? t("projects.backToProjects") : t("projects.createFirst")}
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="min-h-[50vh] bg-background p-6 pb-24 md:pb-6 animate-pulse space-y-6">
        <div className="h-10 bg-muted rounded w-1/3 max-w-xs" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-card border border-border rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-card border border-border rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-[40vh] bg-background flex items-center justify-center p-6 pb-24 md:pb-6">
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : "Could not load materials."}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden text-foreground font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {t("materials.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("materials.headerSubtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label={t("common.refresh") || "Refresh"}
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            </Button>
            <Button onClick={openAdd}>
              <Plus className="w-4 h-4 mr-2" />
              {t("materials.addMaterial")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("materials.totalMaterials")}
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">{kpis.totalMaterials}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("materials.totalInventoryValue")}
            </p>
            <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">
              {formatUGX(kpis.totalValue)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("materials.lowStockItems")}
            </p>
            <p
              className={cn(
                "text-2xl font-bold mt-1",
                kpis.lowStockItems > 0 ? "text-amber-600 dark:text-amber-500" : "text-foreground",
              )}
            >
              {kpis.lowStockItems}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("materials.lastUpdatedLabel")}
            </p>
            <p className="text-lg font-semibold text-foreground mt-1">{kpis.lastUpdatedLabel}</p>
          </div>
        </div>

        {/* Smart Sync Banner */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-muted-foreground">
          <Zap className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
          <span>
            {t("materials.autoSync")}
            {kpis.lastUpdatedLabel !== "—" && (
              <span className="ml-1">{t("materials.lastSynced")} <span className="text-foreground">{kpis.lastUpdatedLabel}</span></span>
            )}
          </span>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {inventory.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Package className="w-12 h-12 text-muted-foreground mx-auto opacity-60" />
              <p className="text-muted-foreground font-medium">{t("materials.noMaterials")}</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {t("materials.noMaterialsDesc")}
              </p>
              <Button onClick={openAdd} className="mt-2">
                <Plus className="w-4 h-4 mr-2" />
                {t("materials.addFirst")}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("materials.colName")}</TableHead>
                    <TableHead>{t("materials.colCurrentStock")}</TableHead>
                    <TableHead className="text-right">{t("materials.colUnitCost")}</TableHead>
                    <TableHead className="text-right">{t("materials.colTotalValue")}</TableHead>
                    <TableHead>{t("materials.colLastPurchased")}</TableHead>
                    <TableHead>{t("materials.colStatus")}</TableHead>
                    <TableHead className="w-[140px]">{t("materials.colStockLevel")}</TableHead>
                    <TableHead className="text-right w-[100px]">{t("materials.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.map((row) => {
                    const th = row.low_stock_threshold != null ? Number(row.low_stock_threshold) : 5;
                    const qty = Number(row.quantity) || 0;
                    const st = stockStatus(qty, th);
                    const uc = row.unit_cost != null ? parseFloat(String(row.unit_cost)) : 0;
                    // Current value = current stock × unit cost (not historical purchase total)
                    const tv = qty * uc;
                    const displayName = formatMaterialDisplayName(normalizeMaterialStorageName(row.name));
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-foreground">{displayName}</TableCell>
                        <TableCell className="tabular-nums">
                          {qty.toLocaleString()}{" "}
                          <span className="text-muted-foreground">{row.unit || "units"}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatUGX(uc)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatUGX(tv)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {humanDate(row.last_purchased_at)}
                        </TableCell>
                        <TableCell>
                          {st === "out" && (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground">
                              {t("materials.outOfStock")}
                            </Badge>
                          )}
                          {st === "low" && (
                            <Badge className="bg-red-600/15 text-red-700 dark:text-red-400 hover:bg-red-600/20 border-red-600/30">
                              {t("materials.lowStock")}
                            </Badge>
                          )}
                          {st === "ok" && (
                            <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/20 border-emerald-600/30">
                              {t("materials.inStock")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 pr-2">
                            <Progress value={stockBarPercent(qty, th)} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Edit"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              aria-label="Delete"
                              onClick={() => setDeleteRow(row)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editRow ? t("materials.editMaterialTitle") : t("materials.addMaterial")}</DialogTitle>
            <DialogDescription>
              {editRow ? t("materials.editDesc") : t("materials.addDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="mat-name">{t("materials.nameLbl")}</Label>
              <Input
                id="mat-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={!!editRow}
                placeholder="e.g. cement"
                className="bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="mat-qty">{t("materials.quantityLbl")}</Label>
                <Input
                  id="mat-qty"
                  inputMode="decimal"
                  value={formQty}
                  onChange={(e) => setFormQty(e.target.value)}
                  placeholder="0"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mat-unit">{t("materials.unitLbl")}</Label>
                <Input
                  id="mat-unit"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  placeholder="bags"
                  className="bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mat-uc">{t("materials.unitCostLbl")}</Label>
              <Input
                id="mat-uc"
                inputMode="decimal"
                value={formUnitCost}
                onChange={(e) => setFormUnitCost(e.target.value)}
                placeholder="0"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mat-th">{t("materials.thresholdLbl")}</Label>
              <Input
                id="mat-th"
                inputMode="numeric"
                value={formThreshold}
                onChange={(e) => setFormThreshold(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleSaveAddOrEdit} disabled={saving}>
              {saving ? t("common.saving") : editRow ? t("common.save") : t("materials.addMaterial")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{t("materials.removeTitle")}</DialogTitle>
            <DialogDescription>
              This removes the inventory row for{" "}
              <span className="font-medium text-foreground">
                {deleteRow
                  ? formatMaterialDisplayName(normalizeMaterialStorageName(deleteRow.name))
                  : ""}
              </span>
              . This does not delete past transactions from the log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteRow(null)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? t("materials.removeSaving") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
