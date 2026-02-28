"use client";

import React from "react";
import { Link } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import {
  TrendingUp,
  FolderOpen,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const MORE_ITEMS = [
  { label: "Trends & Insights", href: "/trends", icon: TrendingUp },
  { label: "My Projects", href: "/projects", icon: FolderOpen },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Help & How To Use", href: "/help", icon: HelpCircle },
];

interface MoreBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoreBottomSheet({ open, onOpenChange }: MoreBottomSheetProps) {
  const { logout } = useAuth();
  const { currentProject } = useProject();

  const hrefWithProject = (path: string) => {
    if (path === "/projects") return path;
    return currentProject ? `${path}?project=${currentProject.id}` : path;
  };

  const handleLogout = async () => {
    onOpenChange(false);
    await logout();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "rounded-t-2xl border-t dark:border-zinc-800/50 border-slate-200 p-0 pb-safe",
          "dark:bg-[#0a0a0a] dark:text-white bg-white text-slate-800"
        )}
        style={{ maxHeight: "85vh" }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>More</SheetTitle>
        </SheetHeader>
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-12 rounded-full dark:bg-zinc-600 bg-slate-300" aria-hidden />
        </div>
        <nav className="px-4 pb-8">
          {MORE_ITEMS.map((item) => (
            <Link key={item.href} href={hrefWithProject(item.href)}>
              <a
                onClick={() => onOpenChange(false)}
                className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left text-base font-medium dark:text-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <item.icon className="h-5 w-5 shrink-0 dark:text-zinc-400 text-slate-500" />
                {item.label}
              </a>
            </Link>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left text-base font-medium dark:text-zinc-200 dark:hover:bg-red-500/20 dark:hover:text-red-400 text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Logout
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
