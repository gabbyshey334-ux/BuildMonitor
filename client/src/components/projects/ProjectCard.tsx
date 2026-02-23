"use client";

import React from "react";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import type { Project } from "@/contexts/ProjectContext";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
}

function formatUgx(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B UGX`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M UGX`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K UGX`;
  return `${n} UGX`;
}

function formatDate(s?: string) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  const total = project.totalBudget ?? 0;
  const spent = project.spentAmount ?? 0;
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  const isActive = project.status !== "completed";

  return (
    <Link href={`/dashboard?project=${project.id}`}>
      <a className="block rounded-xl border border-zinc-800/50 bg-zinc-900/80 p-5 hover:border-zinc-700 hover:bg-zinc-800/80 transition-all duration-200">
        <h3 className="font-heading font-semibold text-white text-lg truncate">
          {project.name}
        </h3>
        {project.location && (
          <p className="flex items-center gap-1.5 mt-1 text-sm text-zinc-400">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{project.location}</span>
          </p>
        )}
        <div className="mt-4">
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#14b8a6] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            <span className="text-zinc-300 font-medium">{formatUgx(spent)}</span>
            {" of "}
            <span>{formatUgx(total)}</span>
          </p>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Last activity: {formatDate(project.lastActivityAt)}
        </p>
        <span
          className={cn(
            "inline-block mt-3 px-2.5 py-0.5 rounded-full text-xs font-medium",
            isActive
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-zinc-600/30 text-zinc-400 border border-zinc-600/50"
          )}
        >
          {isActive ? "Active" : "Completed"}
        </span>
      </a>
    </Link>
  );
}
