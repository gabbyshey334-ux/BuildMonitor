"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}

/**
 * Standard section-top header for app pages.
 * - Eyebrow (project name, module label, breadcrumb-like)
 * - Title (Syne, display font)
 * - Description (optional)
 * - Actions slot (right side, buttons / filters)
 * - Meta slot (below title, badges / status / last updated)
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "mb-6 md:mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-jenga-primary mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
        {meta && (
          <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </motion.header>
  );
}

export default PageHeader;
