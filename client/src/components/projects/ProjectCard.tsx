"use client";

import React from "react";
import { Link } from "wouter";
import { MoreHorizontal } from "lucide-react";
import type { Project } from "@/contexts/ProjectContext";
import { useProject } from "@/contexts/ProjectContext";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
}

/** Format budget as short form with M (e.g. 350M) */
function formatShortBudget(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

/** Format relative time as "Updated Xh ago" or "Updated Xd ago" */
function formatRelativeTime(lastActivityAt?: string): string {
  if (!lastActivityAt) return "Updated 2h ago";
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
    return "Updated 2h ago";
  }
}

/** Calculate project health status */
function calculateHealthStatus(
  progress: number,
  budgetSpentPercent: number
): { status: "On Track" | "At Risk" | "Critical"; color: string; dotColor: string } {
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
  const progress = project.progress ?? Math.round(budgetSpentPct * 0.85);

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
        className="block rounded-2xl bg-[#1a1a1a] border border-zinc-800/50 p-5 hover:border-zinc-700/50 transition-all duration-200 group cursor-pointer"
      >
        {/* Header: Project name and menu */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-white text-lg truncate pr-2">
            {project.name}
          </h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="p-1 rounded-full hover:bg-zinc-800 transition-colors"
          >
            <MoreHorizontal className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* Completion Percentage */}
        <div className="mb-4">
          <span className="text-3xl font-bold text-white">
            {progress}%
          </span>
          <span className="text-sm text-zinc-400 ml-1">Complete</span>
        </div>

        {/* Dual Progress Bars */}
        <div className="space-y-2 mb-4">
          {/* Progress bar (green) */}
          <div className="relative h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#22c55e] to-[#14b8a6]"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Expenditure bar (teal/cyan) */}
          <div className="relative h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#0f766e] to-[#14b8a6]"
              style={{ width: `${budgetSpentPct}%` }}
            />
          </div>
        </div>

        {/* Budget display */}
        <div className="mb-4">
          <p className="text-sm text-zinc-300 font-medium">
            UGX {formatShortBudget(spent)} / {formatShortBudget(total)}
          </p>
        </div>

        {/* Footer: Status badge and time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", health.dotColor)} />
            <span className={cn("text-sm font-medium", health.color)}>{health.status}</span>
          </div>
          <span className="text-sm text-zinc-500">
            {formatRelativeTime(project.lastActivityAt)}
          </span>
        </div>
      </a>
    </Link>
  );
}