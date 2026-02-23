"use client";

import React from "react";
import { Link } from "wouter";
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

  const handleLogout = async () => {
    onOpenChange(false);
    await logout();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "rounded-t-2xl border-t border-zinc-800/50 p-0 pb-safe",
          "bg-[#0a0a0a] text-white"
        )}
        style={{ maxHeight: "85vh" }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>More</SheetTitle>
        </SheetHeader>
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-12 rounded-full bg-zinc-600" aria-hidden />
        </div>
        <nav className="px-4 pb-8">
          {MORE_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                onClick={() => onOpenChange(false)}
                className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left text-base font-medium text-zinc-200 hover:bg-white/10 active:bg-white/15 transition-colors"
              >
                <item.icon className="h-5 w-5 shrink-0 text-zinc-400" />
                {item.label}
              </a>
            </Link>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left text-base font-medium text-zinc-200 hover:bg-red-500/20 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Logout
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
