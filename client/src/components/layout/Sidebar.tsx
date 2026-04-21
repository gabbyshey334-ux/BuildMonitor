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
  ChevronLeft,
  ChevronRight,
  Plus,
  MessageCircle,
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
import { JengaTrackLogo, JengaTrackIcon } from "@/components/ui/Logo";

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
  const { user, logout } = useAuth();
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
      "relative flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jenga-primary/60 focus-visible:ring-offset-0",
      active
        ? "bg-jenga-primary/10 text-jenga-primary"
        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
    );

  const hasWhatsApp = !!user?.whatsappNumber;
  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "hidden md:flex fixed left-0 top-0 z-30 flex-col h-screen",
          "bg-[var(--jt-sidebar-bg,#0A0C0A)] border-r border-border/60",
          "transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "w-sidebar-open" : "w-sidebar-closed",
        )}
        aria-label="Primary navigation"
      >
        {/* Logo area */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-border/60",
            open ? "px-4 justify-between" : "px-0 justify-center",
          )}
        >
          {open ? (
            <Link href="/projects">
              <div className="flex items-center">
                <JengaTrackLogo size="sm" variant="full" />
              </div>
            </Link>
          ) : (
            <Link href="/projects">
              <JengaTrackIcon size={32} />
            </Link>
          )}
          {open && (
            <button
              type="button"
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-btn text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* New Project CTA */}
        <div className={cn("px-3 pt-4 pb-2", !open && "px-2")}>
          {open ? (
            <Link href="/projects">
              <button
                type="button"
                className="group w-full flex items-center gap-2 rounded-btn bg-jenga-primary text-[#0D0F0E] font-semibold text-sm px-3 py-2.5 hover:bg-jenga-primary-hover transition-all shadow-glow hover:shadow-card-hover"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">New Project</span>
              </button>
            </Link>
          ) : (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/projects">
                    <button
                      type="button"
                      className="flex h-10 w-10 mx-auto items-center justify-center rounded-btn bg-jenga-primary text-[#0D0F0E] hover:bg-jenga-primary-hover transition-colors shadow-glow"
                      aria-label="New Project"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">New Project</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Primary nav */}
        <nav
          className={cn("flex-1 overflow-y-auto space-y-0.5", open ? "px-3 pt-2" : "px-2 pt-2")}
          aria-label="Main"
        >
          {!open && (
            <div className="px-1 mb-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground/70">
              •••
            </div>
          )}
          {MAIN_NAV.map((item) => {
            const active = isActive(item.href);
            const href = hrefWithProject(item.href);
            const content = (
              <Link key={item.href} href={href}>
                <div className={linkClass(active)}>
                  {active && (
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-jenga-primary"
                      aria-hidden
                    />
                  )}
                  <item.icon className="h-4.5 w-4.5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                  {open && <span className="truncate">{t(item.labelKey)}</span>}
                </div>
              </Link>
            );
            if (!open) {
              return (
                <TooltipProvider key={item.href} delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }
            return content;
          })}

          <div className="pt-4 mt-4 border-t border-border/40 space-y-0.5">
            {BOTTOM_NAV.map((item) => {
              const active = isActive(item.href);
              const href = hrefWithProject(item.href);
              const content = (
                <Link key={item.href} href={href}>
                  <div className={linkClass(active)}>
                    {active && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-jenga-primary"
                        aria-hidden
                      />
                    )}
                    <item.icon className="h-4.5 w-4.5 shrink-0" />
                    {open && <span className="truncate">{t(item.labelKey)}</span>}
                  </div>
                </Link>
              );
              if (!open) {
                return (
                  <TooltipProvider key={item.href} delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>{content}</TooltipTrigger>
                      <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }
              return content;
            })}
          </div>
        </nav>

        {/* Bottom area: project info + whatsapp + user */}
        <div
          className={cn(
            "mt-auto border-t border-border/60 bg-[var(--jt-sidebar-bg,#0A0C0A)]/60",
            open ? "p-3 space-y-3" : "p-2 space-y-2",
          )}
        >
          {/* Active project name */}
          {open && currentProject && (
            <div className="px-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Active Project
              </div>
              <div className="text-sm font-semibold text-foreground truncate">
                {currentProject.name}
              </div>
              {currentProject.location && (
                <div className="text-[11px] text-muted-foreground truncate">
                  {currentProject.location}
                </div>
              )}
            </div>
          )}

          {/* WhatsApp status */}
          {open ? (
            <div
              className={cn(
                "flex items-center gap-2 rounded-btn px-2.5 py-2 text-xs border",
                hasWhatsApp
                  ? "bg-jenga-whatsapp/10 border-jenga-whatsapp/30 text-jenga-whatsapp"
                  : "bg-muted/40 border-border/60 text-muted-foreground",
              )}
              role="status"
            >
              <MessageCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate font-medium">
                {hasWhatsApp ? "WhatsApp connected" : "Connect WhatsApp"}
              </span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  hasWhatsApp ? "bg-jenga-whatsapp animate-pulse" : "bg-muted-foreground/40",
                )}
              />
            </div>
          ) : (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex h-8 w-8 mx-auto items-center justify-center rounded-btn",
                      hasWhatsApp
                        ? "bg-jenga-whatsapp/15 text-jenga-whatsapp"
                        : "bg-muted/40 text-muted-foreground",
                    )}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {hasWhatsApp ? "WhatsApp connected" : "WhatsApp not connected"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* User + logout */}
          {open ? (
            <div className="flex items-center gap-2.5 rounded-btn p-2 hover:bg-muted/50 transition-colors">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-jenga-primary to-jenga-gold text-[#0D0F0E] text-xs font-bold">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-foreground">
                  {user?.fullName || "User"}
                </div>
                <div className="truncate text-[10px] text-muted-foreground font-mono">
                  {user?.whatsappNumber || "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-jenga-danger/10 hover:text-jenga-danger transition-colors"
                aria-label={t("nav.logout")}
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-8 w-8 mx-auto items-center justify-center rounded-full bg-gradient-to-br from-jenga-primary to-jenga-gold text-[#0D0F0E] text-[11px] font-bold">
                      {initials}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {user?.fullName || "User"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="flex h-8 w-8 mx-auto items-center justify-center rounded-md text-muted-foreground hover:bg-jenga-danger/10 hover:text-jenga-danger transition-colors"
                      aria-label={t("nav.logout")}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t("nav.logout")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onToggle}
                      className="flex h-8 w-8 mx-auto items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                      aria-label="Expand sidebar"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Expand</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

const SIDEBAR_WIDTH_OPEN = 260;
const SIDEBAR_WIDTH_COLLAPSED = 72;

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
    setOpen((prev: boolean) => {
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
