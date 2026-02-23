"use client";

import React, { useState } from "react";
import { Link } from "wouter";
import {
  Menu,
  Building2,
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
import { cn } from "@/lib/utils";

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
  const { user, logout } = useAuth();
  const { currentProject, projects, setCurrentProject } = useProject();
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
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-zinc-800/50 bg-[#0a0a0a] px-4 md:px-6">
      {/* Left: hamburger (desktop) or logo (mobile) */}
      <div className="flex items-center gap-3 min-w-0">
        {showHamburger && (
          <>
            <button
              type="button"
              onClick={onMenuClick}
              className="hidden md:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/dashboard" className="md:hidden flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-[#22c55e] to-[#14b8a6]">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="font-heading font-semibold text-white truncate">
                JengaTrack
              </span>
            </Link>
          </>
        )}
      </div>

      {/* Right: project switcher, notifications, profile */}
      <div className="flex items-center gap-2">
        {/* Project switcher */}
        <DropdownMenu open={projectOpen} onOpenChange={setProjectOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="text-zinc-300 hover:bg-white/10 hover:text-white border border-zinc-700/50"
            >
              <span className="truncate max-w-[140px] md:max-w-[200px]">
                {currentProject?.name ?? "Select project"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-zinc-900 border-zinc-700 text-white"
          >
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => {
                  setCurrentProject(p);
                  setProjectOpen(false);
                }}
                className="cursor-pointer"
              >
                {p.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-zinc-700" />
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

        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-zinc-400 hover:text-white">
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
            className="w-72 bg-zinc-900 border-zinc-700 text-white"
          >
            <DropdownMenuLabel className="text-zinc-400">Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-zinc-700" />
            {MOCK_NOTIFICATIONS.map((n) => (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-3 cursor-pointer">
                <span className="flex items-center gap-2">
                  <span>{n.icon}</span>
                  <span className="font-medium">{n.title}</span>
                </span>
                <span className="text-xs text-zinc-500">{n.time}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
        <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full text-zinc-400 hover:text-white">
              <Avatar className="h-8 w-8 border-2 border-zinc-700">
                <AvatarFallback className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] text-white text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-zinc-900 border-zinc-700 text-white"
          >
            <DropdownMenuLabel className="text-zinc-400">
              <div className="flex flex-col">
                <span className="font-medium text-white">{user?.fullName ?? "User"}</span>
                <span className="text-xs text-zinc-500 truncate">{user?.whatsappNumber ?? "No WhatsApp"}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-zinc-700" />
            <DropdownMenuItem asChild>
              <Link href="/settings">
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
