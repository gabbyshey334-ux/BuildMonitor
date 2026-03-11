"use client";

import React from "react";
import { Link } from "wouter";
import { MoreHorizontal } from "lucide-react";
import type { Project } from "@/contexts/ProjectContext";
import { useProject } from "@/contexts/ProjectContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectCardProps {
  project: Project;
}

/** Format budget as short form with M (e.g. 350M) */
function formatShortBudget(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

/** Format relative time */
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
    return `${diffDays}d ago`;
  } catch {
    return "Recently";
  }
}

/** Calculate project health status */
function calculateHealthStatus(
  progress: number,
  budgetSpentPercent: number
): { status: "On Track" | "At Risk" | "Delayed"; color: string; dotColor: string } {
  // Simple heuristic: if spending is significantly higher than progress
  const variance = budgetSpentPercent - progress;

  if (variance > 25 || budgetSpentPercent > 95) {
    return { status: "Delayed", color: "text-red-500", dotColor: "bg-red-500" };
  }
  if (variance > 10 || budgetSpentPercent > 80) {
    return { status: "At Risk", color: "text-amber-500", dotColor: "bg-amber-500" };
  }
  return { status: "On Track", color: "text-emerald-500", dotColor: "bg-emerald-500" };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { setCurrentProject } = useProject();
  const total = project.totalBudget ?? 0;
  const spent = project.spentAmount ?? 0;
  const budgetSpentPct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  // Fallback progress logic if not provided
  const progress = project.progress ?? Math.round(Math.min(100, budgetSpentPct * 0.9)); 

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

  // Determine expenditure bar color
  let expenditureBarColor = "bg-emerald-500";
  if (budgetSpentPct > 80) expenditureBarColor = "bg-red-500";
  else if (budgetSpentPct > 60) expenditureBarColor = "bg-amber-500";

  // Status badge styling
  const statusColors: Record<string, string> = {
    active: "bg-[#00bcd4]/10 text-[#00bcd4] border-[#00bcd4]/20",
    completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    on_hold: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    archived: "bg-zinc-500/10 text-muted-foreground border-border",
  };
  const statusStyle = statusColors[project.status || "active"] || statusColors.active;
  const statusLabel = (project.status || "Active").replace("_", " ");

  return (
    <div className="relative group">
      <Link href={`/dashboard?project=${project.id}`}>
        <div
          role="link"
          onClick={handleClick}
          className="block h-full bg-card border border-border rounded-xl p-5 hover:border-border hover:scale-[1.02] transition-all duration-300 relative overflow-hidden shadow-lg cursor-pointer"
        >
          {/* Faint Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00bcd4] opacity-[0.02] blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none group-hover:opacity-[0.05] transition-opacity" />

          {/* Header */}
          <div className="flex justify-between items-start mb-4 relative z-10">
            <h3 className="font-bold text-foreground text-lg truncate pr-2 flex-1">
              {project.name}
            </h3>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border", statusStyle)}>
              {statusLabel}
            </span>
          </div>

          {/* Progress Bars */}
          <div className="space-y-3 mb-5 relative z-10">
            {/* Progress */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground font-medium">Progress</span>
                <span className="text-[#00bcd4] font-bold">{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#00bcd4] rounded-full transition-all duration-500" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>

            {/* Expenditure */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground font-medium">Expenditure</span>
                <span className={cn("font-bold", budgetSpentPct > 80 ? "text-red-500" : budgetSpentPct > 60 ? "text-amber-500" : "text-emerald-500")}>
                  {Math.round(budgetSpentPct)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", expenditureBarColor)} 
                  style={{ width: `${budgetSpentPct}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Budget Row */}
          <div className="mb-4 pt-4 border-t border-border relative z-10">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Budget Spent</span>
              <span className="text-muted-foreground font-medium">
                UGX {formatShortBudget(spent)} <span className="text-muted-foreground">/ {formatShortBudget(total)}</span>
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", health.dotColor)} />
              <span className={cn("text-xs font-medium", health.color)}>
                {health.status}
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              Updated {formatRelativeTime(project.lastActivityAt)}
            </span>
          </div>
        </div>
      </Link>

      {/* Context Menu (Separate from main click area to avoid bubbling issues if handled correctly, but positioning absolute over the card works better for UX usually. 
          Here we place it absolute top-right, z-20 to be clickable above the link) */}
      <div className="absolute top-4 right-2 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard?project=${project.id}`}>
                <span className="cursor-pointer hover:bg-muted/50 w-full block">View Dashboard</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/settings?project=${project.id}`}>
                <span className="cursor-pointer hover:bg-muted/50 w-full block">Edit Project</span>
              </Link>
            </DropdownMenuItem>
            {/* Add Delete logic if needed, or keep generic actions */}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
