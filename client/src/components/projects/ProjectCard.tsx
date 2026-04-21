"use client";

import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { MoreHorizontal, MapPin, Clock, TrendingUp, Wallet } from "lucide-react";
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
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
}

function calculateHealthStatus(
  progress: number,
  budgetSpentPercent: number,
): { label: string; tone: StatusTone } {
  const variance = budgetSpentPercent - progress;
  if (variance > 25 || budgetSpentPercent > 95) {
    return { label: "Over Budget", tone: "danger" };
  }
  if (variance > 10 || budgetSpentPercent > 80) {
    return { label: "At Risk", tone: "warning" };
  }
  if (budgetSpentPercent === 0 && progress === 0) {
    return { label: "Not Started", tone: "neutral" };
  }
  return { label: "On Track", tone: "success" };
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

  const health = computeBudgetHealth(project.spentAmount ?? 0, project.totalBudget ?? 0);
  const budgetPct = health.displayPercent;
  const progress = project.progress ?? Math.round(Math.min(100, budgetPct * 0.9));

  const healthStatus = calculateHealthStatus(progress, budgetPct);
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

  const progressBarColor =
    progress >= 80
      ? "bg-jenga-success"
      : progress >= 40
        ? "bg-jenga-primary"
        : "bg-jenga-secondary";

  const budgetBarColor =
    health.status === "danger"
      ? "bg-jenga-danger"
      : health.status === "warning"
        ? "bg-jenga-warning"
        : "bg-jenga-success";

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
            "block h-full jt-card p-5 cursor-pointer relative overflow-hidden",
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
              {statusLabel}
            </StatusBadge>
          </div>

          {/* Progress + Budget bars */}
          <div className="space-y-3 mb-4 relative z-10">
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" />
                  Progress
                </span>
                <span className="text-foreground font-mono tabular-nums font-semibold">
                  {progress}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", progressBarColor)}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                  <Wallet className="h-3 w-3" />
                  Budget Used
                </span>
                <span
                  className={cn(
                    "font-mono tabular-nums font-semibold",
                    (health.status === "danger" || health.status === "critical") &&
                      "text-jenga-danger",
                    health.status === "warning" && "text-jenga-warning",
                    health.status === "healthy" && "text-jenga-success",
                  )}
                >
                  {budgetPct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", budgetBarColor)}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, budgetPct)}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                />
              </div>
            </div>
          </div>

          {/* Budget amounts */}
          <div className="pt-3 border-t border-border/60 relative z-10">
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-muted-foreground">Spent</span>
              <div className="flex items-baseline gap-1.5">
                <CurrencyValue
                  value={health.spent}
                  currency={currency}
                  compact
                  size="sm"
                  tone="accent"
                />
                <span className="text-muted-foreground text-[11px]">/</span>
                <CurrencyValue
                  value={health.total}
                  currency={currency}
                  compact
                  size="sm"
                  tone="muted"
                />
              </div>
            </div>
          </div>

          {/* Footer: health + last activity */}
          <div className="flex items-center justify-between mt-3 relative z-10">
            <StatusBadge tone={healthStatus.tone} size="sm" dot>
              {healthStatus.label}
            </StatusBadge>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(project.lastActivityAt)}
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
