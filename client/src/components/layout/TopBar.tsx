"use client";

import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Menu,
  ChevronDown,
  Bell,
  User,
  Settings,
  LogOut,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { Sun, Moon } from "lucide-react";

// Mock notifications for UI
const MOCK_NOTIFICATIONS = [
  { id: "1", type: "price", title: "Cement price alert", time: "2h ago", icon: "⚠️" },
  { id: "2", type: "stock", title: "Low stock: Sand", time: "5h ago", icon: "🚨" },
  { id: "3", type: "heartbeat", title: "Daily summary", time: "Yesterday", icon: "🌆" },
];
const UNREAD_COUNT = 2;

interface TopBarProps {
  onMenuClick?: () => void;
  showHamburger?: boolean;
}

export function TopBar({ onMenuClick, showHamburger = true }: TopBarProps) {
  const [location, setLocation] = useLocation();
  const currentPath = location.split("?")[0];
  const { user, logout } = useAuth();
  const { currentProject, projects, setCurrentProject } = useProject();
  const { theme, toggleTheme, isDark } = useTheme();
  const [projectOpen, setProjectOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b dark:border-zinc-700 border-slate-200 dark:bg-[#1a1d2e] bg-white px-4 md:px-6">
      {/* Left: hamburger (desktop) or logo (mobile) */}
      <div className="flex items-center gap-3 min-w-0">
        {showHamburger && (
          <>
            <button
              type="button"
              onClick={onMenuClick}
              className="hidden md:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/projects" className="md:hidden flex items-center gap-2 min-w-0">
              <img
                src="/assets/images/logo.png"
                alt="JengaTrack"
                className="h-8 w-auto max-h-8 object-contain mix-blend-multiply dark:mix-blend-lighten shrink-0"
              />
              <span className="font-heading font-semibold dark:text-white text-slate-800 truncate">
                JengaTrack
              </span>
            </Link>
          </>
        )}
      </div>

      {/* Right: project switcher, theme toggle, notifications, profile */}
      <div className="flex items-center gap-2">
        {/* Project switcher */}
        <DropdownMenu open={projectOpen} onOpenChange={setProjectOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white dark:border-zinc-700/50 text-slate-700 hover:bg-slate-100 border border-slate-200"
            >
              <span className="truncate max-w-[140px] md:max-w-[200px]">
                {currentProject?.name ?? "Select project"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white bg-white border-slate-200 text-slate-800"
          >
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => {
                  setCurrentProject(p);
                  setProjectOpen(false);
                  setLocation(`${currentPath}?project=${p.id}`);
                }}
                className="cursor-pointer"
              >
                {p.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="dark:bg-zinc-700 bg-slate-200" />
            <DropdownMenuItem asChild>
              <Link href="/projects">
                <a className="flex items-center gap-2 cursor-pointer text-[#22c55e]">
                  <Plus className="h-4 w-4" />
                  New Project
                </a>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-colors duration-200 dark:hover:bg-zinc-700 hover:bg-slate-200 dark:text-zinc-300 text-slate-600"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative dark:text-zinc-400 dark:hover:text-white text-slate-600 hover:text-slate-800">
              <Bell className="h-5 w-5" />
              {UNREAD_COUNT > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                  {UNREAD_COUNT}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-72 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white bg-white border-slate-200 text-slate-800"
          >
            <DropdownMenuLabel className="dark:text-zinc-400 text-slate-500">Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator className="dark:bg-zinc-700 bg-slate-200" />
            {MOCK_NOTIFICATIONS.map((n) => (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-3 cursor-pointer">
                <span className="flex items-center gap-2">
                  <span>{n.icon}</span>
                  <span className="font-medium">{n.title}</span>
                </span>
                <span className="text-xs dark:text-zinc-500 text-slate-500">{n.time}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
        <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full dark:text-zinc-400 dark:hover:text-white text-slate-600 hover:text-slate-800">
              <Avatar className="h-8 w-8 border-2 dark:border-zinc-700 border-slate-200">
                <AvatarFallback className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] text-white text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white bg-white border-slate-200 text-slate-800"
          >
            <DropdownMenuLabel className="dark:text-zinc-400 text-slate-500">
              <div className="flex flex-col">
                <span className="font-medium dark:text-white text-slate-800">{user?.fullName ?? "User"}</span>
                <span className="text-xs dark:text-zinc-500 text-slate-500 truncate">{user?.whatsappNumber ?? "No WhatsApp"}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="dark:bg-zinc-700 bg-slate-200" />
            <DropdownMenuItem asChild>
              <Link href={currentProject ? `/settings?project=${currentProject.id}` : "/settings"}>
                <a className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  Settings
                </a>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-400 focus:text-red-400 cursor-pointer"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
