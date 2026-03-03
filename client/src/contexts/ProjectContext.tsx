import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface Project {
  id: string;
  name: string;
  location?: string;
  type?: "residential" | "commercial" | "other";
  startDate?: string;
  totalBudget?: number;
  spentAmount?: number;
  progress?: number; // Completion percentage (0-100)
  lastActivityAt?: string;
  status?: "active" | "completed";
  whatsappNumber?: string;
}

interface ProjectContextType {
  currentProject: Project | null;
  projects: Project[];
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  refetchProjects: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const STORAGE_KEY = "jenga_current_project";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjectsState] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);

  const setCurrentProject = useCallback((project: Project | null) => {
    setCurrentProjectState(project);
    if (project) {
      try {
        localStorage.setItem(STORAGE_KEY, project.id);
      } catch {
        // ignore
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  const setProjects = useCallback((list: Project[]) => {
    setProjectsState(list);
    const savedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (savedId && list.length > 0) {
      const found = list.find((p) => p.id === savedId);
      if (found) setCurrentProjectState(found);
      else setCurrentProjectState(list[0]);
    } else if (list.length > 0) {
      setCurrentProjectState((prev) => (prev ? prev : list[0]));
    }
  }, []);

  const refetchProjects = useCallback(() => {
    // Placeholder: pages can use their own queries and call setProjects
  }, []);

  const value: ProjectContextType = {
    currentProject,
    projects,
    setCurrentProject,
    setProjects,
    refetchProjects,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (ctx === undefined) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
