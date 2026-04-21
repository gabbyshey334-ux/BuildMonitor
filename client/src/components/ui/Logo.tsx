"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * JengaTrack logo — stylized "J" monogram + wordmark.
 *
 * The icon evokes a plumb line / rebar over a cross-beam foundation, rendered
 * with the brand gradient (burnt orange → golden amber). Placed in every
 * surface of the app per the redesign spec (sidebar, topbar, empty states, etc).
 */

const SIZE_MAP = {
  xs: { icon: 20, wordmark: "text-sm", tagline: "text-[10px]" },
  sm: { icon: 28, wordmark: "text-base", tagline: "text-[11px]" },
  md: { icon: 36, wordmark: "text-lg", tagline: "text-xs" },
  lg: { icon: 56, wordmark: "text-3xl", tagline: "text-sm" },
  xl: { icon: 88, wordmark: "text-5xl", tagline: "text-base" },
} as const;

type LogoSize = keyof typeof SIZE_MAP;

export interface LogoProps {
  size?: LogoSize;
  variant?: "full" | "icon-only" | "wordmark-only";
  className?: string;
  showTagline?: boolean;
  tone?: "default" | "light" | "mono";
  onClick?: () => void;
}

export function JengaTrackIcon({
  size = 36,
  className,
  tone = "default",
}: {
  size?: number;
  className?: string;
  tone?: "default" | "light" | "mono";
}) {
  const uid = React.useId();
  const gradId = `jt-grad-${uid}`;
  const primary = tone === "mono" ? "currentColor" : "#E07B39";
  const secondary = tone === "mono" ? "currentColor" : "#C9A84C";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      role="img"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        fill={tone === "light" ? "#F0EDE6" : "#141714"}
      />
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2"
        opacity="0.5"
      />
      {/* Stylized J: construction rebar / plumb line */}
      <path
        d="M 40 14 L 40 40 Q 40 50 30 50 Q 20 50 20 40"
        stroke={`url(#${gradId})`}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Cross beam (construction I-beam feel) */}
      <rect x="28" y="12" width="16" height="4" rx="1.5" fill={`url(#${gradId})`} />
      {/* Foundation dot */}
      <circle cx="20" cy="40" r="2.5" fill={primary} />
    </svg>
  );
}

export function JengaTrackLogo({
  size = "md",
  variant = "full",
  className,
  showTagline = false,
  tone = "default",
  onClick,
}: LogoProps) {
  const s = SIZE_MAP[size];
  const Wrapper: keyof React.JSX.IntrinsicElements = onClick ? "button" : "div";

  if (variant === "icon-only") {
    return (
      <Wrapper
        onClick={onClick}
        className={cn("inline-flex items-center justify-center", className)}
        aria-label="JengaTrack"
      >
        <JengaTrackIcon size={s.icon} tone={tone} />
      </Wrapper>
    );
  }

  if (variant === "wordmark-only") {
    return (
      <Wrapper
        onClick={onClick}
        className={cn(
          "inline-flex flex-col items-start leading-none",
          className,
        )}
      >
        <span
          className={cn(
            "font-display font-bold tracking-tight",
            tone === "light" ? "text-[#141714]" : "text-[#F0EDE6]",
            s.wordmark,
          )}
        >
          JengaTrack
        </span>
        {showTagline && (
          <span className={cn("mt-1 text-muted-foreground font-body", s.tagline)}>
            Built on Site. Powered by AI.
          </span>
        )}
      </Wrapper>
    );
  }

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2.5 leading-none text-left",
        onClick && "cursor-pointer hover:opacity-90 active:opacity-80 transition",
        className,
      )}
      aria-label="JengaTrack — Built on Site. Powered by AI."
    >
      <JengaTrackIcon size={s.icon} tone={tone} />
      <span className="flex flex-col justify-center">
        <span
          className={cn(
            "font-display font-bold tracking-tight",
            tone === "light" ? "text-[#141714]" : "text-foreground",
            s.wordmark,
          )}
        >
          JengaTrack
        </span>
        {showTagline && (
          <span
            className={cn(
              "font-body text-muted-foreground mt-1",
              s.tagline,
            )}
          >
            Built on Site. Powered by AI.
          </span>
        )}
      </span>
    </Wrapper>
  );
}

export default JengaTrackLogo;

/** A 10% opacity watermark — used in empty states per spec */
export function LogoWatermark({ className, size = 320 }: { className?: string; size?: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "jt-logo-watermark absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none select-none",
        className,
      )}
    >
      <JengaTrackIcon size={size} />
    </div>
  );
}
