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

  return (
    <>
      <nav
        className={cn(
          "lg:hidden",
          "fixed bottom-0 left-0 right-0 z-50",
          "flex items-stretch",
          "bg-[hsl(var(--card))]/96 backdrop-blur-xl",
          "supports-[backdrop-filter]:bg-[hsl(var(--card))]/88",
          "border-t border-border/40",
          "shadow-[0_-4px_24px_rgba(0,0,0,0.08)]",
          "dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]",
          "mobile-nav-safe",
        )}
        aria-label="Primary"
      >
        <div className="flex flex-1 items-stretch px-1 pb-1 pt-1.5">
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
                className="flex flex-1 min-w-0"
              >
                <div
                  className={cn(
                    "relative flex flex-1 flex-col items-center justify-center",
                    "min-h-[52px] gap-0.5 rounded-xl mx-0.5",
                    "transition-all duration-200 touch-manipulation active:scale-[0.94]",
                    "focus-visible:outline-none focus-visible:ring-2",
                    "focus-visible:ring-primary/60 focus-visible:ring-inset",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  <tab.icon
                    className={cn(
                      "h-[22px] w-[22px] shrink-0 transition-all duration-200",
                      isActive ? "scale-110" : "scale-100",
                    )}
                    strokeWidth={isActive ? 2.3 : 1.7}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "text-[10px] font-body leading-none tracking-wide transition-all duration-200 truncate max-w-full px-1",
                      isActive
                        ? "font-semibold opacity-100"
                        : "font-medium opacity-70",
                    )}
                  >
                    {label}
                  </span>
                </div>
              </Link>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label={t("nav.more") || "More"}
            aria-expanded={moreOpen}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center",
              "min-h-[52px] gap-0.5 rounded-xl mx-0.5",
              "transition-all duration-200 touch-manipulation active:scale-[0.94]",
              moreOpen
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            <MoreHorizontal
              className={cn(
                "h-[22px] w-[22px] shrink-0 transition-all duration-200",
                moreOpen ? "scale-110" : "scale-100",
              )}
              strokeWidth={moreOpen ? 2.3 : 1.7}
              aria-hidden
            />
            <span
              className={cn(
                "text-[10px] font-body leading-none tracking-wide transition-all duration-200",
                moreOpen
                  ? "font-semibold opacity-100"
                  : "font-medium opacity-70",
              )}
            >
              {t("nav.more") || "More"}
            </span>
          </button>
        </div>
      </nav>
      <MoreBottomSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
