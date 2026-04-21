"use client";

import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Menu,
  ChevronDown,
  Settings,
  LogOut,
  Plus,
  Bell,
  Search,
  Sun,
  Moon,
  HelpCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { JengaTrackLogo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

interface TopBarProps {
  onMenuClick?: () => void;
  showHamburger?: boolean;
}

/**
 * JengaTrack TopBar
 * 64px sticky, surface-colored, with hairline bottom border.
 * Desktop: page title + project switcher + actions on the right
 * Mobile:  brand logo + project switcher + avatar
 */
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/budget": "Budget",
  "/materials": "Materials",
  "/daily": "Daily Log",
  "/trends": "Trends & Analytics",
  "/projects": "Projects",
  "/settings": "Settings",
  "/help": "Help & Support",
  "/demo": "Demo",
};

export function TopBar({ onMenuClick, showHamburger = true }: TopBarProps) {
  const [location, setLocation] = useLocation();
  const currentPath = location.split("?")[0];
  const { user, logout } = useAuth();
  const { currentProject, projects, setCurrentProject } = useProject();
  const { toggleTheme, isDark } = useTheme();
  const { t } = useLanguage();
  const [projectOpen, setProjectOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const pageTitle = PAGE_TITLES[currentPath] ?? "JengaTrack";

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 md:gap-4",
        "border-b border-border/60 bg-jenga-surface/90 backdrop-blur-md",
        "px-3 md:px-6",
      )}
      role="banner"
    >
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {showHamburger && (
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-btn text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors touch-manipulation"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Mobile brand */}
        <Link
          href="/projects"
          className="md:hidden flex items-center min-w-0"
          aria-label="JengaTrack home"
        >
          <JengaTrackLogo size="xs" variant="full" />
        </Link>

        {/* Desktop page title */}
        <div className="hidden md:flex flex-col min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {currentProject?.name || "No project selected"}
          </div>
          <h1 className="font-display font-semibold text-lg text-foreground truncate leading-tight">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Right: project switcher, notifications, theme, profile */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Project switcher */}
        <DropdownMenu open={projectOpen} onOpenChange={setProjectOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 h-9 px-3 rounded-btn border border-border/60 bg-jenga-raised/60 hover:bg-jenga-raised hover:border-border transition-colors text-sm text-foreground max-w-[180px] md:max-w-[240px]"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  currentProject ? "bg-jenga-success" : "bg-muted-foreground/40",
                )}
                aria-hidden
              />
              <span className="truncate font-medium">
                {currentProject?.name ?? t("projects.select")}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-64 rounded-card"
          >
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Switch Project
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {projects.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                No projects yet.
              </div>
            )}
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => {
                  setCurrentProject(p);
                  setProjectOpen(false);
                  setLocation(`${currentPath}?project=${p.id}`);
                }}
                className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  currentProject?.id === p.id && "bg-jenga-primary/10 text-jenga-primary",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    p.status === "completed" ? "bg-jenga-success" : "bg-jenga-primary",
                  )}
                  aria-hidden
                />
                <span className="flex-1 truncate">{p.name}</span>
                {p.currency && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {p.currency}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/projects">
                <div className="flex items-center gap-2 cursor-pointer text-jenga-primary font-medium">
                  <Plus className="h-4 w-4" />
                  {t("projects.new")}
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Global search (desktop) */}
        <button
          type="button"
          aria-label="Search"
          className="hidden md:flex h-9 w-9 items-center justify-center rounded-btn border border-border/60 bg-jenga-raised/60 hover:bg-jenga-raised text-muted-foreground hover:text-foreground transition-colors"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="hidden md:flex h-9 w-9 items-center justify-center rounded-btn border border-border/60 bg-jenga-raised/60 hover:bg-jenga-raised text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* Language */}
        <div className="hidden sm:block">
          <LanguageSwitcher variant="compact" />
        </div>

        {/* Theme */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-9 w-9 items-center justify-center rounded-btn border border-border/60 bg-jenga-raised/60 hover:bg-jenga-raised text-muted-foreground hover:text-foreground transition-colors"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Profile */}
        <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-border/60 hover:ring-jenga-primary transition-colors"
              aria-label="Account"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-jenga-primary to-jenga-gold text-[#0D0F0E] text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-60 rounded-card">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground truncate">
                  {user?.fullName ?? "User"}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground truncate">
                  {user?.whatsappNumber ?? "No WhatsApp"}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href={currentProject ? `/settings?project=${currentProject.id}` : "/settings"}
              >
                <div className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  {t("nav.settings")}
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/help">
                <div className="flex items-center gap-2 cursor-pointer">
                  <HelpCircle className="h-4 w-4" />
                  {t("nav.help")}
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-jenga-danger focus:text-jenga-danger cursor-pointer"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t("nav.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
