"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, useSpring, useTransform, useInView } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 1.5,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [hasAnimated, setHasAnimated] = useState(false);
  
  const spring = useSpring(0, {
    stiffness: 50,
    damping: 20,
  });
  
  const display = useTransform(spring, (current) => {
    if (decimals > 0) {
      return current.toFixed(decimals);
    }
    return Math.floor(current).toLocaleString();
  });
  
  const [displayValue, setDisplayValue] = useState("0");

  useEffect(() => {
    if (isInView && !hasAnimated) {
      spring.set(value);
      setHasAnimated(true);
    }
  }, [isInView, value, spring, hasAnimated]);

  useEffect(() => {
    const unsubscribe = display.on("change", (latest) => {
      setDisplayValue(String(latest));
    });
    return () => unsubscribe();
  }, [display]);

  return (
    <span ref={ref} className={className}>
      {prefix}{displayValue}{suffix}
    </span>
  );
}

interface BounceNumberProps {
  value: number;
  className?: string;
}

export function BounceNumber({ value, className = "" }: BounceNumberProps) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.5, color: "#22c55e" }}
      animate={{ scale: 1, color: "inherit" }}
      transition={{ 
        type: "spring",
        stiffness: 300,
        damping: 15
      }}
      className={className}
    >
      {value.toLocaleString()}
    </motion.span>
  );
}

interface MilestoneNumberProps {
  value: number;
  threshold: number;
  className?: string;
}

export function MilestoneNumber({ value, threshold, className = "" }: MilestoneNumberProps) {
  const [showCelebration, setShowCelebration] = useState(false);
  
  useEffect(() => {
    if (value >= threshold) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [value, threshold]);

  return (
    <span className={`relative inline-block ${className}`}>
      <AnimatedNumber value={value} className={showCelebration ? "text-emerald-500 font-bold" : ""} />
      {showCelebration && (
        <motion.span
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          className="absolute -right-6 -top-1"
        >
          ✨
        </motion.span>
      )}
    </span>
  );
}
