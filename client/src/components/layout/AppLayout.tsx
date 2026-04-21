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
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-jenga-bg text-foreground bg-jenga-radial">
      <Sidebar open={open} onToggle={toggle} />

      {/*
        Right pane: width = 100vw - sidebar.
        `min-w-0 overflow-hidden` prevents any wide child (chart, KPI row, table)
        from pushing the pane beyond that width. Without min-w-0 a flex/grid
        child with intrinsic content can override the parent's width and cause
        horizontal overflow — exactly the symptom reported (4th KPI off-screen).
      */}
      <div
        className={cn(
          "min-h-screen flex flex-col w-full max-w-full min-w-0 overflow-x-hidden",
          "transition-[margin-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "lg:ml-sidebar-open" : "lg:ml-sidebar-closed",
        )}
      >
        <TopBar onMenuClick={toggle} showHamburger />

        <main
          className={cn(
            "flex-1 w-full max-w-full min-w-0 overflow-x-hidden",
            "pb-mobile-nav-offset lg:pb-0",
          )}
        >
          <div className="mx-auto w-full max-w-[1600px] min-w-0 px-3 xs:px-3 sm:px-4 md:px-6 lg:px-8 pt-4 sm:pt-5 md:pt-6 pb-4 md:pb-8">
            {children}
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
