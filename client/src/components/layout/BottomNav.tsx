"use client";

import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import {
  LayoutDashboard,
  Wallet,
  Package,
  ClipboardList,
  MoreHorizontal,
} from "lucide-react";
import { MoreBottomSheet } from "./MoreBottomSheet";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const TABS = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.budgets", href: "/budget", icon: Wallet },
  { labelKey: "nav.materials", href: "/materials", icon: Package },
  { labelKey: "nav.daily", href: "/daily", icon: ClipboardList },
];

/**
 * Mobile bottom navigation.
 *
 * Visibility:
 *   < 1024px (xs, sm, md): visible.
 *   ≥ 1024px (lg+):        hidden — desktop uses the <Sidebar />.
 *
 * Height: 64px base + safe-area (handled by `mobile-nav-safe` utility).
 * Each tap target is min-h-[56px] flex-1 to guarantee ≥ 44×44px.
 */
export function BottomNav() {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { currentProject } = useProject();
  const { t } = useLanguage();

  const hrefWithProject = (path: string) =>
    currentProject ? `${path}?project=${currentProject.id}` : path;

  const itemClass = (isActive: boolean) =>
    cn(
      "relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5",
      "transition-all duration-200 touch-manipulation active:scale-[0.96]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jenga-primary/60 focus-visible:ring-inset",
      isActive
        ? "text-jenga-primary"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <>
      <nav
        className={cn(
          // Visible everywhere below lg; hidden on desktop
          "lg:hidden",
          "fixed bottom-0 left-0 right-0 z-50",
          "grid grid-cols-5 items-stretch",
          "border-t border-border/60",
          "bg-[var(--jt-sidebar-bg,#0A0C0A)]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--jt-sidebar-bg,#0A0C0A)]/85",
          "mobile-nav-safe",
          "shadow-[0_-8px_32px_rgba(0,0,0,0.45)]",
        )}
        aria-label="Primary"
      >
        {TABS.map((tab) => {
          const href = hrefWithProject(tab.href);
          const isActive =
            location === tab.href ||
            location.startsWith(tab.href + "/") ||
            location.startsWith(tab.href + "?");
          const label = t(tab.labelKey);
          return (
            <Link
              key={tab.href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
              className="flex h-full min-h-0 min-w-0"
            >
              <div className={itemClass(isActive)}>
                {isActive && (
                  <span
                    className="absolute top-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-jenga-primary shadow-glow"
                    aria-hidden
                  />
                )}
                <tab.icon
                  className={cn(
                    "h-6 w-6 shrink-0 transition-transform",
                    isActive && "scale-105",
                  )}
                  strokeWidth={isActive ? 2.2 : 1.7}
                  aria-hidden
                />
                <span
                  className={cn(
                    "w-full truncate text-center text-[10px] font-body leading-tight tracking-wide",
                    isActive ? "font-semibold" : "font-medium",
                  )}
                >
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={itemClass(moreOpen)}
          aria-label={t("nav.more") || "More"}
          aria-expanded={moreOpen}
        >
          {moreOpen && (
            <span
              className="absolute top-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-jenga-primary shadow-glow"
              aria-hidden
            />
          )}
          <MoreHorizontal className="h-6 w-6 shrink-0" aria-hidden />
          <span className="w-full truncate text-center text-[10px] font-body font-medium leading-tight">
            {t("nav.more") || "More"}
          </span>
        </button>
      </nav>
      <MoreBottomSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
