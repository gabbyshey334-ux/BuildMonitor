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

  useEffect(() => {
    if (Array.isArray(projectsData)) {
      setProjects(projectsData);
    }
  }, [projectsData, setProjects]);

  return (
    <div className="min-h-screen overflow-x-hidden dark:bg-[#0a0a0a] bg-slate-50 dark:text-zinc-200 text-slate-800">
      <TopBar onMenuClick={toggle} showHamburger />
      <Sidebar open={open} onToggle={toggle} />

      <main
        className={cn(
          "min-h-screen transition-[margin-left] duration-300 ease-out",
          "pt-14",
          "pb-16 md:pb-0",
          open ? "md:ml-[240px]" : "md:ml-16"
        )}
      >
        <div className="p-3 md:p-6 max-w-[100vw] overflow-x-hidden">
          {children}
        </div>
      </main>

      <BottomNav />

    </div>
  );
}
