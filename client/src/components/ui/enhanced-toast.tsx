"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

interface EnhancedToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose: (id: string) => void;
}

const toastConfig = {
  success: {
    icon: CheckCircle,
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    iconColor: "text-emerald-500",
    progressColor: "bg-emerald-500",
  },
  error: {
    icon: AlertCircle,
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    iconColor: "text-red-500",
    progressColor: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    iconColor: "text-amber-500",
    progressColor: "bg-amber-500",
  },
  info: {
    icon: Info,
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    iconColor: "text-blue-500",
    progressColor: "bg-blue-500",
  },
};

export function EnhancedToast({
  id,
  type,
  title,
  message,
  duration = 5000,
  action,
  onClose,
}: EnhancedToastProps) {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const config = toastConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          onClose(id);
          return 0;
        }
        return prev - (100 / (duration / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [duration, id, isPaused, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={cn(
        "relative w-full max-w-sm overflow-hidden rounded-xl border shadow-lg",
        "bg-card",
        config.borderColor
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1", config.progressColor)} 
        style={{ width: `${progress}%`, transition: isPaused ? "none" : "width 0.1s linear" }} 
      />
      
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", config.iconColor)} />
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-foreground">{title}</h4>
            {message && (
              <p className="text-sm text-muted-foreground mt-1">{message}</p>
            )}
            
            {action && (
              <button
                onClick={() => {
                  action.onClick();
                  onClose(id);
                }}
                className={cn(
                  "mt-2 text-sm font-medium hover:underline",
                  config.iconColor
                )}
              >
                {action.label}
              </button>
            )}
          </div>
          
          <button
            onClick={() => onClose(id)}
            className="shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Toast container component
interface ToastContainerProps {
  children: React.ReactNode;
}

export function ToastContainer({ children }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full p-4 pointer-events-none">
      <div className="pointer-events-auto flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
}
