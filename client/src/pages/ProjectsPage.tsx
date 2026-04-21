"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Plus,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  LayoutGrid,
  Wallet,
  Activity,
  Search,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
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
import { JengaTrackLogo } from "@/components/ui/Logo";
import { KPICard } from "@/components/ui/KPICard";
import { CurrencyValue } from "@/components/ui/CurrencyValue";
import { EmptyState } from "@/components/ui/EmptyState";
import { safeNum } from "@/lib/analytics";
import { usePageTitle } from "@/hooks/usePageTitle";

const WHATSAPP_JOIN = "+1 415 523 8886";
const JOIN_CODE = "join thick-tea";
const PROJECTS_PER_PAGE = 9;

type SortOption = "date" | "name" | "progress" | "budget";

function ProjectsLoadingSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div className="h-10 w-64 jt-shimmer rounded" />
        <div className="h-10 w-36 jt-shimmer rounded-btn" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 jt-card jt-shimmer" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-64 jt-card jt-shimmer" />
        ))}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  usePageTitle("Projects");
  const { data: fetched = [], isLoading, isError, error, refetch } = useProjects();
  const { projects, setProjects, setCurrentProject } = useProject();
  const { t } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [query, setQuery] = useState("");
  const { toast } = useToast();
  const invalidateProjects = useInvalidateProjects();

  const fetchedJson = JSON.stringify(fetched ?? null);
  useEffect(() => {
    try {
      const parsed = JSON.parse(fetchedJson) as Project[] | null;
      if (Array.isArray(parsed)) {
        setProjects(parsed);
      }
    } catch {
      /* ignore */
    }
  }, [fetchedJson, setProjects]);

  const list = Array.isArray(fetched) ? fetched : projects;
  const hasProjects = list.length > 0;

  // Display currency: first project's currency (or fall back). Spec: no hardcoded currency.
  const displayCurrency = useMemo(() => {
    const first = list.find((p) => !!p.currency);
    return first?.currency || "UGX";
  }, [list]);

  const stats = useMemo(() => {
    const totalProjects = list.length;
    const totalBudget = list.reduce((sum, p) => sum + safeNum(p.totalBudget), 0);
    const totalSpent = list.reduce((sum, p) => sum + safeNum(p.spentAmount), 0);
    const activeProjects = list.filter((p) => p.status === "active" || !p.status).length;
    const completedProjects = list.filter((p) => p.status === "completed").length;
    return { totalProjects, totalBudget, totalSpent, activeProjects, completedProjects };
  }, [list]);

  const filtered = useMemo(() => {
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q),
    );
  }, [list, query]);

  const sortedList = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "name":
        return arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      case "progress":
        return arr.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
      case "budget":
        return arr.sort((a, b) => safeNum(b.totalBudget) - safeNum(a.totalBudget));
      case "date":
      default:
        return arr.sort((a, b) => {
          const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
          return tb - ta;
        });
    }
  }, [filtered, sortBy]);

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
        location: form.location,
      });
      const data = await res.json();
      if (!data.success || !data.project) throw new Error(data.error || "Create failed");
      const newProject: Project = {
        id: data.project.id,
        name: data.project.name,
        location: data.project.description || undefined,
        totalBudget:
          data.project.budgetAmount != null
            ? parseFloat(String(data.project.budgetAmount))
            : undefined,
        spentAmount: 0,
        status: "active",
        progress: 0,
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
      <div className="max-w-[1600px] mx-auto">
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load projects"
          description={
            error instanceof Error ? error.message : t("projects.loadError")
          }
          action={
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="border-border"
            >
              {t("projects.tryAgain")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-[1600px] mx-auto space-y-6 md:space-y-8 min-w-0">
        {/* ── Hero Header with prominent logo ───────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center gap-5 md:flex-row md:items-end md:justify-between md:text-left"
        >
          <div className="flex flex-col items-center md:items-start gap-4 min-w-0 w-full md:w-auto">
            {/* Logo: lg on mobile, xl on desktop, both full variant */}
            <JengaTrackLogo
              variant="full"
              size="lg"
              showTagline
              className="md:hidden"
            />
            <JengaTrackLogo
              variant="full"
              size="xl"
              showTagline
              className="hidden md:inline-flex md:-mb-1"
            />
            <div className="min-w-0 w-full">
              <h1 className="jt-h1 text-foreground truncate">
                {t("projects.title") || "Your Projects"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                {list.length === 0
                  ? "Start by creating your first project."
                  : `${list.length} project${list.length === 1 ? "" : "s"} — ${stats.activeProjects} active${stats.completedProjects ? `, ${stats.completedProjects} completed` : ""}`}
              </p>
            </div>
          </div>

          <Button
            onClick={() => setModalOpen(true)}
            className={cn(
              "jt-btn-primary w-full md:w-auto min-h-[44px] h-11 md:h-10 px-5 md:self-auto shrink-0",
            )}
          >
            <Plus className="h-4 w-4" />
            {t("projects.new") || "New Project"}
          </Button>
        </motion.header>

        {/* ── Stats KPIs ────────────────────────────────────────────── */}
        {hasProjects && (
          <section
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-0"
            aria-label="Portfolio summary"
          >
            <KPICard
              index={0}
              label="Total Projects"
              value={stats.totalProjects}
              sub={`${stats.activeProjects} active`}
              icon={LayoutGrid}
              accent="primary"
            />
            <KPICard
              index={1}
              label="Total Budget"
              value={
                <CurrencyValue
                  value={stats.totalBudget}
                  currency={displayCurrency}
                  compact
                  size="xl"
                />
              }
              sub="Across all projects"
              icon={Wallet}
              accent="secondary"
            />
            <KPICard
              index={2}
              label="Total Spent"
              value={
                <CurrencyValue
                  value={stats.totalSpent}
                  currency={displayCurrency}
                  compact
                  size="xl"
                />
              }
              sub={
                stats.totalBudget > 0
                  ? `${((stats.totalSpent / stats.totalBudget) * 100).toFixed(0)}% of budget`
                  : "No budget set"
              }
              icon={Activity}
              accent="info"
            />
            <KPICard
              index={3}
              label="Active Sites"
              value={stats.activeProjects}
              sub={
                stats.completedProjects > 0
                  ? `${stats.completedProjects} completed`
                  : "All active"
              }
              icon={Activity}
              accent={stats.activeProjects > 0 ? "success" : "info"}
            />
          </section>
        )}

        {/* ── Toolbar: search + sort ───────────────────────────────── */}
        {hasProjects && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search projects by name or location…"
                className="jt-input pl-10 h-10"
                aria-label="Search projects"
              />
            </div>
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortOption);
                  setPage(1);
                }}
                className={cn(
                  "appearance-none rounded-btn bg-muted/40 border border-border",
                  "pl-10 pr-10 py-2 h-10 text-sm text-foreground",
                  "focus:outline-none focus:border-jenga-primary/60",
                  "focus:shadow-[0_0_0_2px_rgba(224,123,57,0.25)]",
                  "transition cursor-pointer",
                )}
                aria-label="Sort projects"
              >
                <option value="date">Sort: Date updated</option>
                <option value="name">Sort: Name</option>
                <option value="progress">Sort: Progress</option>
                <option value="budget">Sort: Budget</option>
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}

        {/* ── Grid / Empty State ───────────────────────────────────── */}
        {hasProjects ? (
          sortedList.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches"
              description={`No projects match "${query}". Try a different search.`}
              compact
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginatedList.map((project, i) => (
                  <ProjectCard key={project.id} project={project} index={i} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="bg-jenga-raised/60 border-border hover:border-jenga-primary/40 hover:bg-jenga-raised"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground font-mono">
                    <span className="text-foreground font-semibold">{page}</span>
                    {" / "}
                    <span>{totalPages}</span>
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="bg-jenga-raised/60 border-border hover:border-jenga-primary/40 hover:bg-jenga-raised"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )
        ) : (
          <EmptyState
            icon={FolderOpen}
            title={t("projects.empty.title") || "No projects yet"}
            description={
              t("projects.emptySubtitleLong") ||
              "Track expenses, materials, and progress across every site. Create your first project to get started."
            }
            action={
              <Button
                onClick={() => setModalOpen(true)}
                className="jt-btn-primary h-11 px-6"
              >
                <Plus className="h-4 w-4" />
                {t("projects.createNew") || "Create Project"}
              </Button>
            }
            secondaryAction={
              <a
                href={`https://wa.me/${WHATSAPP_JOIN.replace(/\s/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="jt-btn-outline h-11 px-6"
              >
                <Smartphone className="h-4 w-4 text-jenga-whatsapp" />
                Link WhatsApp
              </a>
            }
          />
        )}

        {/* ── WhatsApp footer ──────────────────────────────────────── */}
        {hasProjects && (
          <motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className={cn(
              "jt-card p-5 md:p-6",
              "flex flex-col md:flex-row items-start md:items-center justify-between gap-5",
              "border-l-[3px] border-l-jenga-whatsapp/70",
            )}
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-btn bg-jenga-whatsapp/10 text-jenga-whatsapp shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-foreground text-base mb-1">
                  Log from WhatsApp
                </h3>
                <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                  Send a message to{" "}
                  <span className="text-jenga-whatsapp font-mono font-semibold">
                    {WHATSAPP_JOIN}
                  </span>{" "}
                  with{" "}
                  <span className="text-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[12px]">
                    {JOIN_CODE}
                  </span>{" "}
                  to log expenses, materials, and daily updates — all from the site.
                </p>
              </div>
            </div>
            <a
              href={`https://wa.me/${WHATSAPP_JOIN.replace(/\s/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-2 h-10 px-4 rounded-btn shrink-0 text-sm font-semibold",
                "border border-jenga-whatsapp/30 text-jenga-whatsapp hover:bg-jenga-whatsapp/10 transition",
              )}
            >
              <Smartphone className="h-4 w-4" />
              Chat on WhatsApp
            </a>
          </motion.aside>
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
    </>
  );
}
