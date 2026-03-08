"use client";

import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import {
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
  Plus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const SIDEBAR_OPEN_KEY = "jengatrack-sidebar-open";

const MAIN_NAV = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.budgets", href: "/budget", icon: Wallet },
  { labelKey: "nav.materials", href: "/materials", icon: Package },
  { labelKey: "nav.daily", href: "/daily", icon: Calendar },
  { labelKey: "nav.trends", href: "/trends", icon: TrendingUp },
];

const BOTTOM_NAV = [
  { labelKey: "nav.projects", href: "/projects", icon: FolderOpen },
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
  { labelKey: "nav.help", href: "/help", icon: HelpCircle },
];

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const [location] = useLocation();
  const { currentProject } = useProject();
  const { logout } = useAuth();
  const { t } = useLanguage();

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
        : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-4 border-transparent"
    );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
    <aside
      className={cn(
        "hidden md:flex fixed left-0 top-0 z-30 flex-col h-full bg-card border-r border-border transition-[width] duration-300 ease-out",
        open ? "w-[240px]" : "w-16"
      )}
    >
      {/* Logo + hamburger */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          <Menu className="h-5 w-5" />
        </button>
        {open ? (
          <Link href={hrefWithProject("/projects")}>
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/assets/images/logo.png"
                alt="JengaTrack"
                className="h-9 w-auto shrink-0 object-contain mix-blend-multiply dark:mix-blend-lighten"
              />
              <span className="font-heading font-semibold text-foreground truncate">
                JengaTrack
              </span>
            </div>
          </Link>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto py-3">
        {!open && (
          <div className="flex justify-center pb-2">
            <Link href={hrefWithProject("/projects")}>
              <div className="flex h-8 w-8 items-center justify-center shrink-0">
                <img
                  src="/assets/images/logo.png"
                  alt="JengaTrack"
                  className="h-8 w-auto max-h-8 object-contain mix-blend-multiply dark:mix-blend-lighten"
                />
              </div>
            </Link>
          </div>
        )}
        <nav className="flex-1 px-2 space-y-0.5">
          <div className="mb-2">
            {open ? (
              <Link href="/projects">
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                    "bg-[#00bcd4] text-black hover:bg-[#0097a7]",
                    "border-l-4 border-transparent"
                  )}
                >
                  <Plus className="h-5 w-5 shrink-0" />
                  <span className="truncate">New Project</span>
                </div>
              </Link>
            ) : (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/projects">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          "bg-[#00bcd4] text-black hover:bg-[#0097a7]"
                        )}
                      >
                        <Plus className="h-5 w-5" />
                      </div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-card border-border text-foreground">
                    New Project
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {MAIN_NAV.map((item) => {
            const active = isActive(item.href);
            const href = hrefWithProject(item.href);
            const el = (
              <Link key={item.href} href={href}>
                <div className={linkClass(active)}>
                  <item.icon className="h-5 w-5 shrink-0" />
                  {open && <span className="truncate">{t(item.labelKey)}</span>}
                </div>
              </Link>
            );
            if (!open) {
              return (
                <TooltipProvider key={item.href} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>{el}</TooltipTrigger>
                    <TooltipContent side="right" className="bg-card border-border text-foreground">
                      {t(item.labelKey)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }
            return el;
          })}
        </nav>

        <div className="mt-auto border-t border-border pt-3 space-y-0.5 px-2">
          {BOTTOM_NAV.map((item) => {
            const active = isActive(item.href);
            const href = hrefWithProject(item.href);
            const el = (
              <Link key={item.href} href={href}>
                <div className={linkClass(active)}>
                  <item.icon className="h-5 w-5 shrink-0" />
                  {open && <span className="truncate">{t(item.labelKey)}</span>}
                </div>
              </Link>
            );
            if (!open) {
              return (
                <TooltipProvider key={item.href} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>{el}</TooltipTrigger>
                    <TooltipContent side="right" className="bg-card border-border text-foreground">
                      {t(item.labelKey)}
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
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 border-l-4 border-transparent"
                    )}
                  >
                    <LogOut className="h-5 w-5 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-card border-border text-foreground">
                  {t("nav.logout")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <button
              type="button"
              onClick={() => logout()}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 border-l-4 border-transparent"
              )}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="truncate">{t("nav.logout")}</span>
            </button>
          )}
        </div>
      </div>
    </aside>
    </>
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
