"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { LogoWatermark } from "./Logo";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  compact?: boolean;
  watermark?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
  watermark = true,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative rounded-card border border-dashed border-border/60 bg-card/40 overflow-hidden",
        compact ? "py-10 px-6" : "py-16 px-8",
        "flex flex-col items-center justify-center text-center",
        className,
      )}
    >
      {watermark && <LogoWatermark size={compact ? 200 : 360} />}
      <div className="relative flex flex-col items-center z-10">
        {Icon && (
          <div className="h-16 w-16 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mb-5 ring-1 ring-border">
            <Icon size={28} strokeWidth={1.75} />
          </div>
        )}
        <h3 className="font-display text-xl md:text-2xl font-semibold text-foreground mb-1.5 tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            {description}
          </p>
        )}
        {(action || secondaryAction) && (
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            {action}
            {secondaryAction}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default EmptyState;
