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

  const hrefWithProject = (path: string) =>
    currentProject ? `${path}?project=${currentProject.id}` : path;

  const itemClass = (isActive: boolean) =>
    cn(
      "relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-all duration-200 touch-manipulation",
      "active:scale-[0.96]",
      isActive
        ? "text-jenga-primary"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <>
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 md:hidden",
          "grid min-h-[3.75rem] grid-cols-5 items-stretch",
          "border-t border-border/60 bg-jenga-surface/95 backdrop-blur-lg supports-[backdrop-filter]:bg-jenga-surface/80",
          "pb-safe shadow-[0_-8px_32px_rgba(0,0,0,0.4)]",
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
                    className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-jenga-primary shadow-glow"
                    aria-hidden
                  />
                )}
                <tab.icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-transform",
                    isActive && "scale-110",
                  )}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  aria-hidden
                />
                <span
                  className={cn(
                    "w-full truncate text-center text-[10px] font-medium leading-tight",
                    isActive && "font-semibold",
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
          aria-label={t("nav.more")}
          aria-expanded={moreOpen}
        >
          {moreOpen && (
            <span
              className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-jenga-primary shadow-glow"
              aria-hidden
            />
          )}
          <Menu className="h-5 w-5 shrink-0" aria-hidden />
          <span className="w-full truncate text-center text-[10px] font-medium leading-tight">
            {t("nav.more")}
          </span>
        </button>
      </nav>
      <MoreBottomSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
