"use client";

import React, { useEffect } from "react";
import { TopBar } from "./TopBar";
import { Sidebar, useSidebarState } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { useProjects } from "@/hooks/useProjects";
import { useProject } from "@/contexts/ProjectContext";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Main authenticated app layout.
 *
 * Responsive structure:
 *   - < 1024px: TopBar + <main> (full width) + BottomNav
 *   - ≥ 1024px: Sidebar + TopBar + <main> (offset by sidebar width)
 *
 * The sidebar margin is applied ONLY at `lg:` and up, so mobile content
 * never has dead space on the left.
 *
 * The bottom padding (pb-24) clears the mobile BottomNav; on lg+ it
 * becomes pb-0.
 */
export function AppLayout({ children }: AppLayoutProps) {
  const { open, toggle } = useSidebarState();
  const { data: projectsData } = useProjects();
  const { setProjects } = useProject();

  const projectsJson = JSON.stringify(projectsData);
  useEffect(() => {
    try {
      const data = JSON.parse(projectsJson);
      if (Array.isArray(data) && data.length > 0) {
        setProjects(data);
      }
    } catch {
      // ignore invalid json
    }
  }, [projectsJson]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-jenga-bg text-foreground bg-jenga-radial">
      {/* Fixed desktop sidebar (overlay, hidden < lg).
          Content column offsets itself via lg:ml-sidebar-* below. */}
      <Sidebar open={open} onToggle={toggle} />

      {/* Content column — fills remaining height exactly, never scrolls itself. */}
      <div
        className={cn(
          "flex flex-col flex-1 min-w-0 h-screen overflow-hidden",
          "transition-[margin-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          // Offset the fixed sidebar on lg+.
          open ? "lg:ml-sidebar-open" : "lg:ml-sidebar-closed",
          // Reserve vertical space for the fixed BottomNav on mobile/tablet.
          // This is LAYOUT-level padding on the shell (not on PageWrapper),
          // so each page's <main> flex area stops at the top of the nav.
          "pb-mobile-nav-offset lg:pb-0",
        )}
      >
        <TopBar onMenuClick={toggle} showHamburger />

        {/* Page slot — fills all remaining height. min-h-0 lets it shrink
            below intrinsic content height so children can take over scrolling. */}
        <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
