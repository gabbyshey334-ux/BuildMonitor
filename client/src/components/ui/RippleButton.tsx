"use client";

import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  rippleColor?: string;
  className?: string;
  variant?: "default" | "primary" | "ghost" | "outline";
}

export function RippleButton({
  children,
  rippleColor = "rgba(255, 255, 255, 0.4)",
  className = "",
  variant = "default",
  onClick,
  ...props
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rippleId = useRef(0);

  const createRipple = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newRipple = {
      id: rippleId.current++,
      x,
      y,
    };

    setRipples((prev) => [...prev, newRipple]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      createRipple(event);
      onClick?.(event);
    },
    [createRipple, onClick]
  );

  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    primary: "bg-[#00bcd4] text-black font-semibold hover:bg-[#00acc1]",
    ghost: "hover:bg-muted",
    outline: "border border-border hover:bg-muted",
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      className={cn(
        "relative overflow-hidden rounded-lg px-4 py-2 transition-all duration-200",
        "active:scale-95",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: ripple.x - 10,
              top: ripple.y - 10,
              width: 20,
              height: 20,
              backgroundColor: rippleColor,
            }}
          />
        ))}
      </AnimatePresence>
      <span className="relative z-10">{children}</span>
    </button>
  );
}
