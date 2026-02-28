"use client";

import React from "react";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import type { Project } from "@/contexts/ProjectContext";
import { useProject } from "@/contexts/ProjectContext";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
}

/** Format number with commas and UGX (e.g. 1,900,000 UGX) */
function formatUgxWithCommas(n: number): string {
  const whole = Math.floor(n);
  const withCommas = whole.toLocaleString("en-US");
  return `${withCommas} UGX`;
}

function lastActivityLabel(lastActivityAt?: string): string {
  if (!lastActivityAt) return "No updates yet";
  try {
    const d = new Date(lastActivityAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return "Last update: Today";
    if (diffDays === 1) return "Last update: 1 day ago";
    if (diffDays < 30) return `Last update: ${diffDays} days ago`;
    return `Last update: ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  } catch {
    return "No updates yet";
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { setCurrentProject } = useProject();
  const total = project.totalBudget ?? 0;
  const spent = project.spentAmount ?? 0;
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  const isActive = project.status !== "completed";
  const hasBudget = total > 0;

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
        className="block rounded-xl border dark:border-zinc-800/50 border-slate-200 dark:bg-zinc-900/80 bg-white shadow-sm p-5 hover:border-zinc-700 hover:bg-zinc-800/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
      >
        <h3 className="font-heading font-semibold dark:text-white text-slate-800 text-lg truncate">
          {project.name}
        </h3>
        {project.location && (
          <p className="flex items-center gap-1.5 mt-1 text-sm dark:text-zinc-400 text-slate-500">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{project.location}</span>
          </p>
        )}
        <div className="mt-4">
          {hasBudget ? (
            <>
              <div className="h-2 rounded-full dark:bg-zinc-800 bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#14b8a6] transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-sm dark:text-zinc-400 text-slate-500">
                <span className="dark:text-zinc-300 text-slate-700 font-medium">{formatUgxWithCommas(spent)}</span>
                {" of "}
                <span>{formatUgxWithCommas(total)}</span>
              </p>
            </>
          ) : (
            <p className="text-sm dark:text-zinc-500 text-slate-500">No budget set</p>
          )}
        </div>
        <p className="mt-2 text-xs dark:text-zinc-500 text-slate-500">
          {lastActivityLabel(project.lastActivityAt)}
        </p>
        <span
          className={cn(
            "inline-block mt-3 px-2.5 py-0.5 rounded-full text-xs font-medium",
            isActive
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "dark:bg-zinc-600/30 dark:text-zinc-400 dark:border-zinc-600/50 bg-slate-100 text-slate-600 border border-slate-200"
          )}
        >
          {isActive ? "Active" : "Completed"}
        </span>
      </a>
    </Link>
  );
}
