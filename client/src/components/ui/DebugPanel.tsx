"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Bug, Activity, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  analyticsSnapshot,
  formatCurrency,
  type Expense,
  type InventoryRow,
} from "@/lib/analytics";

/**
 * Hidden developer analytics debug panel. Toggle via Shift+D (dev only).
 * Shows: cache keys, current computed numbers, and any edge-case warnings.
 */
export interface DebugPanelProps {
  expenses?: Expense[];
  inventory?: InventoryRow[];
  totalBudget?: number | string | null;
  projectId?: string | null;
  currency?: string;
}

export function DebugPanel(props: DebugPanelProps) {
  const [open, setOpen] = React.useState(false);
  const qc = useQueryClient();

  const isDev =
    typeof window !== "undefined" &&
    (import.meta.env?.DEV || window.location.hostname === "localhost");

  React.useEffect(() => {
    if (!isDev) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDev]);

  if (!isDev || !open) return null;

  const snap = analyticsSnapshot(
    props.expenses || [],
    props.inventory || [],
    props.totalBudget || 0,
  );
  const keys = qc.getQueryCache().getAll().map((q) => ({
    key: JSON.stringify(q.queryKey),
    state: q.state.status,
    fetchedAt: q.state.dataUpdatedAt,
  }));

  return (
    <div className="fixed inset-0 z-[80] p-4 md:p-8 flex items-end md:items-center justify-end pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md rounded-modal bg-popover border border-border shadow-modal overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-jenga-raised">
          <div className="flex items-center gap-2 font-mono text-xs text-jenga-primary">
            <Bug size={14} /> Analytics Debug Panel
          </div>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </header>

        <div className="max-h-[75vh] overflow-y-auto p-4 space-y-4 text-[12px] font-mono">
          <Section title="Project">
            <KV k="projectId" v={props.projectId || "—"} />
            <KV k="currency" v={props.currency || "UGX"} />
          </Section>

          <Section title="Budget Health">
            <KV k="rawPercent" v={`${snap.budget.rawPercent.toFixed(2)}%`} />
            <KV k="displayPercent" v={`${snap.budget.displayPercent.toFixed(2)}%`} />
            <KV k="overBudget" v={String(snap.budget.overBudget)} />
            <KV k="status" v={snap.budget.status} />
            <KV k="total" v={formatCurrency(snap.budget.total, props.currency || "UGX")} />
            <KV k="spent" v={formatCurrency(snap.budget.spent, props.currency || "UGX")} />
            <KV k="remaining" v={formatCurrency(snap.budget.remaining, props.currency || "UGX")} />
          </Section>

          <Section title="Burn Rate">
            <KV k="dailyRate" v={formatCurrency(snap.burn.dailyRate, props.currency || "UGX")} />
            <KV k="weeklyRate" v={formatCurrency(snap.burn.weeklyRate, props.currency || "UGX")} />
            <KV k="daysRemaining" v={snap.burn.daysRemaining === Infinity ? "∞" : String(snap.burn.daysRemaining)} />
            <KV k="isEarlyEstimate" v={String(snap.burn.isEarlyEstimate)} />
            <KV k="daysWithSpending" v={String(snap.burn.daysWithSpending)} />
            <KV k="daysSinceFirst" v={String(snap.burn.daysSinceFirst)} />
          </Section>

          <Section title="Counts">
            {Object.entries(snap.counts).map(([k, v]) => (
              <KV key={k} k={k} v={String(v)} />
            ))}
            <KV k="inventoryValue" v={formatCurrency(snap.inventoryValue, props.currency || "UGX")} />
          </Section>

          {snap.warnings.length > 0 && (
            <Section title="Warnings" icon={<AlertTriangle size={12} className="text-jenga-warning" />}>
              <ul className="space-y-1 text-jenga-warning">
                {snap.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Categories">
            <ul className="space-y-1">
              {snap.categoryTotals.map((c) => (
                <li key={c.name} className="flex justify-between">
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="text-foreground">
                    {formatCurrency(c.amount, props.currency || "UGX", { compact: true })} ({c.percent}%)
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Query Cache" icon={<Activity size={12} />}>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {keys.slice(0, 40).map((k, i) => (
                <li key={i} className="text-muted-foreground">
                  <span className={cn(
                    "mr-1",
                    k.state === "success" && "text-jenga-success",
                    k.state === "error" && "text-jenga-danger",
                    k.state === "pending" && "text-jenga-warning",
                  )}>●</span>
                  <span className="break-all">{k.key}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        {icon}
        {title}
      </div>
      <div className="bg-muted/30 rounded-md p-2 space-y-0.5">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground truncate">{v}</span>
    </div>
  );
}

export default DebugPanel;
