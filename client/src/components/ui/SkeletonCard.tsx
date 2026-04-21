"use client";

import React from "react";
import { cn } from "@/lib/utils";

/** A single shimmer block. */
export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "jt-shimmer rounded-md bg-muted/50",
        className,
      )}
    />
  );
}

export function SkeletonKPI({ className }: { className?: string }) {
  return (
    <div className={cn("jt-card p-5 md:p-6 space-y-3", className)}>
      <div className="flex items-start justify-between">
        <Shimmer className="h-9 w-9 rounded-lg" />
        <Shimmer className="h-3 w-16" />
      </div>
      <Shimmer className="h-3 w-24" />
      <Shimmer className="h-8 w-32" />
      <Shimmer className="h-3 w-20" />
    </div>
  );
}

export function SkeletonRing({ className }: { className?: string }) {
  return (
    <div className={cn("jt-card p-6 flex flex-col items-center justify-center", className)}>
      <Shimmer className="h-64 w-64 rounded-full" />
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 jt-row py-3 border-b border-border/40 last:border-0", className)}>
      <Shimmer className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Shimmer className="h-3 w-3/4" />
        <Shimmer className="h-2.5 w-1/3" />
      </div>
      <Shimmer className="h-3 w-16" />
    </div>
  );
}

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn("jt-card p-6 space-y-4", className)}>
      <Shimmer className="h-4 w-40" />
      <Shimmer className="h-72 w-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("jt-card p-4", className)}>
      <Shimmer className="h-4 w-32 mb-4" />
      <div className="space-y-1">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}
