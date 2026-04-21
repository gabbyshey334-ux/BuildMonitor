/**
 * JengaTrack — DebugPanel
 *
 * Development-only, floating diagnostics overlay. Toggle with Shift+D.
 *
 * The panel reads the live project summary from the API and re-runs every
 * shared calculator on the client. That lets an engineer verify, at a
 * glance, that the API, the shared module, and the UI all agree on:
 *
 *   • Total spent        (sumExpenses)
 *   • Budget percentage  (calcBudgetPercent)
 *   • Burn rate          (calcBurnRate)
 *   • Category totals    (sumByCategory)
 *   • Inventory value    (calcInventoryTotal)
 *   • First expense date (findFirstExpenseDate)
 *
 * Import mode cross-layer: we import .js files so Node-side tests and the
 * React bundle share a single source of truth — no duplicated logic.
 *
 * Guarded by `import.meta.env.DEV` so it never ships to production.
 */

import React, { useMemo, useState, useEffect } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectSummary, useProjectExpenses, useProjectMaterials } from "@/hooks/useDashboard";
import {
  sumExpenses,
  calcBudgetPercent,
  calcBurnRate,
  calcInventoryTotal,
  findFirstExpenseDate,
  sumByCategory,
  safeNum,
} from "../../../shared/calculations.js";
import {
  formatCurrency,
  formatDate,
  formatProjectionDate,
} from "../../../shared/formatting.js";

interface Row {
  label: string;
  api: string | number | null | undefined;
  client: string | number | null | undefined;
  match: boolean;
}

function fmtForCompare(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "∞";
    return String(Math.round(value * 100) / 100);
  }
  return String(value);
}

export function DebugPanel() {
  if (!import.meta.env.DEV) return null;

  const [open, setOpen] = useState(false);
  const { currentProject } = useProject();
  const projectId = currentProject?.id ?? null;
  const currency = (currentProject as { currency?: string } | null)?.currency || "UGX";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const { data: summary } = useProjectSummary(projectId);
  const { data: expensesData } = useProjectExpenses(projectId);
  const { data: materialsData } = useProjectMaterials(projectId);

  const rows: Row[] = useMemo(() => {
    if (!summary) return [];

    const expensesRaw =
      (expensesData as { expenses?: unknown[] } | undefined)?.expenses ??
      (expensesData as { recent?: unknown[] } | undefined)?.recent ??
      [];
    const materials =
      (materialsData as { inventory?: unknown[] } | undefined)?.inventory ?? [];

    const budget = safeNum(summary.budget?.total);
    const apiSpent = safeNum(summary.budget?.spent);
    const clientSpent = sumExpenses(expensesRaw as any[]);
    const health = calcBudgetPercent(clientSpent, budget);
    const firstExp = findFirstExpenseDate(expensesRaw as any[]);
    const burn = calcBurnRate(clientSpent, budget, firstExp, currency);
    const inventoryValue = calcInventoryTotal(materials as any[]);
    const cats = sumByCategory(expensesRaw as any[]);

    return [
      {
        label: "Total Spent",
        api: formatCurrency(apiSpent, currency),
        client: formatCurrency(clientSpent, currency),
        match: Math.abs(apiSpent - clientSpent) < 0.5,
      },
      {
        label: "Budget %",
        api: summary.budget?.display ?? `${summary.budget?.percentage ?? 0}%`,
        client: health.display,
        match:
          Math.abs(
            safeNum(summary.budget?.rawPercent ?? summary.budget?.percentage) -
              health.raw,
          ) < 0.2,
      },
      {
        label: "Remaining",
        api: formatCurrency(summary.budget?.remaining, currency),
        client: formatCurrency(health.remaining, currency),
        match: Math.abs(safeNum(summary.budget?.remaining) - health.remaining) < 0.5,
      },
      {
        label: "Weekly burn",
        api: formatCurrency(summary.budget?.weeklyBurnRate, currency),
        client: formatCurrency(burn.weeklyRate, currency),
        match:
          Math.abs(safeNum(summary.budget?.weeklyBurnRate) - burn.weeklyRate) < 1,
      },
      {
        label: "Days remaining",
        api: summary.budget?.daysRemainingDisplay ?? "—",
        client: burn.displayDaysRemaining,
        match:
          (summary.budget?.daysRemainingDisplay ?? "") === burn.displayDaysRemaining,
      },
      {
        label: "First expense",
        api: summary.budget?.firstExpenseDate
          ? formatDate(summary.budget.firstExpenseDate)
          : "—",
        client: firstExp ? formatDate(firstExp) : "—",
        match:
          (summary.budget?.firstExpenseDate ?? null) ===
          (firstExp ? firstExp.toISOString().slice(0, 10) : null),
      },
      {
        label: "Runout date",
        api: summary.budget?.budgetRunoutDisplay ?? "—",
        client: burn.projectedExhaustionDate
          ? formatProjectionDate(burn.projectedExhaustionDate)
          : "—",
        match: true,
      },
      {
        label: "Inventory value",
        api: formatCurrency(
          (summary as { inventory?: { totalValue?: number } }).inventory?.totalValue,
          currency,
        ),
        client: formatCurrency(inventoryValue, currency),
        match:
          Math.abs(
            safeNum(
              (summary as { inventory?: { totalValue?: number } }).inventory
                ?.totalValue,
            ) - inventoryValue,
          ) < 0.5,
      },
      {
        label: "Top category",
        api: summary.categoryTotals?.[0]?.name ?? "—",
        client: cats[0]?.name ?? "—",
        match: (summary.categoryTotals?.[0]?.name ?? null) === (cats[0]?.name ?? null),
      },
      {
        label: "Currency",
        api: summary.currency ?? summary.project?.currency ?? "—",
        client: currency,
        match:
          (summary.currency ?? summary.project?.currency ?? "").toUpperCase() ===
          currency.toUpperCase(),
      },
    ];
  }, [summary, expensesData, materialsData, currency]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] rounded-full bg-black/80 px-3 py-2 text-xs font-mono text-green-300 shadow-lg backdrop-blur hover:bg-black"
        title="Debug panel (Shift+D)"
      >
        ⚙ debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-h-[80vh] w-[420px] max-w-[95vw] overflow-auto rounded-lg border border-green-500/40 bg-black/90 p-4 font-mono text-xs text-green-200 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          <span className="font-bold text-green-300">JengaTrack Debug</span>
          <span className="text-green-500/60">Shift+D to toggle</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-green-300 hover:text-white"
          aria-label="Close debug panel"
        >
          ✕
        </button>
      </div>

      <div className="mb-3 text-green-500/70">
        project: <span className="text-green-200">{currentProject?.name ?? "—"}</span>
        <span className="mx-1">·</span>
        id: <span className="text-green-200">{projectId ?? "—"}</span>
        <span className="mx-1">·</span>
        currency: <span className="text-green-200">{currency}</span>
      </div>

      {!summary && (
        <div className="text-yellow-400">Waiting for /summary payload…</div>
      )}

      {summary && (
        <table className="w-full text-left">
          <thead className="text-green-500/80">
            <tr>
              <th className="py-1 pr-2">metric</th>
              <th className="py-1 pr-2">api</th>
              <th className="py-1 pr-2">client</th>
              <th className="py-1 text-right">match</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-green-500/10">
                <td className="py-1 pr-2 text-green-300">{r.label}</td>
                <td className="py-1 pr-2 text-green-100">
                  {fmtForCompare(r.api)}
                </td>
                <td className="py-1 pr-2 text-green-100">
                  {fmtForCompare(r.client)}
                </td>
                <td
                  className={`py-1 text-right ${r.match ? "text-green-400" : "text-red-400"}`}
                >
                  {r.match ? "✓" : "✕"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-3 border-t border-green-500/20 pt-2 text-[10px] text-green-500/60">
        Runs shared/calculations.js on the client against the /summary API
        response so you can spot drift between layers instantly.
      </div>
    </div>
  );
}

export default DebugPanel;
