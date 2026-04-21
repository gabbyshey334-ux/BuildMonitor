"use client";

import React from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/**
 * JengaTrack Logo
 * -----------------------------------------------------------
 * Uses the REAL logo artwork from `client/public/assets/images/logo.png`
 * (served at `/assets/images/logo.png`). The artwork is icon-only —
 * the wordmark "JengaTrack" is typeset beside it using the Syne display
 * font.
 *
 * Variants
 *   - full           icon + wordmark (default)
 *   - icon-only      icon only (for collapsed sidebar / favicon / watermark)
 *   - wordmark-only  text only (rare — used in report headers)
 *
 * Size scale (per design spec)
 *   xs → icon 20 | wordmark 16
 *   sm → icon 28 | wordmark 20
 *   md → icon 36 | wordmark 26   (default)
 *   lg → icon 48 | wordmark 36
 *   xl → icon 64 | wordmark 48
 */

export type LogoVariant = "full" | "icon-only" | "wordmark-only";
export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
  /** When provided, wraps the logo in a wouter `<Link>` for navigation. */
  linkTo?: string;
  /** Show "Built on Site. Powered by AI." tagline under the wordmark. */
  showTagline?: boolean;
  /** Override the image src (e.g. for hashed imports). Defaults to public path. */
  src?: string;
  /** Tone for the wordmark text. `default` = foreground, `light` = white, `inverse` = background. */
  tone?: "default" | "light" | "inverse";
}

const LOGO_SRC = "/assets/images/logo.png";

const SIZE: Record<
  LogoSize,
  { icon: number; wordPx: string; taglinePx: string; gap: string }
> = {
  xs: { icon: 20, wordPx: "text-[16px]", taglinePx: "text-[9px]", gap: "gap-1.5" },
  sm: { icon: 28, wordPx: "text-[20px]", taglinePx: "text-[10px]", gap: "gap-2" },
  md: { icon: 36, wordPx: "text-[26px]", taglinePx: "text-[11px]", gap: "gap-2.5" },
  lg: { icon: 48, wordPx: "text-[36px]", taglinePx: "text-[12px]", gap: "gap-3" },
  xl: { icon: 64, wordPx: "text-[48px]", taglinePx: "text-[13px]", gap: "gap-4" },
};

const TONE_CLS: Record<NonNullable<LogoProps["tone"]>, string> = {
  default: "text-foreground",
  light: "text-white",
  inverse: "text-background",
};

function LogoIcon({ px, className }: { px: number; className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      aria-hidden="true"
      width={px}
      height={px}
      className={cn(
        "shrink-0 select-none object-contain pointer-events-none",
        className,
      )}
      style={{ width: px, height: px }}
      draggable={false}
      loading="eager"
      decoding="async"
    />
  );
}

/** Full-page loading pulse variant of the logo. */
export const LogoLoadingScreen = React.memo(function LogoLoadingScreen() {
  return (
    <div
      role="status"
      aria-label="Loading JengaTrack"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background gap-4"
    >
      <div
        className="animate-pulse"
        style={{
          animationDuration: "1.8s",
          animationTimingFunction: "ease-in-out",
        }}
      >
        <JengaTrackLogo variant="full" size="lg" showTagline />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
});

/** A subtle logo watermark used as background on empty states. */
export const LogoWatermark = React.memo(function LogoWatermark({
  className,
  size = 220,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <LogoIcon
      px={size}
      className={cn(
        "absolute inset-0 m-auto opacity-[0.06] pointer-events-none select-none",
        className,
      )}
    />
  );
});

/**
 * Primary logo component. Memoized — the image src is static so this is
 * safely cacheable.
 */
export const JengaTrackLogo = React.memo(function JengaTrackLogo({
  variant = "full",
  size = "md",
  className,
  linkTo,
  showTagline = false,
  src,
  tone = "default",
}: LogoProps) {
  const s = SIZE[size];
  const iconSrc = src ?? LOGO_SRC;

  const body =
    variant === "icon-only" ? (
      <img
        src={iconSrc}
        alt="JengaTrack"
        width={s.icon}
        height={s.icon}
        draggable={false}
        loading="eager"
        decoding="async"
        className={cn(
          "shrink-0 select-none object-contain pointer-events-none",
          className,
        )}
        style={{ width: s.icon, height: s.icon }}
      />
    ) : variant === "wordmark-only" ? (
      <span className={cn("flex flex-col leading-none", className)}>
        <span
          className={cn(
            "font-display font-bold tracking-tight",
            s.wordPx,
            TONE_CLS[tone],
          )}
        >
          JengaTrack
        </span>
        {showTagline && (
          <span
            className={cn(
              "font-body font-medium tracking-wide text-muted-foreground mt-1",
              s.taglinePx,
            )}
          >
            Built on Site. Powered by AI.
          </span>
        )}
      </span>
    ) : (
      // full
      <span className={cn("inline-flex items-center", s.gap, className)}>
        <LogoIcon px={s.icon} />
        <span className="flex flex-col leading-none min-w-0">
          <span
            className={cn(
              "font-display font-bold tracking-tight truncate",
              s.wordPx,
              TONE_CLS[tone],
            )}
          >
            JengaTrack
          </span>
          {showTagline && (
            <span
              className={cn(
                "font-body font-medium tracking-wide text-muted-foreground mt-1 truncate",
                s.taglinePx,
              )}
            >
              Built on Site. Powered by AI.
            </span>
          )}
        </span>
      </span>
    );

  const content = (
    <span
      role="img"
      aria-label="JengaTrack logo"
      className="inline-flex items-center max-w-full"
    >
      {body}
    </span>
  );

  if (linkTo) {
    return (
      <Link
        href={linkTo}
        aria-label="JengaTrack home"
        className="inline-flex items-center max-w-full rounded-btn focus:outline-none focus-visible:ring-2 focus-visible:ring-jenga-primary/60"
      >
        {content}
      </Link>
    );
  }

  return content;
});

/**
 * Compatibility alias. Some older call-sites still import `JengaTrackIcon`.
 * It now renders the REAL icon, not the fake generated SVG.
 */
export const JengaTrackIcon = React.memo(function JengaTrackIcon({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return <LogoIcon px={size} className={className} />;
});

export default JengaTrackLogo;
