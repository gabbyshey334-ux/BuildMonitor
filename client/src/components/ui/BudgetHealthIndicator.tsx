"use client";

import React from "react";
import { motion } from "framer-motion";
import { Heart, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type BudgetHealthStatus = "healthy" | "caution" | "warning" | "critical";

interface BudgetHealthIndicatorProps {
  spent: number;
  budget: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function BudgetHealthIndicator({
  spent,
  budget,
  className = "",
  showLabel = true,
  size = "md",
}: BudgetHealthIndicatorProps) {
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  
  let status: BudgetHealthStatus = "healthy";
  if (percentage >= 100) status = "critical";
  else if (percentage >= 90) status = "warning";
  else if (percentage >= 70) status = "caution";

  const config = {
    healthy: {
      icon: CheckCircle,
      label: "Healthy",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
      pulseColor: "rgba(34, 197, 94, 0.5)",
    },
    caution: {
      icon: AlertCircle,
      label: "Caution",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      pulseColor: "rgba(245, 158, 11, 0.5)",
    },
    warning: {
      icon: AlertTriangle,
      label: "At Risk",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/30",
      pulseColor: "rgba(249, 115, 22, 0.6)",
    },
    critical: {
      icon: Heart,
      label: "Critical",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      pulseColor: "rgba(239, 68, 68, 0.7)",
    },
  };

  const { icon: Icon, label, color, bgColor, borderColor, pulseColor } = config[status];

  const sizeClasses = {
    sm: "px-2 py-1 text-xs gap-1.5",
    md: "px-3 py-1.5 text-sm gap-2",
    lg: "px-4 py-2 text-base gap-2.5",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        bgColor,
        borderColor,
        color,
        sizeClasses[size],
        className
      )}
    >
      <motion.div
        animate={status !== "healthy" ? {
          scale: [1, 1.15, 1],
          opacity: [1, 0.7, 1],
        } : {}}
        transition={{
          duration: status === "critical" ? 0.8 : status === "warning" ? 1.2 : 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Icon className={cn(iconSizes[size])} />
      </motion.div>
      {showLabel && (
        <span>
          {label} ({percentage.toFixed(0)}%)
        </span>
      )}
      
      {/* Pulse effect for critical/warning states */}
      {(status === "critical" || status === "warning") && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: pulseColor }}
          animate={{
            scale: [1, 1.5],
            opacity: [0.5, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      )}
    </motion.div>
  );
}

// Progress bar with health coloring
interface BudgetProgressBarProps {
  spent: number;
  budget: number;
  className?: string;
  showPercentage?: boolean;
  animated?: boolean;
}

export function BudgetProgressBar({
  spent,
  budget,
  className = "",
  showPercentage = true,
  animated = true,
}: BudgetProgressBarProps) {
  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const actualPercentage = budget > 0 ? (spent / budget) * 100 : 0;
  
  let barColor = "bg-emerald-500";
  if (actualPercentage >= 100) barColor = "bg-red-500";
  else if (actualPercentage >= 90) barColor = "bg-orange-500";
  else if (actualPercentage >= 70) barColor = "bg-amber-500";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Budget Used</span>
        {showPercentage && (
          <span className={cn(
            "font-medium",
            actualPercentage >= 90 ? "text-red-500" : "text-foreground"
          )}>
            {percentage.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={animated ? { duration: 1, ease: "easeOut" } : { duration: 0 }}
          style={{
            boxShadow: actualPercentage >= 90 
              ? `0 0 10px ${barColor.replace("bg-", "")}` 
              : undefined
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span>{budget.toLocaleString()} Budget</span>
      </div>
    </div>
  );
}
