"use client";

import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import {
  Building2,
  LayoutDashboard,
  Wallet,
  Package,
  Calendar,
  TrendingUp,
  FolderOpen,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const SIDEBAR_OPEN_KEY = "jengatrack-sidebar-open";

const MAIN_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Budgets & Costs", href: "/budget", icon: Wallet },
  { label: "Materials & Supplies", href: "/materials", icon: Package },
  { label: "Daily Accountability", href: "/daily", icon: Calendar },
  { label: "Trends & Insights", href: "/trends", icon: TrendingUp },
];

const BOTTOM_NAV = [
  { label: "My Projects", href: "/projects", icon: FolderOpen },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Help", href: "/help", icon: HelpCircle },
];

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const [location] = useLocation();
  const { currentProject } = useProject();
  const { logout } = useAuth();

  const hrefWithProject = (path: string) => {
    if (path === "/projects" || path === "/help") return path;
    return currentProject ? `${path}?project=${currentProject.id}` : path;
  };

  const isActive = (href: string) =>
    location === href ||
    location.startsWith(href + "/") ||
    location.startsWith(href + "?");

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
      active
        ? "bg-[#22c55e]/15 text-[#22c55e] border-l-4 border-[#22c55e] pl-[calc(0.75rem-4px)]"
        : "dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200 text-slate-600 hover:bg-slate-100 border-l-4 border-transparent"
    );

  return (
    <aside
      className={cn(
        "hidden md:flex fixed left-0 top-0 z-30 flex-col h-full dark:bg-[#0a0a0a] bg-white border-r dark:border-zinc-800/50 border-slate-200 transition-[width] duration-300 ease-out",
        open ? "w-[240px]" : "w-16"
      )}
    >
      {/* Logo + hamburger */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b dark:border-zinc-800/50 border-slate-200 px-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          <Menu className="h-5 w-5" />
        </button>
        {open && (
          <Link href={hrefWithProject("/dashboard")}>
            <a className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-[#22c55e] to-[#14b8a6]">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="font-heading font-semibold dark:text-white text-slate-800 truncate">
                JengaTrack
              </span>
            </a>
          </Link>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto py-3">
        {!open && (
          <div className="flex justify-center pb-2">
            <Link href={hrefWithProject("/dashboard")}>
              <a className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-[#22c55e] to-[#14b8a6]">
                <Building2 className="h-4 w-4 text-white" />
              </a>
            </Link>
          </div>
        )}
        <nav className="flex-1 px-2 space-y-0.5">
          {MAIN_NAV.map((item) => {
            const active = isActive(item.href);
            const href = hrefWithProject(item.href);
            const el = (
              <Link key={item.href} href={href}>
                <a className={linkClass(active)}>
                  <item.icon className="h-5 w-5 shrink-0" />
                  {open && <span className="truncate">{item.label}</span>}
                </a>
              </Link>
            );
            if (!open) {
              return (
                <TooltipProvider key={item.href} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>{el}</TooltipTrigger>
                    <TooltipContent side="right" className="dark:bg-zinc-900 dark:border-zinc-700 dark:text-white bg-white border-slate-200 text-slate-800">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }
            return el;
          })}
        </nav>

        <div className="mt-auto border-t dark:border-zinc-800/50 border-slate-200 pt-3 space-y-0.5 px-2">
          {BOTTOM_NAV.map((item) => {
            const active = isActive(item.href);
            const href = hrefWithProject(item.href);
            const el = (
              <Link key={item.href} href={href}>
                <a className={linkClass(active)}>
                  <item.icon className="h-5 w-5 shrink-0" />
                  {open && <span className="truncate">{item.label}</span>}
                </a>
              </Link>
            );
            if (!open) {
              return (
                <TooltipProvider key={item.href} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>{el}</TooltipTrigger>
                    <TooltipContent side="right" className="dark:bg-zinc-900 dark:border-zinc-700 dark:text-white bg-white border-slate-200 text-slate-800">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }
            return el;
          })}
          {!open ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all duration-200 border-l-4 border-transparent"
                    )}
                  >
                    <LogOut className="h-5 w-5 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="dark:bg-zinc-900 dark:border-zinc-700 dark:text-white bg-white border-slate-200 text-slate-800">
                  Logout
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <button
              type="button"
              onClick={() => logout()}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 border-l-4 border-transparent"
              )}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="truncate">Logout</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

const SIDEBAR_WIDTH_OPEN = 240;
const SIDEBAR_WIDTH_COLLAPSED = 64;

export function useSidebarState() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem(SIDEBAR_OPEN_KEY);
      if (raw !== null) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return true;
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_OPEN_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return { open, toggle, width: open ? SIDEBAR_WIDTH_OPEN : SIDEBAR_WIDTH_COLLAPSED };
}
