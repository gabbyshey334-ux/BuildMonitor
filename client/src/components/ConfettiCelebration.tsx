"use client";

import React, { useCallback } from "react";
import confetti from "canvas-confetti";

interface ConfettiOptions {
  particleCount?: number;
  spread?: number;
  origin?: { x: number; y: number };
  colors?: string[];
  duration?: number;
}

export function useConfetti() {
  const triggerConfetti = useCallback((options: ConfettiOptions = {}) => {
    const {
      particleCount = 100,
      spread = 70,
      origin = { y: 0.6 },
      colors = ["#00bcd4", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"],
      duration = 3000,
    } = options;

    const end = Date.now() + duration;

    confetti({
      particleCount,
      spread,
      origin,
      colors,
      disableForReducedMotion: true,
    });

    const interval = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(interval);
        return;
      }

      confetti({
        particleCount: particleCount / 3,
        spread: spread * 0.8,
        origin: { x: Math.random(), y: Math.random() * 0.6 },
        colors,
        disableForReducedMotion: true,
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  const celebrateMilestone = useCallback(() => {
    triggerConfetti({
      particleCount: 150,
      spread: 100,
      colors: ["#22c55e", "#10b981", "#34d399", "#6ee7b7"],
      duration: 4000,
    });
  }, [triggerConfetti]);

  const celebrateStreak = useCallback(() => {
    triggerConfetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.8 },
      colors: ["#f59e0b", "#fbbf24", "#fcd34d", "#fde68a"],
      duration: 2500,
    });
  }, [triggerConfetti]);

  const celebrateLogin = useCallback(() => {
    triggerConfetti({
      particleCount: 60,
      spread: 50,
      colors: ["#00bcd4", "#22d3ee", "#67e8f9"],
      duration: 2000,
    });
  }, [triggerConfetti]);

  return {
    triggerConfetti,
    celebrateMilestone,
    celebrateStreak,
    celebrateLogin,
  };
}
