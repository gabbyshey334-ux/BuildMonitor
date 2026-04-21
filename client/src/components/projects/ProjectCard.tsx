"use client";

import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { MoreHorizontal, MapPin, Clock, Wallet, AlertTriangle } from "lucide-react";
import type { Project } from "@/contexts/ProjectContext";
import { useProject } from "@/contexts/ProjectContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CurrencyValue } from "@/components/ui/CurrencyValue";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { computeBudgetHealth } from "@/lib/analytics";

interface ProjectCardProps {
  project: Project;
  index?: number;
}

function formatRelativeTime(lastActivityAt?: string): string {
  if (!lastActivityAt) return "No recent activity";
  try {
    const d = new Date(lastActivityAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 5) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Recently";
  }
}

function statusTone(status?: string): StatusTone {
  switch (status) {
    case "completed":
      return "success";
    case "on_hold":
      return "warning";
    case "archived":
      return "neutral";
    case "active":
    default:
      return "primary";
  }
}

export function ProjectCard({ project, index = 0 }: ProjectCardProps) {
  const { setCurrentProject } = useProject();
  const currency = project.currency || "UGX";

  // CRITICAL: computeBudgetHealth signature is (totalBudget, totalSpent).
  // Until 2026-04-20 this call passed them swapped, which inverted Spent/Budget
  // labels on every project card and made over-budget projects look healthy.
  // See Investigation 1, RC #1.
  const health = computeBudgetHealth(project.totalBudget ?? 0, project.spentAmount ?? 0);
  const hasBudget = health.total > 0;
  const hasExpenses = health.spent > 0;

  // Bar fill is clamped to [0,100] for visual; raw % can exceed 100 (over-budget).
  const budgetFillPct = hasBudget ? Math.min(100, health.displayPercent) : 0;
  const budgetRawPct = health.rawPercent;

  // Health / status — derived from the same numbers shown on the card so the
  // badge and the bar can never disagree.
  //
  // • No budget configured   → "No Budget"   (neutral)
  // • No expenses yet        → "Not Started" (neutral)
  // • Over budget            → "Over Budget" (danger)
  // • ≥ 85 %                 → "At Risk"     (warning)
  // • ≥ 70 %                 → "Attention"   (warning)
  // • otherwise              → "On Track"    (success)
  const healthStatus: { label: string; tone: StatusTone } = !hasBudget
    ? { label: "No Budget", tone: "neutral" }
    : !hasExpenses
      ? { label: "Not Started", tone: "neutral" }
      : health.overBudget
        ? { label: "Over Budget", tone: "danger" }
        : budgetRawPct >= 85
          ? { label: "At Risk", tone: "warning" }
          : budgetRawPct >= 70
            ? { label: "Attention", tone: "warning" }
            : { label: "On Track", tone: "success" };

  const statusLabel = (project.status || "active").replace("_", " ");

  const handleClick = () => {
    setCurrentProject(project);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("jenga_current_project", project.id);
      } catch {
        /* ignore */
      }
    }
  };

  const budgetBarColor = health.overBudget
    ? "bg-jenga-danger"
    : health.status === "danger"
      ? "bg-jenga-danger"
      : health.status === "warning"
        ? "bg-jenga-warning"
        : "bg-jenga-success";

  const budgetPctClass = health.overBudget
    ? "text-jenga-danger"
    : health.status === "danger"
      ? "text-jenga-danger"
      : health.status === "warning"
        ? "text-jenga-warning"
        : "text-jenga-success";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.05, 0.25),
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative group"
    >
      <Link href={`/dashboard?project=${project.id}`}>
        <div
          role="link"
          onClick={handleClick}
          className={cn(
            "block h-full jt-card p-5 cursor-pointer relative overflow-hidden min-w-0",
            "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "hover:border-jenga-primary/40 hover:-translate-y-0.5",
            "hover:shadow-[0_12px_40px_-8px_rgba(224,123,57,0.25)]",
          )}
        >
          {/* Ambient glow on hover */}
          <div
            className="absolute -top-20 -right-20 w-48 h-48 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background:
                "radial-gradient(circle, rgba(224,123,57,0.12) 0%, transparent 70%)",
            }}
            aria-hidden
          />

          {/* Header: name + status */}
          <div className="flex items-start justify-between gap-2 mb-3 relative z-10">
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-semibold text-foreground text-base truncate leading-tight">
                {project.name}
              </h3>
              {project.location && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{project.location}</span>
                </div>
              )}
            </div>
            <StatusBadge tone={statusTone(project.status)} size="sm" dot>
              <span className="capitalize">{statusLabel}</span>
            </StatusBadge>
          </div>

          {/* Budget Used — the ONLY progress-like bar until we have a real
              milestone-based progress source. This removes the previous dual
              "Progress + Budget Used" display that showed contradictory % (the
              list endpoint's `progress` field was budget-used % masquerading
              as construction progress). */}
          <div className="mb-4 relative z-10">
            {hasBudget ? (
              <>
                <div className="flex justify-between items-center text-xs mb-1.5 min-w-0 gap-2">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5 min-w-0">
                    <Wallet className="h-3 w-3 shrink-0" />
                    <span className="truncate">Budget Used</span>
                  </span>
                  <span
                    className={cn(
                      "font-mono tabular-nums font-semibold shrink-0",
                      budgetPctClass,
                    )}
                  >
                    {health.overBudget
                      ? `${budgetRawPct.toFixed(0)}%`
                      : `${Math.round(budgetFillPct)}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", budgetBarColor)}
                    initial={{ width: 0 }}
                    animate={{ width: `${budgetFillPct}%` }}
                    transition={{
                      duration: 0.8,
                      ease: [0.16, 1, 0.3, 1],
                      delay: 0.15,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2 text-xs min-w-0 rounded-btn border border-dashed border-jenga-warning/40 bg-jenga-warning/5 px-3 py-2">
                <span className="text-jenga-warning font-medium flex items-center gap-1.5 min-w-0">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span className="truncate">No budget set</span>
                </span>
                <Link
                  href={`/settings?project=${project.id}`}
                  className="text-jenga-primary font-semibold hover:underline shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  Set budget →
                </Link>
              </div>
            )}
          </div>

          {/* Budget amounts row — uses compact formatting so even 30B fits.
              On very narrow widths the spent/budget pair can wrap to the next
              line rather than clip behind overflow-hidden. */}
          <div className="pt-3 border-t border-border/60 relative z-10">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs min-w-0">
              <span className="text-muted-foreground shrink-0">Spent</span>
              <div className="flex items-baseline gap-1.5 min-w-0 font-mono tabular-nums flex-wrap justify-end">
                <CurrencyValue
                  value={health.spent}
                  currency={currency}
                  compact
                  size="sm"
                  tone={health.overBudget ? "danger" : "accent"}
                />
                {hasBudget && (
                  <>
                    <span className="text-muted-foreground text-[11px] shrink-0">/</span>
                    <CurrencyValue
                      value={health.total}
                      currency={currency}
                      compact
                      size="sm"
                      tone="muted"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer: health + last activity */}
          <div className="flex items-center justify-between gap-2 mt-3 relative z-10 min-w-0">
            <StatusBadge tone={healthStatus.tone} size="sm" dot>
              {healthStatus.label}
            </StatusBadge>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono truncate min-w-0">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">{formatRelativeTime(project.lastActivityAt)}</span>
            </span>
          </div>
        </div>
      </Link>

      {/* Context Menu */}
      <div className="absolute top-3 right-3 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-1.5 rounded-btn text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted/60 transition-all"
              aria-label="Project actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-card">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard?project=${project.id}`}>
                <span className="cursor-pointer w-full block">View Dashboard</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/budget?project=${project.id}`}>
                <span className="cursor-pointer w-full block">View Budget</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/settings?project=${project.id}`}>
                <span className="cursor-pointer w-full block">Project Settings</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
