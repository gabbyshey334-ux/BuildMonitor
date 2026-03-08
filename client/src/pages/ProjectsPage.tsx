"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Plus, FolderOpen, ChevronLeft, ChevronRight, Smartphone, LayoutGrid, DollarSign, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { NewProjectModal, type NewProjectFormData } from "@/components/projects/NewProjectModal";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects, useInvalidateProjects } from "@/hooks/useProjects";
import { apiRequest } from "@/lib/queryClient";
import { parseBudget } from "@/lib/budgetUtils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Project } from "@/contexts/ProjectContext";
import { cn } from "@/lib/utils";

const WHATSAPP_JOIN = "+1 415 523 8886";
const JOIN_CODE = "join thick-tea";
const PROJECTS_PER_PAGE = 9; // Increased slightly for grid

type SortOption = "date" | "name" | "progress" | "budget";

function formatBudgetShort(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n.toLocaleString();
}

function ProjectsLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0c12] p-6 space-y-8 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-[#1e2230] rounded" />
        <div className="h-10 w-32 bg-[#1e2230] rounded" />
      </div>
      <div className="h-32 bg-[#0f1219] border border-white/5 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-64 bg-[#0f1219] border border-white/5 rounded-xl" />
        ))}
      </div>
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

  // Stats calculation
  const stats = useMemo(() => {
    const totalProjects = list.length;
    const totalBudget = list.reduce((sum, p) => sum + (p.totalBudget || 0), 0);
    const activeProjects = list.filter(p => p.status === 'active' || !p.status).length;
    return { totalProjects, totalBudget, activeProjects };
  }, [list]);

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
        progress: 0, // Explicitly set progress for new projects
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

  if (isLoading) return <ProjectsLoadingSkeleton />;

  if (isError) {
    return (
      <div className="min-h-screen bg-[#0a0c12] flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <p className="text-red-500">
            {error instanceof Error ? error.message : t("projects.loadError")}
          </p>
          <Button variant="outline" onClick={() => refetch()} className="border-zinc-700 text-zinc-300">
            {t("projects.tryAgain")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c12] text-zinc-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 1. Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{t("projects.title")}</h1>
            <p className="text-zinc-400 mt-1">{list.length} projects total</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortOption);
                  setPage(1);
                }}
                className="appearance-none bg-[#0f1219] border border-white/10 text-zinc-300 text-sm rounded-lg pl-4 pr-10 py-2.5 focus:outline-none focus:border-[#00bcd4] cursor-pointer hover:bg-white/5 transition-colors"
              >
                <option value="date">Sort: Date updated</option>
                <option value="name">Sort: Name</option>
                <option value="progress">Sort: Progress</option>
                <option value="budget">Sort: Budget</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>

            <Button
              onClick={() => setModalOpen(true)}
              className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold rounded-full px-5 py-2.5 shadow-[0_0_15px_rgba(0,188,212,0.2)] hover:shadow-[0_0_20px_rgba(0,188,212,0.4)] transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("projects.new")}
            </Button>
          </div>
        </div>

        {/* 2. Stats Banner */}
        {hasProjects && (
          <div className="bg-[#0f1219] border border-white/5 border-l-4 border-l-[#00bcd4] rounded-xl p-6 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-white/5">
              <div className="flex items-center gap-4 px-4">
                <div className="p-3 rounded-full bg-zinc-900/50 text-[#00bcd4]">
                  <LayoutGrid className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Total Projects</p>
                  <p className="text-2xl font-bold text-white">{stats.totalProjects}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 px-4 pt-4 md:pt-0">
                <div className="p-3 rounded-full bg-zinc-900/50 text-emerald-500">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Total Budget</p>
                  <p className="text-2xl font-bold text-white">UGX {formatBudgetShort(stats.totalBudget)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 px-4 pt-4 md:pt-0">
                <div className="p-3 rounded-full bg-zinc-900/50 text-amber-500">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Active Projects</p>
                  <p className="text-2xl font-bold text-white">{stats.activeProjects}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Projects Grid or Empty State */}
        {hasProjects ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedList.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="bg-[#0f1219] border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <span className="text-sm text-zinc-500 px-4">
                  Page <span className="text-white font-medium">{page}</span> of {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="bg-[#0f1219] border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          /* 4. Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-zinc-800 rounded-2xl bg-[#0f1219]/50">
            <div className="w-20 h-20 rounded-full bg-[#00bcd4]/10 flex items-center justify-center mb-6 ring-1 ring-[#00bcd4]/20">
              <FolderOpen className="w-10 h-10 text-[#00bcd4]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {t("projects.empty.title")}
            </h2>
            <p className="text-zinc-400 max-w-md mb-8 leading-relaxed">
              {t("projects.emptySubtitleLong")}
            </p>
            <div className="flex gap-4">
              <Button
                onClick={() => setModalOpen(true)}
                className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold h-11 px-6"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("projects.createNew")}
              </Button>
              <Button
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-white/5 h-11 px-6"
                asChild
              >
                <a href={`https://wa.me/${WHATSAPP_JOIN.replace(/\s/g, "")}`} target="_blank" rel="noreferrer">
                  Link WhatsApp
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* 6. Link WhatsApp Section */}
        {hasProjects && (
          <div className="bg-[#0f1219] border border-white/5 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-[#22c55e]/10 text-[#22c55e] shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Import from WhatsApp</h3>
                <p className="text-zinc-400 text-sm max-w-lg">
                  {t("projects.orWhatsApp")} <span className="text-[#22c55e] font-mono">{WHATSAPP_JOIN}</span> with code <span className="text-white font-mono bg-zinc-800 px-1 rounded">{JOIN_CODE}</span> to get started instantly.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/10 shrink-0"
              asChild
            >
              <a href={`https://wa.me/${WHATSAPP_JOIN.replace(/\s/g, "")}`} target="_blank" rel="noopener noreferrer">
                Chat on WhatsApp
              </a>
            </Button>
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
    </div>
  );
}
