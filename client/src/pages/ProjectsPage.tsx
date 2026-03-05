"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Plus, FolderOpen, ChevronLeft, ChevronRight } from "lucide-react";
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
const PROJECTS_PER_PAGE = 8;

type SortOption = "date" | "name" | "progress" | "budget";

function ProjectsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="rounded-2xl dark:bg-[#1a1a1a] bg-slate-100 border dark:border-zinc-800/50 border-slate-200 p-5 animate-pulse"
        >
          <div className="h-6 dark:bg-zinc-800 bg-slate-200 rounded w-3/4 mb-3" />
          <div className="h-8 dark:bg-zinc-800 bg-slate-200 rounded w-1/3 mb-4" />
          <div className="h-2 dark:bg-zinc-800 bg-slate-200 rounded w-full mb-2" />
          <div className="h-2 dark:bg-zinc-800 bg-slate-200 rounded w-full mb-4" />
          <div className="h-4 dark:bg-zinc-800 bg-slate-200 rounded w-2/3 mb-4" />
          <div className="h-4 dark:bg-zinc-800 bg-slate-200 rounded w-1/3" />
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
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const { toast } = useToast();
  const invalidateProjects = useInvalidateProjects();

  useEffect(() => {
    if (Array.isArray(fetched) && fetched.length >= 0) {
      setProjects(fetched);
    }
  }, [fetched, setProjects]);

  const list = Array.isArray(fetched) ? fetched : projects;
  const hasProjects = list.length > 0;

  const sortedList = useMemo(() => {
    const arr = [...list];
    switch (sortBy) {
      case "name":
        return arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      case "progress":
        return arr.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
      case "budget":
        return arr.sort((a, b) => (b.totalBudget ?? 0) - (a.totalBudget ?? 0));
      case "date":
      default:
        return arr.sort((a, b) => {
          const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
          return tb - ta;
        });
    }
  }, [list, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedList.length / PROJECTS_PER_PAGE));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * PROJECTS_PER_PAGE;
    return sortedList.slice(start, start + PROJECTS_PER_PAGE);
  }, [sortedList, page]);

  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(1);
  }, [page, totalPages]);

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
      <div className="max-w-7xl mx-auto">
        {/* Header with Sort Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold dark:text-white text-slate-900">{t("projects.title")}</h1>

          <div className="flex items-center gap-4">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortOption);
                  setPage(1);
                }}
                className="appearance-none dark:bg-transparent bg-white dark:border-zinc-700 border-slate-300 dark:text-zinc-300 text-slate-800 text-sm rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:border-[#22c55e] cursor-pointer"
              >
                <option value="date">Sort by: Date updated</option>
                <option value="name">Sort by: Name</option>
                <option value="progress">Sort by: Progress</option>
                <option value="budget">Sort by: Budget</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 dark:text-zinc-500 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <Button
              onClick={() => setModalOpen(true)}
              className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] text-white hover:opacity-90 shrink-0 rounded-lg px-4 py-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("projects.new")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <ProjectsLoadingSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="dark:text-red-400 text-red-600 mb-4">
              {error instanceof Error ? error.message : t("projects.loadError")}
            </p>
            <Button variant="outline" onClick={() => refetch()} className="dark:border-zinc-600 dark:text-zinc-300 border-slate-400 text-slate-700">
              {t("projects.tryAgain")}
            </Button>
          </div>
        ) : hasProjects ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {paginatedList.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  title="Previous page"
                  aria-label="Previous page"
                  className="p-2 rounded-lg dark:border-zinc-700 border-slate-300 dark:text-zinc-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="min-w-[6rem] text-center text-sm font-medium dark:text-zinc-300 text-slate-700">
                  Page {page} of {totalPages}
                </span>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    aria-label={`Page ${pageNum}`}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? "dark:bg-zinc-700 dark:text-white bg-emerald-600 text-white"
                        : "dark:text-zinc-400 dark:hover:bg-zinc-800 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  title="Next page"
                  aria-label="Next page"
                  className="p-2 rounded-lg dark:border-zinc-700 border-slate-300 dark:text-zinc-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="rounded-full dark:bg-zinc-800 bg-slate-200 p-6 mb-4">
              <FolderOpen className="h-12 w-12 dark:text-zinc-500 text-slate-500" />
            </div>
            <h2 className="text-xl font-semibold dark:text-white text-slate-900 mb-2">
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