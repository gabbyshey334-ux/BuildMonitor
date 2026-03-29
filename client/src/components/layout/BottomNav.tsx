"use client";

import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import {
  LayoutDashboard,
  Wallet,
  Package,
  Calendar,
  Menu,
} from "lucide-react";
import { MoreBottomSheet } from "./MoreBottomSheet";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const TABS = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.budgets", href: "/budget", icon: Wallet },
  { labelKey: "nav.materials", href: "/materials", icon: Package },
  { labelKey: "nav.daily", href: "/daily", icon: Calendar },
];

export function BottomNav() {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { currentProject } = useProject();
  const { t } = useLanguage();

  const hrefWithProject = (path: string) => {
    return currentProject ? `${path}?project=${currentProject.id}` : path;
  };

  const itemClass = (isActive: boolean) =>
    cn(
      "flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 transition-all duration-200 touch-manipulation xs:gap-1 xs:px-1 xs:py-2",
      "active:scale-[0.97]",
      isActive
        ? "text-[#22c55e]"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <>
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 md:hidden",
          "grid min-h-[3.75rem] grid-cols-5 items-stretch px-0.5 xs:px-2",
          "border-t border-border bg-card/95 pb-safe shadow-[0_-6px_24px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-card/85",
          "dark:shadow-[0_-6px_28px_rgba(0,0,0,0.35)]",
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
              <div className={cn(itemClass(isActive), "relative h-full w-full")}>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-[#22c55e] max-[359px]:hidden"
                    aria-hidden
                  />
                )}
                <tab.icon
                  className="h-5 w-5 shrink-0 xs:h-6 xs:w-6"
                  aria-hidden
                />
                <span
                  className={cn(
                    "w-full truncate text-center text-[10px] font-medium leading-tight xs:text-xs",
                    "max-[359px]:sr-only",
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
          className={cn(itemClass(moreOpen), "relative h-full w-full")}
          aria-label={t("nav.more")}
          aria-expanded={moreOpen}
        >
          {moreOpen && (
            <span
              className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-[#22c55e] max-[359px]:hidden"
              aria-hidden
            />
          )}
          <Menu className="h-5 w-5 shrink-0 xs:h-6 xs:w-6" aria-hidden />
          <span
            className={cn(
              "w-full truncate text-center text-[10px] font-medium leading-tight xs:text-xs",
              "max-[359px]:sr-only",
            )}
          >
            {t("nav.more")}
          </span>
        </button>
      </nav>
      <MoreBottomSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
