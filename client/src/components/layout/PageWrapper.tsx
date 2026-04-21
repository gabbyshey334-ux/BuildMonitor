"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/usePageTitle";

export interface PageWrapperProps {
  /** Page title, used for <title> tag ("Page | JengaTrack"). */
  title?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Zero-scroll page wrapper.
 *
 * Fills the full height of <main> (which is `flex-1 min-h-0 overflow-hidden`
 * inside AppLayout), stacks its children vertically, and clips at the page
 * boundary. Horizontal padding only — vertical space is distributed by the
 * page's own flex children (`shrink-0` for fixed sections, `flex-1 min-h-0`
 * for the one scrollable region, if any).
 *
 * IMPORTANT: Do not add padding-bottom here for mobile bottom-nav clearance —
 * AppLayout already reserves that space at the shell level via
 * `pb-mobile-nav-offset lg:pb-0`.
 */
export function PageWrapper({ title, className, children }: PageWrapperProps) {
  usePageTitle(title);
  return (
    <div
      className={cn(
        "h-full w-full min-w-0 flex flex-col",
        "overflow-hidden",
        "px-4 sm:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default PageWrapper;
