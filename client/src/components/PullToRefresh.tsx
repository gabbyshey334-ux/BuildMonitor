"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  pullDistance?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  className = "",
  pullDistance = 80,
}: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const controls = useAnimation();

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling || window.scrollY > 0) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > 0) {
        e.preventDefault();
        const progress = Math.min(diff / pullDistance, 1);
        setPullProgress(progress);

        if (containerRef.current) {
          containerRef.current.style.transform = `translateY(${diff * 0.5}px)`;
        }
      }
    },
    [isPulling, pullDistance]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    setIsPulling(false);

    if (pullProgress >= 1) {
      setIsRefreshing(true);
      controls.start({ rotate: 360, transition: { duration: 1, repeat: Infinity, ease: "linear" } });
      
      await onRefresh();
      
      setIsRefreshing(false);
      controls.stop();
      controls.set({ rotate: 0 });
    }

    setPullProgress(0);
    if (containerRef.current) {
      containerRef.current.style.transform = "translateY(0)";
      containerRef.current.style.transition = "transform 0.3s ease-out";
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.transition = "";
        }
      }, 300);
    }
  }, [isPulling, pullProgress, onRefresh, controls]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <motion.div
        className="absolute left-0 right-0 -top-20 flex justify-center items-end h-20 pb-2 pointer-events-none"
        animate={{
          opacity: pullProgress > 0 ? 1 : 0,
          y: pullProgress * 40,
        }}
      >
        <div className="flex flex-col items-center">
          <motion.div animate={controls}>
            <RefreshCw
              className={cn(
                "w-6 h-6",
                pullProgress >= 1 ? "text-[#00bcd4]" : "text-muted-foreground"
              )}
              style={{
                transform: `rotate(${pullProgress * 180}deg)`,
              }}
            />
          </motion.div>
          <span className="text-xs text-muted-foreground mt-1">
            {pullProgress >= 1 ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </motion.div>

      <div className={cn(isRefreshing && "opacity-70")}>{children}</div>
    </div>
  );
}
