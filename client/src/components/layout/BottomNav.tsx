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

// SHORT labels only — these go inside a narrow tab bar.
// Full translated labels (nav.budgets etc.) are used as aria-labels
// for accessibility but NOT rendered as visible text.
const TABS = [
  {
    labelKey: "nav.dashboard",
    shortLabel: "Home",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    labelKey: "nav.budgets",
    shortLabel: "Budget",
    href: "/budget",
    icon: Wallet,
  },
  {
    labelKey: "nav.materials",
    shortLabel: "Materials",
    href: "/materials",
    icon: Package,
  },
  {
    labelKey: "nav.daily",
    shortLabel: "Daily",
    href: "/daily",
    icon: ClipboardList,
  },
];

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
          "bg-[hsl(var(--card))]/95 backdrop-blur-xl",
          "supports-[backdrop-filter]:bg-[hsl(var(--card))]/88",
          "border-t border-border/50",
          "shadow-[0_-1px_0_0_hsl(var(--border)/0.6)]",
          "dark:shadow-[0_-8px_32px_rgba(0,0,0,0.5)]",
          "mobile-nav-safe",
        )}
        aria-label="Primary navigation"
      >
        <div className="flex flex-1 items-stretch px-1 pt-1 pb-0.5">

          {TABS.map((tab) => {
            const href = hrefWithProject(tab.href);
            const isActive =
              location === tab.href ||
              location.startsWith(tab.href + "/") ||
              location.startsWith(tab.href + "?");
            const fullLabel = t(tab.labelKey);

            return (
              <Link
                key={tab.href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                aria-label={fullLabel}
                className="flex flex-1 min-w-0"
              >
                <div
                  className={cn(
                    "relative flex flex-1 flex-col items-center justify-center",
                    "min-h-[52px] gap-[3px] rounded-xl mx-0.5 px-1",
                    "transition-all duration-200 ease-out",
                    "touch-manipulation active:scale-[0.93]",
                    "focus-visible:outline-none",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {/* Active pill background */}
                  {isActive && (
                    <span
                      className="absolute inset-0 rounded-xl bg-primary/10 dark:bg-primary/15"
                      aria-hidden
                    />
                  )}

                  {/* Active top bar indicator */}
                  {isActive && (
                    <span
                      className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full bg-primary"
                      aria-hidden
                    />
                  )}

                  <tab.icon
                    className={cn(
                      "relative h-[22px] w-[22px] shrink-0",
                      "transition-all duration-200",
                      isActive ? "scale-110" : "scale-100",
                    )}
                    strokeWidth={isActive ? 2.3 : 1.7}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "relative w-full text-center leading-none tracking-wide truncate",
                      "text-[10px]",
                      isActive
                        ? "font-semibold opacity-100"
                        : "font-medium opacity-60",
                    )}
                  >
                    {tab.shortLabel}
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
              "min-h-[52px] gap-[3px] rounded-xl mx-0.5 px-1",
              "transition-all duration-200 ease-out",
              "touch-manipulation active:scale-[0.93]",
              "focus-visible:outline-none",
              moreOpen
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {moreOpen && (
              <span
                className="absolute inset-0 rounded-xl bg-primary/10 dark:bg-primary/15"
                aria-hidden
              />
            )}
            {moreOpen && (
              <span
                className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full bg-primary"
                aria-hidden
              />
            )}
            <MoreHorizontal
              className={cn(
                "relative h-[22px] w-[22px] shrink-0 transition-all duration-200",
                moreOpen ? "scale-110" : "scale-100",
              )}
              strokeWidth={moreOpen ? 2.3 : 1.7}
              aria-hidden
            />
            <span
              className={cn(
                "relative text-[10px] leading-none tracking-wide",
                moreOpen
                  ? "font-semibold opacity-100"
                  : "font-medium opacity-60",
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
