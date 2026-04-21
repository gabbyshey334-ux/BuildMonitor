"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";

export interface PageWrapperProps {
  /** Page title, used for <title> tag ("Page | JengaTrack"). */
  title?: string;
  /** Maximum content width. Default: 1600px. */
  maxWidth?: "default" | "narrow" | "wide" | "full";
  /** Remove bottom padding reserved for mobile nav (use on pages with own sticky footer). */
  noBottomPadding?: boolean;
  className?: string;
  children: React.ReactNode;
}

const MAX_WIDTH: Record<NonNullable<PageWrapperProps["maxWidth"]>, string> = {
  narrow: "max-w-3xl",
  default: "max-w-[1600px]",
  wide: "max-w-[1920px]",
  full: "max-w-full",
};

/**
 * Mobile-first page wrapper. Guarantees:
 *   - No horizontal overflow at any breakpoint
 *   - Responsive horizontal padding (12 → 16 → 24 → 32)
 *   - Bottom padding that clears the mobile nav bar on < lg, including the
 *     iOS home-indicator safe area (env(safe-area-inset-bottom))
 *   - Sets the page <title> if provided
 *
 * The `pb-mobile-nav-offset` utility in `index.css` resolves to
 * `calc(4.5rem + max(0.5rem, env(safe-area-inset-bottom, 0px)))` — that is,
 * 64px nav + 8-24px safe area. That guarantees the last item on every page
 * is always visible above the bottom navigation on mobile.
 */
export function PageWrapper({
  title,
  maxWidth = "default",
  noBottomPadding = false,
  className,
  children,
}: PageWrapperProps) {
  usePageTitle(title);
  return (
    <div
      className={cn(
        "w-full max-w-full min-h-full overflow-x-hidden",
        "px-3 xs:px-3 sm:px-4 md:px-6 lg:px-8",
        "pt-4 sm:pt-5 md:pt-6",
        noBottomPadding ? "pb-4" : "pb-mobile-nav-offset lg:pb-8",
      )}
    >
      <div className={cn("mx-auto w-full min-w-0", MAX_WIDTH[maxWidth], className)}>
        {children}
      </div>
    </div>
  );
}

export default PageWrapper;
