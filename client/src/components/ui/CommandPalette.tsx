"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Home, Wallet, Package, Calendar, TrendingUp, FolderOpen, Settings, HelpCircle, Plus, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface CommandItem {
  id: string;
  title: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setLocation] = useLocation();

  const commands: CommandItem[] = [
    // Navigation
    {
      id: "dashboard",
      title: "Go to Dashboard",
      shortcut: "⌘D",
      icon: <Home className="w-4 h-4" />,
      action: () => setLocation("/dashboard"),
      category: "Navigation",
    },
    {
      id: "budget",
      title: "Go to Budget",
      shortcut: "⌘B",
      icon: <Wallet className="w-4 h-4" />,
      action: () => setLocation("/budget"),
      category: "Navigation",
    },
    {
      id: "materials",
      title: "Go to Materials",
      shortcut: "⌘M",
      icon: <Package className="w-4 h-4" />,
      action: () => setLocation("/materials"),
      category: "Navigation",
    },
    {
      id: "daily",
      title: "Go to Daily Log",
      shortcut: "⌘L",
      icon: <Calendar className="w-4 h-4" />,
      action: () => setLocation("/daily"),
      category: "Navigation",
    },
    {
      id: "trends",
      title: "Go to Trends",
      shortcut: "⌘T",
      icon: <TrendingUp className="w-4 h-4" />,
      action: () => setLocation("/trends"),
      category: "Navigation",
    },
    {
      id: "projects",
      title: "Go to Projects",
      icon: <FolderOpen className="w-4 h-4" />,
      action: () => setLocation("/projects"),
      category: "Navigation",
    },
    // Quick Actions
    {
      id: "new-expense",
      title: "Log New Expense",
      shortcut: "⌘E",
      icon: <Plus className="w-4 h-4" />,
      action: () => setLocation("/budget?action=new"),
      category: "Quick Actions",
    },
    {
      id: "new-material",
      title: "Log Material",
      icon: <Package className="w-4 h-4" />,
      action: () => setLocation("/materials?action=new"),
      category: "Quick Actions",
    },
    // Settings
    {
      id: "settings",
      title: "Open Settings",
      shortcut: "⌘,",
      icon: <Settings className="w-4 h-4" />,
      action: () => setLocation("/settings"),
      category: "Settings",
    },
    {
      id: "help",
      title: "Get Help",
      shortcut: "?",
      icon: <HelpCircle className="w-4 h-4" />,
      action: () => setLocation("/help"),
      category: "Settings",
    },
  ];

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(search.toLowerCase()) ||
      cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        isOpen ? onClose() : null; // Toggle handled by parent
      }

      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          cmd.action();
          onClose();
        }
      }
    },
    [isOpen, onClose, filteredCommands, selectedIndex]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed left-1/2 top-1/4 -translate-x-1/2 w-full max-w-2xl p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search commands..."
                className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              <kbd className="px-2 py-1 text-xs bg-muted rounded">ESC</kbd>
            </div>

            {/* Commands List */}
            <div className="max-h-[400px] overflow-y-auto py-2">
              {filteredCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  No commands found
                </div>
              ) : (
                Object.entries(
                  filteredCommands.reduce((acc, cmd) => {
                    if (!acc[cmd.category]) acc[cmd.category] = [];
                    acc[cmd.category].push(cmd);
                    return acc;
                  }, {} as Record<string, CommandItem[]>)
                ).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
                      {category}
                    </div>
                    {items.map((cmd, idx) => {
                      const globalIdx = filteredCommands.findIndex(
                        (c) => c.id === cmd.id
                      );
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            cmd.action();
                            onClose();
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                            globalIdx === selectedIndex
                              ? "bg-accent"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <span className="text-muted-foreground">
                            {cmd.icon}
                          </span>
                          <span className="flex-1">{cmd.title}</span>
                          {cmd.shortcut && (
                            <kbd className="px-2 py-0.5 text-xs bg-muted rounded">
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-muted/50 border-t border-border text-xs text-muted-foreground flex items-center gap-4">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span className="ml-auto">⌘K to open</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
