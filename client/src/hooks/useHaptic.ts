"use client";

import { useCallback } from "react";

export type HapticType = "light" | "medium" | "heavy" | "success" | "error" | "warning";

export function useHaptic() {
  const isSupported = typeof navigator !== "undefined" && "vibrate" in navigator;

  const haptic = useCallback((type: HapticType = "light") => {
    if (!isSupported) return;

    const patterns: Record<HapticType, number[]> = {
      light: [10],
      medium: [20],
      heavy: [30],
      success: [10, 50, 10],
      error: [30, 50, 30, 50, 30],
      warning: [20, 50, 10],
    };

    navigator.vibrate(patterns[type]);
  }, [isSupported]);

  const hapticFeedback = useCallback((element: HTMLElement | null, type: HapticType = "light") => {
    if (!element) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            haptic(type);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(element);
    
    return () => observer.disconnect();
  }, [haptic]);

  return { haptic, hapticFeedback, isSupported };
}

// Hook for press-and-haptic effect
export function usePressHaptic(duration: number = 500, type: HapticType = "medium") {
  const { haptic } = useHaptic();

  const onPressStart = useCallback(() => {
    const timer = setTimeout(() => {
      haptic(type);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, haptic, type]);

  return { onPressStart };
}
