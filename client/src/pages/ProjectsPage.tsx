"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { NewProjectModal, type NewProjectFormData } from "@/components/projects/NewProjectModal";
import { useProject } from "@/contexts/ProjectContext";
import type { Project } from "@/contexts/ProjectContext";

const WHATSAPP_JOIN = "+1 415 523 8886";
const JOIN_CODE = "join thick-tea";

// Placeholder API: replace with real endpoint when available
async function fetchProjects(): Promise<Project[]> {
  try {
    const res = await fetch("/api/projects", { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.projects) ? data.projects : (data ?? []);
  } catch {
    return [];
  }
}

export default function ProjectsPage() {
  const { projects, setProjects, setCurrentProject } = useProject();
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: fetched, isLoading } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: fetchProjects,
    staleTime: 60 * 1000,
  });

  React.useEffect(() => {
    if (Array.isArray(fetched) && fetched.length >= 0) {
      setProjects(fetched);
    }
  }, [fetched, setProjects]);

  const list = projects.length > 0 ? projects : (Array.isArray(fetched) ? fetched : []);
  const hasProjects = list.length > 0;

  const handleCreateProject = async (form: NewProjectFormData) => {
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          location: form.location || undefined,
          startDate: form.startDate || undefined,
          totalBudget: form.totalBudget ? Number(form.totalBudget) : undefined,
          whatsappNumber: form.whatsappNumber || undefined,
        }),
      });
      if (!res.ok) throw new Error("Create failed");
      const data = await res.json();
      const newProject: Project = {
        id: data.project?.id ?? String(Date.now()),
        name: form.name,
        type: form.type,
        location: form.location || undefined,
        startDate: form.startDate,
        totalBudget: form.totalBudget ? Number(form.totalBudget) : undefined,
        spentAmount: 0,
        status: "active",
        whatsappNumber: form.whatsappNumber || undefined,
      };
      setProjects([...list, newProject]);
      setCurrentProject(newProject);
    } catch {
      // Fallback: add locally so UI works without backend
      const newProject: Project = {
        id: `local-${Date.now()}`,
        name: form.name,
        type: form.type,
        location: form.location || undefined,
        startDate: form.startDate,
        totalBudget: form.totalBudget ? Number(form.totalBudget) : undefined,
        spentAmount: 0,
        status: "active",
        whatsappNumber: form.whatsappNumber || undefined,
      };
      setProjects([...list, newProject]);
      setCurrentProject(newProject);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="font-heading text-2xl font-bold text-white">My Projects</h1>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] text-white hover:opacity-90 shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#22c55e] border-t-transparent" />
          </div>
        ) : hasProjects ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="rounded-full bg-zinc-800 p-6 mb-4">
              <FolderOpen className="h-12 w-12 text-zinc-500" />
            </div>
            <h2 className="font-heading text-xl font-semibold text-white mb-2">
              No projects yet
            </h2>
            <p className="text-zinc-400 max-w-md mb-6">
              Create your first project or connect via WhatsApp to set up automatically.
            </p>
            <Button
              onClick={() => setModalOpen(true)}
              className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] text-white hover:opacity-90 mb-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Project
            </Button>
            <p className="text-sm text-zinc-500">
              Or WhatsApp us at{" "}
              <a
                href={`https://wa.me/${WHATSAPP_JOIN.replace(/\s/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#22c55e] hover:underline"
              >
                {WHATSAPP_JOIN}
              </a>{" "}
              with &quot;{JOIN_CODE}&quot; to get started.
            </p>
          </div>
        )}
      </div>

      <NewProjectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleCreateProject}
        isLoading={creating}
      />
    </AppLayout>
  );
}
