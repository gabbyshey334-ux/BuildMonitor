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
 *   - Bottom padding that clears the mobile nav bar on < lg
 *   - Sets the page <title> if provided
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
        noBottomPadding ? "pb-4" : "pb-24 lg:pb-8",
      )}
    >
      <div className={cn("mx-auto w-full", MAX_WIDTH[maxWidth], className)}>
        {children}
      </div>
    </div>
  );
}

export default PageWrapper;
