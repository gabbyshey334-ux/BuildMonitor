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

const TABS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Budget", href: "/budget", icon: Wallet },
  { label: "Materials", href: "/materials", icon: Package },
  { label: "Daily", href: "/daily", icon: Calendar },
];

export function BottomNav() {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { currentProject } = useProject();

  const hrefWithProject = (path: string) => {
    return currentProject ? `${path}?project=${currentProject.id}` : path;
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex items-center justify-around py-2 px-2 pb-safe dark:bg-[#1a1d2e] bg-white border-t dark:border-zinc-700 border-slate-200"
      >
        {TABS.map((tab) => {
          const href = hrefWithProject(tab.href);
          const isActive =
            location === tab.href ||
            location.startsWith(tab.href + "/") ||
            location.startsWith(tab.href + "?");
          return (
            <Link key={tab.href} href={href}>
              <a
                className={cn(
                  "flex flex-col items-center justify-center gap-1 min-w-[56px] py-2 rounded-lg transition-all duration-200",
                  isActive ? "text-[#22c55e]" : "dark:text-zinc-500 dark:hover:text-zinc-300 text-slate-400 hover:text-slate-600"
                )}
              >
                <tab.icon className="h-6 w-6" />
                <span className="text-xs font-medium">{tab.label}</span>
              </a>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center gap-1 min-w-[56px] py-2 rounded-lg transition-all duration-200",
            moreOpen ? "text-[#22c55e]" : "dark:text-zinc-500 dark:hover:text-zinc-300 text-slate-400 hover:text-slate-600"
          )}
          aria-label="More"
        >
          <Menu className="h-6 w-6" />
          <span className="text-xs font-medium">More</span>
        </button>
      </nav>
      <MoreBottomSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
