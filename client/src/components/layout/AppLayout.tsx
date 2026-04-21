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
    // OUTER shell: DO NOT set max-w-[100vw] here — 100vw includes the vertical
    // scrollbar on Windows/Linux and causes the right ~15px to be clipped on
    // laptops. width:100% (inherited from html/body) already follows the
    // visible viewport exactly.
    <div className="min-h-screen w-full overflow-x-hidden bg-jenga-bg text-foreground bg-jenga-radial">
      <Sidebar open={open} onToggle={toggle} />

      {/*
        Right pane.

        Why padding-left (NOT margin-left):
          margin-left does NOT shrink an element's width. Previously we had
          `w-full lg:ml-sidebar-open`, which made this pane 100vw wide AND
          shifted it 220px to the right, pushing its right edge 220px past
          the viewport. The outer `overflow-x-hidden` then silently clipped
          that final 220px — that is exactly why the 4th KPI card (and the
          right-most column on every other page) was being cut off on laptop
          screens.

          Using padding-left on a block element WITH the default
          box-sizing:border-box means the content box shrinks by the padding,
          so children sized `w-full` correctly resolve to
          `viewport - sidebar` and nothing overflows.

        The pane itself intentionally has NO explicit width — a block element
        naturally fills its parent's content box, which is what we want. Any
        `w-*` / `max-w-*` class here would re-introduce the original bug.
      */}
      <div
        className={cn(
          "min-h-screen flex flex-col min-w-0",
          "transition-[padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "lg:pl-sidebar-open" : "lg:pl-sidebar-closed",
        )}
      >
        <TopBar onMenuClick={toggle} showHamburger />

        <main
          className={cn(
            "flex-1 min-w-0 overflow-x-hidden",
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
