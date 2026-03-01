"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { NewProjectModal, type NewProjectFormData } from "@/components/projects/NewProjectModal";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects, useInvalidateProjects } from "@/hooks/useProjects";
import { apiRequest } from "@/lib/queryClient";
import { parseBudget } from "@/lib/budgetUtils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Project } from "@/contexts/ProjectContext";

const WHATSAPP_JOIN = "+1 415 523 8886";
const JOIN_CODE = "join thick-tea";

function ProjectsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border dark:border-zinc-800/50 dark:bg-zinc-900/80 border-slate-200 bg-white shadow-sm p-5 animate-pulse"
        >
          <div className="h-6 dark:bg-zinc-700 bg-slate-200 rounded w-3/4 mb-2" />
          <div className="h-4 dark:bg-zinc-700 bg-slate-200 rounded w-1/2 mb-4" />
          <div className="h-2 dark:bg-zinc-700 bg-slate-200 rounded w-full mb-2" />
          <div className="h-4 dark:bg-zinc-700 bg-slate-200 rounded w-2/3 mb-4" />
          <div className="h-4 dark:bg-zinc-700 bg-slate-200 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

export default function ProjectsPage() {
  const { data: fetched = [], isLoading, isError, error, refetch } = useProjects();
  const { projects, setProjects, setCurrentProject } = useProject();
  const { t } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { toast } = useToast();
  const invalidateProjects = useInvalidateProjects();

  useEffect(() => {
    if (Array.isArray(fetched) && fetched.length >= 0) {
      setProjects(fetched);
    }
  }, [fetched, setProjects]);

  const list = Array.isArray(fetched) ? fetched : projects;
  const hasProjects = list.length > 0;

  const handleCreateProject = async (form: NewProjectFormData) => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await apiRequest("POST", "/api/projects", {
        name: form.name,
        description: form.location || undefined,
        budgetAmount: parseBudget(form.totalBudget) || undefined,
        status: "active",
        channelType: "direct",
      });
      const data = await res.json();
      if (!data.success || !data.project) throw new Error(data.error || "Create failed");
      const newProject: Project = {
        id: data.project.id,
        name: data.project.name,
        location: data.project.description || undefined,
        totalBudget: data.project.budgetAmount != null ? parseFloat(String(data.project.budgetAmount)) : undefined,
        spentAmount: 0,
        status: "active",
      };
      setProjects([...list, newProject]);
      setCurrentProject(newProject);
      await invalidateProjects();
      toast({
        title: t("projects.toastCreated"),
        description: `${form.name} ${t("projects.toastCreatedDesc")}`,
      });
      setModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("projects.createFailed");
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="font-heading text-2xl font-bold dark:text-white text-slate-800">{t("projects.title")}</h1>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] text-white hover:opacity-90 shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("projects.new")}
          </Button>
        </div>

        {isLoading ? (
          <ProjectsLoadingSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="dark:text-red-400 text-red-600 mb-4">
              {error instanceof Error ? error.message : t("projects.loadError")}
            </p>
            <Button variant="outline" onClick={() => refetch()} className="dark:border-zinc-600 dark:text-zinc-300 border-slate-300 text-slate-700">
              {t("projects.tryAgain")}
            </Button>
          </div>
        ) : hasProjects ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="rounded-full dark:bg-zinc-800 bg-slate-200 p-6 mb-4">
              <FolderOpen className="h-12 w-12 dark:text-zinc-500 text-slate-500" />
            </div>
            <h2 className="font-heading text-xl font-semibold dark:text-white text-slate-800 mb-2">
              {t("projects.empty.title")}
            </h2>
            <p className="dark:text-zinc-400 text-slate-600 max-w-md mb-6">
              {t("projects.emptySubtitleLong")}
            </p>
            <Button
              onClick={() => setModalOpen(true)}
              className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] text-white hover:opacity-90 mb-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("projects.createNew")}
            </Button>
            <p className="text-sm dark:text-zinc-500 text-slate-500">
              {t("projects.orWhatsApp")}{" "}
              <a
                href={`https://wa.me/${WHATSAPP_JOIN.replace(/\s/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#22c55e] hover:underline"
              >
                {WHATSAPP_JOIN}
              </a>{" "}
              with &quot;{JOIN_CODE}&quot; {t("projects.toGetStarted")}
            </p>
          </div>
        )}
      </div>

      <NewProjectModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setCreateError(null);
        }}
        onSubmit={handleCreateProject}
        isLoading={creating}
        errorMessage={createError}
      />
    </AppLayout>
  );
}
