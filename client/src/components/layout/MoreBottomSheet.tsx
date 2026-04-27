"use client";

import React from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useProject } from "@/contexts/ProjectContext";
import {
  TrendingUp,
  FolderOpen,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  MessageCircle,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { JengaTrackLogo } from "@/components/ui/Logo";

const MORE_ITEMS = [
  { labelKey: "nav.trends", href: "/trends", icon: TrendingUp },
  { labelKey: "nav.projects", href: "/projects", icon: FolderOpen },
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
  { labelKey: "help.title", href: "/help", icon: HelpCircle },
];

interface MoreBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Bottom drawer triggered by the "More" tab of <BottomNav />.
 * Shows: active project, WhatsApp status, additional nav items, user + logout.
 */
export function MoreBottomSheet({ open, onOpenChange }: MoreBottomSheetProps) {
  const { user, logout } = useAuth();
  const { currentProject } = useProject();
  const { t } = useLanguage();

  const hrefWithProject = (path: string) => {
    if (path === "/projects" || path === "/help") return path;
    return currentProject ? `${path}?project=${currentProject.id}` : path;
  };

  const handleLogout = async () => {
    onOpenChange(false);
    await logout();
  };

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const hasWhatsApp = !!user?.whatsappNumber;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "p-0 border-t border-border bg-card text-foreground",
          "rounded-t-modal rounded-b-none",
          "max-h-[92vh] overflow-y-auto",
          "pb-[env(safe-area-inset-bottom,16px)]",
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t("nav.more") || "More"}</SheetTitle>
        </SheetHeader>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div
                  className="h-1 w-12 rounded-full bg-border"
                  aria-hidden
                />
              </div>

              {/* Brand header */}
              <div className="flex items-center justify-between px-5 pb-4 border-b border-border/50">
                <JengaTrackLogo variant="full" size="sm" linkTo="/dashboard" />
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-btn text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Active project */}
              {currentProject && (
                <Link href="/projects">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 border-b border-border/50 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
                        {t("nav.activeProject")}
                      </div>
                      <div className="font-display font-semibold text-foreground text-base truncate">
                        {currentProject.name}
                      </div>
                      {currentProject.location && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {currentProject.location}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-jenga-primary whitespace-nowrap shrink-0">
                      {t("nav.switch")}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </Link>
              )}

              {/* Nav items */}
              <nav className="px-3 pt-3 pb-2">
                {MORE_ITEMS.map((item) => (
                  <Link key={item.href} href={hrefWithProject(item.href)}>
                    <div
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-btn px-3",
                        "min-h-[52px] text-base font-body font-medium",
                        "text-foreground hover:bg-muted/60 transition-colors",
                        "touch-manipulation active:scale-[0.99]",
                      )}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-muted/60 text-muted-foreground shrink-0">
                        <item.icon className="h-5 w-5" strokeWidth={1.8} />
                      </span>
                      <span className="flex-1 truncate">{t(item.labelKey)}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                ))}
              </nav>

              {/* WhatsApp status */}
              <div
                className={cn(
                  "mx-5 my-2 flex items-center gap-3 rounded-btn px-3 py-3 text-sm border",
                  hasWhatsApp
                    ? "bg-jenga-whatsapp/10 border-jenga-whatsapp/30 text-jenga-whatsapp"
                    : "bg-muted/40 border-border/60 text-muted-foreground",
                )}
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate font-medium">
                  {hasWhatsApp ? t("nav.whatsappConnected") : t("nav.connectWhatsapp")}
                </span>
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    hasWhatsApp
                      ? "bg-jenga-whatsapp animate-pulse"
                      : "bg-muted-foreground/40",
                  )}
                />
              </div>

              {/* User + logout */}
              <div className="px-5 pt-3 pb-5 border-t border-border/50">
                <div className="flex items-center gap-3 py-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-jenga-primary to-jenga-gold text-[#0D0F0E] text-sm font-bold">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {user?.fullName || "User"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground font-mono">
                      {user?.whatsappNumber || user?.email || "—"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 rounded-btn mt-2",
                    "min-h-[48px] text-sm font-semibold",
                    "border border-jenga-danger/30 text-jenga-danger hover:bg-jenga-danger/10 transition-colors",
                    "touch-manipulation",
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  {t("nav.logout") || "Log out"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
