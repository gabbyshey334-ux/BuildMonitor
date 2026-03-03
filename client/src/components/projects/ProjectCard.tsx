"use client";

import React from "react";
import { Link } from "wouter";
import { MoreHorizontal } from "lucide-react";
import type { Project } from "@/contexts/ProjectContext";
import { useProject } from "@/contexts/ProjectContext";
import { formatBudget } from "@/lib/budgetUtils";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
}

/** Format budget as short form with M/B (e.g. 350M, 1.2B) */
function formatShortBudget(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

/** Format relative time as "Updated Xh ago" or "Updated Xd ago" */
function formatRelativeTime(lastActivityAt?: string): string {
  if (!lastActivityAt) return "Updated just now";
  try {
    const d = new Date(lastActivityAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 5) return "Updated just now";
    if (diffMins < 60) return `Updated ${diffMins}m ago`;
    if (diffHours < 24) return `Updated ${diffHours}h ago`;
    if (diffDays === 1) return "Updated 1d ago";
    return `Updated ${diffDays}d ago`;
  } catch {
    return "Updated just now";
  }
}

/** Calculate project health status based on budget vs progress */
function calculateHealthStatus(
  progress: number,
  budgetSpentPercent: number
): { status: "On Track" | "At Risk" | "Critical"; color: string; dotColor: string } {
  // If spending way ahead of progress, it's at risk
  const variance = budgetSpentPercent - progress;

  if (variance > 25 || budgetSpentPercent > 90) {
    return { status: "Critical", color: "text-red-400", dotColor: "bg-red-500" };
  }
  if (variance > 10 || budgetSpentPercent > 75) {
    return { status: "At Risk", color: "text-amber-400", dotColor: "bg-amber-500" };
  }
  return { status: "On Track", color: "text-emerald-400", dotColor: "bg-emerald-500" };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { setCurrentProject } = useProject();
  const total = project.totalBudget ?? 0;
  const spent = project.spentAmount ?? 0;
  const budgetSpentPct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  const progress = project.progress ?? Math.round(budgetSpentPct * 0.85); // Estimate if not set
  const isActive = project.status !== "completed";
  const hasBudget = total > 0;

  const health = calculateHealthStatus(progress, budgetSpentPct);

  const handleClick = () => {
    setCurrentProject(project);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("jenga_current_project", project.id);
      } catch {
        // ignore
      }
    }
  };

  return (
    <Link href={`/dashboard?project=${project.id}`}>
      <a
        onClick={handleClick}
        className="block rounded-xl border dark:border-zinc-700/50 border-slate-200 dark:bg-zinc-800/90 bg-white shadow-sm p-5 hover:border-zinc-600 dark:hover:bg-zinc-800 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 group"
      >
        {/* Header: Project name and menu */}
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-heading font-semibold dark:text-white text-slate-800 text-lg truncate pr-2">
            {project.name}
          </h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="p-1 rounded-full hover:dark:bg-zinc-700 hover:bg-slate-200 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="h-5 w-5 dark:text-zinc-400 text-slate-500" />
          </button>
        </div>

        {/* Completion Percentage */}
        <div className="mb-4">
          <span className="font-heading text-2xl font-bold dark:text-white text-slate-800">
            {progress}%
          </span>
          <span className="text-sm dark:text-zinc-400 text-slate-500 ml-1">Complete</span>
        </div>

        {/* Dual Progress Bars */}
        <div className="space-y-2 mb-4">
          {/* Progress bar (green) */}
          <div className="relative h-6 rounded-full dark:bg-zinc-700 bg-slate-200 overflow-hidden flex items-center">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
            <span className="relative z-10 pl-2 text-xs font-medium text-white drop-shadow-sm">Progress</span>
          </div>
          {/* Expenditure bar (blue/cyan) */}
          {hasBudget && (
            <div className="relative h-6 rounded-full dark:bg-zinc-700 bg-slate-200 overflow-hidden flex items-center">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${budgetSpentPct}%` }}
              />
              <span className="relative z-10 pl-2 text-xs font-medium text-white drop-shadow-sm">Expenditure</span>
            </div>
          )}
        </div>

        {/* Budget display */}
        <div className="mb-3">
          {hasBudget ? (
            <p className="text-sm dark:text-zinc-300 text-slate-700 font-medium">
              UGX {formatShortBudget(spent)} / {formatShortBudget(total)}
            </p>
          ) : (
            <p className="text-sm dark:text-zinc-500 text-slate-500">No budget set</p>
          )}
        </div>

        {/* Footer: Status badge and time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", health.dotColor)} />
            <span className={cn("text-xs font-medium", health.color)}>{health.status}</span>
          </div>
          <span className="text-xs dark:text-zinc-500 text-slate-500">
            {formatRelativeTime(project.lastActivityAt)}
          </span>
        </div>
      </a>
    </Link>
  );
}
