"use client";

import React from "react";
import { motion } from "framer-motion";
import { Package, Plus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  illustration?: "box" | "search" | "chart" | "calendar";
}

const illustrations = {
  box: (
    <svg viewBox="0 0 200 200" className="w-32 h-32 text-muted-foreground/30">
      <rect x="40" y="80" width="120" height="80" rx="8" fill="currentColor" />
      <rect x="40" y="80" width="120" height="20" rx="8" fill="currentColor" opacity="0.6" />
      <rect x="90" y="65" width="20" height="20" rx="4" fill="currentColor" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 200 200" className="w-32 h-32 text-muted-foreground/30">
      <circle cx="90" cy="90" r="40" fill="none" stroke="currentColor" strokeWidth="8" />
      <line x1="120" y1="120" x2="160" y2="160" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 200 200" className="w-32 h-32 text-muted-foreground/30">
      <rect x="40" y="120" width="30" height="50" rx="4" fill="currentColor" />
      <rect x="85" y="80" width="30" height="90" rx="4" fill="currentColor" opacity="0.7" />
      <rect x="130" y="40" width="30" height="130" rx="4" fill="currentColor" opacity="0.4" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 200 200" className="w-32 h-32 text-muted-foreground/30">
      <rect x="40" y="60" width="120" height="100" rx="8" fill="currentColor" />
      <rect x="40" y="60" width="120" height="30" rx="8" fill="currentColor" opacity="0.6" />
      <circle cx="70" cy="45" r="8" fill="currentColor" />
      <circle cx="130" cy="45" r="8" fill="currentColor" />
    </svg>
  ),
};

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className = "",
  illustration = "box",
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-border bg-muted/20",
        className
      )}
    >
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="mb-4"
      >
        {icon || illustrations[illustration]}
      </motion.div>

      <motion.h3
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-lg font-semibold text-foreground mb-2"
      >
        {title}
      </motion.h3>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-sm text-muted-foreground max-w-sm mb-6"
      >
        {description}
      </motion.p>

      {actionLabel && onAction && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <Button
            onClick={onAction}
            className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            {actionLabel}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

// Guided empty state with steps
interface Step {
  title: string;
  description: string;
}

interface GuidedEmptyStateProps {
  title: string;
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

export function GuidedEmptyState({
  title,
  steps,
  currentStep,
  onStepClick,
  className = "",
}: GuidedEmptyStateProps) {
  return (
    <div className={cn("p-6 rounded-2xl border border-border bg-card", className)}>
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isPending = index > currentStep;

          return (
            <motion.button
              key={index}
              onClick={() => onStepClick?.(index)}
              disabled={isPending}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "w-full flex items-start gap-3 p-4 rounded-xl text-left transition-all",
                isActive && "bg-[#00bcd4]/10 border border-[#00bcd4]/30",
                isCompleted && "bg-emerald-500/10 border border-emerald-500/30",
                isPending && "opacity-50 cursor-not-allowed bg-muted/50",
                !isActive && !isCompleted && !isPending && "hover:bg-muted border border-transparent"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                  isActive && "bg-[#00bcd4] text-black",
                  isCompleted && "bg-emerald-500 text-white",
                  isPending && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? "✓" : index + 1}
              </div>
              
              <div>
                <h4 className={cn(
                  "font-medium",
                  isActive && "text-[#00bcd4]"
                )}>
                  {step.title}
                </h4>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>

              {isActive && (
                <ArrowRight className="w-5 h-5 ml-auto shrink-0 text-[#00bcd4]" />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
