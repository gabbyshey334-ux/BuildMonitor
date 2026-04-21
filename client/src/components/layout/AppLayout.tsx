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
    <div className="min-h-screen overflow-x-hidden bg-jenga-bg text-foreground bg-jenga-radial">
      <Sidebar open={open} onToggle={toggle} />

      <div
        className={cn(
          "min-h-screen flex flex-col transition-[margin-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "md:ml-sidebar-open" : "md:ml-sidebar-closed",
        )}
      >
        <TopBar onMenuClick={toggle} showHamburger />

        <main
          className={cn(
            "flex-1 pb-mobile-nav-offset md:pb-0",
            "max-w-[100vw] overflow-x-hidden",
          )}
        >
          <div className="px-4 py-5 md:px-8 md:py-8 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
