"use client";

import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, ArrowLeft, Flame, Users, Camera, Calendar, 
  X,   Plus, ChevronRight, CheckCircle, Activity,
  CreditCard, Image as ImageIcon, Truck, HardHat
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Types
type ActivityType = 'delivery' | 'progress' | 'photo' | 'labor' | 'expense' | 'other';

interface TimelineEntry {
  id: number;
  log_time: string;
  /** Normalized on the server; may be unknown strings from older data */
  activity_type: ActivityType | string;
  description: string;
  amount?: number | null;
  photo_urls?: string[];
  worker_count?: number | null;
  author?: string | null;
  source?: 'dashboard' | 'whatsapp' | null;
}

interface DailyLog {
  id: string;
  log_date: string;
  worker_count: number | null;
  notes: string | null;
  milestones: string | null;
  milestone_count: number | null;
  weather_condition: string | null;
  photo_urls: string[] | null;
  activity_entries: TimelineEntry[];
  created_at: string;
}

interface HeatmapDay {
  date: string;
  active: boolean;
  entryCount?: number;
  workerCount: number;
  hasNotes: boolean;
}

interface DailyStats {
  totalActiveDays: number;
  currentStreak: number;
  avgWorkerCount: number;
  totalPhotos: number;
  thisWeekActive: number;
}

// Format helpers
function formatDate(s: string): string {
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimelineDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatTime12Hour(timeStr: string): string {
  // Convert "14:30" to "2:30pm"
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')}${period}`;
}

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Timeline card component
function TimelineCard({ entry, index, total }: { entry: TimelineEntry; index: number; total: number }) {
  const typeColors: Record<ActivityType, { border: string; bg: string; icon: React.ReactNode }> = {
    delivery: { 
      border: "border-l-[#00bcd4]", 
      bg: "bg-[#00bcd4]/10 text-[#00bcd4]",
      icon: <Truck className="w-4 h-4" />
    },
    progress: { 
      border: "border-l-emerald-500", 
      bg: "bg-emerald-500/10 text-emerald-500",
      icon: <CheckCircle className="w-4 h-4" />
    },
    photo: { 
      border: "border-l-blue-500", 
      bg: "bg-blue-500/10 text-blue-500",
      icon: <ImageIcon className="w-4 h-4" />
    },
    labor: { 
      border: "border-l-amber-500", 
      bg: "bg-amber-500/10 text-amber-500",
      icon: <HardHat className="w-4 h-4" />
    },
    expense: { 
      border: "border-l-purple-500", 
      bg: "bg-purple-500/10 text-purple-500",
      icon: <CreditCard className="w-4 h-4" />
    },
    other: { 
      border: "border-l-muted-foreground", 
      bg: "bg-muted text-muted-foreground",
      icon: <Activity className="w-4 h-4" />
    },
  };

  const at = entry.activity_type as ActivityType;
  const colors = typeColors[at] ?? typeColors.other;
  const timeDisplay = formatTime12Hour(entry.log_time);

  return (
    <div className="relative flex gap-4 md:gap-6">
      {/* Time column */}
      <div className="w-[70px] shrink-0 text-right">
        <span className="text-sm font-mono text-muted-foreground">{timeDisplay}</span>
      </div>

      {/* Timeline dot and line */}
      <div className="hidden md:flex flex-col items-center shrink-0">
        <div className={cn("w-3 h-3 rounded-full border-2 z-10", colors.bg.replace('/10', '').replace('text-', 'border-').replace('bg-', ''))} />
        {index < total - 1 && (
          <div className="w-px flex-1 bg-border min-h-[40px] mt-1" />
        )}
      </div>

      {/* Card */}
      <div className={cn("flex-1 bg-card border border-border rounded-xl p-4 relative overflow-hidden", "hover:border-border/80 transition-all", colors.border, "border-l-4")}>
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg shrink-0", colors.bg)}>
            {colors.icon}
          </div>

          <div className="flex-1 min-w-0">
            {/* Title / Description */}
            <h4 className="font-semibold text-foreground">{entry.description}</h4>

            {/* Amount for expenses */}
            {entry.amount && entry.activity_type === 'expense' && (
              <p className="text-[#00bcd4] font-bold text-lg mt-1">
                UGX {entry.amount.toLocaleString()}
              </p>
            )}

            {/* Worker count for labor */}
            {entry.worker_count && entry.activity_type === 'labor' && (
              <p className="text-amber-500 font-medium text-sm mt-1">
                {entry.worker_count} workers
              </p>
            )}

            {/* Author */}
            {entry.author && (
              <div className="flex items-center gap-1 mt-2 text-muted-foreground text-sm">
                <span>{entry.author}</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            )}

            {/* Photo thumbnails */}
            {entry.photo_urls && entry.photo_urls.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <div className="flex -space-x-2">
                  {entry.photo_urls.slice(0, 3).map((photo, idx) => (
                    <img
                      key={idx}
                      src={photo}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover border-2 border-card"
                    />
                  ))}
                </div>
                {entry.photo_urls.length > 3 && (
                  <span className="text-sm text-muted-foreground">
                    {entry.photo_urls.length} photos <ChevronRight className="w-3 h-3 inline" />
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="relative flex gap-4 md:gap-6">
          <div className="w-[70px] shrink-0">
            <div className="h-4 bg-muted rounded w-full" />
          </div>
          <div className="hidden md:flex flex-col items-center shrink-0">
            <div className="w-3 h-3 rounded-full bg-muted" />
            <div className="w-px flex-1 bg-muted min-h-[40px] mt-1" />
          </div>
          <div className="flex-1 bg-card border border-border rounded-xl p-4 h-24">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DailySkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 animate-pulse">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="h-10 bg-muted rounded w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-card border border-border rounded-xl" />
          ))}
        </div>
        <div className="h-48 bg-card border border-border rounded-xl" />
        <TimelineSkeleton />
      </div>
    </div>
  );
}

export default function DailyPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const search = typeof window !== "undefined" ? window.location.search : "";
  const projectId = new URLSearchParams(search).get("project") ?? currentProject?.id ?? null;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Date navigation state
  const [selectedDate, setSelectedDate] = useState<string>(getDateKey(new Date()));
  const todayKey = getDateKey(new Date());

  // Modal state
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [entries, setEntries] = useState<
    Array<{ time: string; description: string; amount: string; workers: string; activityType: ActivityType; id: number }>
  >([{ time: '', description: '', amount: '', workers: '', activityType: 'other', id: Date.now() }]);
  const [entryErrors, setEntryErrors] = useState<Record<number, { time?: string; description?: string }>>({});

  // Fetch daily stats (heatmap, overall stats)
  const { 
    data: statsData, 
    isLoading: isStatsLoading, 
    isError: isStatsError,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['daily-stats', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const res = await apiRequest("GET", `/api/projects/${projectId}/daily`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json as { 
        heatmap: HeatmapDay[]; 
        recentLogs: DailyLog[]; 
        stats: DailyStats;
        today: any;
      };
    },
    enabled: !!projectId,
  });

  // Fetch entries for selected date
  const {
    data: dailyLog,
    isLoading: isDailyLoading,
    isError: isDailyError,
    refetch: refetchDaily
  } = useQuery({
    queryKey: ['daily-log', projectId, selectedDate],
    queryFn: async () => {
      if (!projectId) return null;
      const res = await apiRequest("GET", `/api/daily-logs?project_id=${projectId}&date=${selectedDate}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as DailyLog | null;
    },
    enabled: !!projectId,
  });

  // Timeline entries sorted by time
  const timelineEntries = useMemo(() => {
    if (!dailyLog?.activity_entries) return [];
    const entries = [...dailyLog.activity_entries];
    return entries.sort((a, b) => (a.log_time || '').localeCompare(b.log_time || ''));
  }, [dailyLog]);

  // Chat report count (WhatsApp-sourced entries)
  const chatReportCount = useMemo(() => {
    if (!dailyLog?.activity_entries) return 0;
    return dailyLog.activity_entries.filter(e => e.source === 'whatsapp').length;
  }, [dailyLog]);

  // Day navigation
  const goToPreviousDay = () => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() - 1);
    setSelectedDate(getDateKey(current));
  };

  const goToNextDay = () => {
    if (selectedDate === todayKey) return; // Can't go to future
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + 1);
    setSelectedDate(getDateKey(current));
  };

  const isToday = selectedDate === todayKey;

  // Modal helpers
  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      { time: '', description: '', amount: '', workers: '', activityType: 'other', id: Date.now() },
    ]);
  };

  const removeEntry = (id: number) => {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setEntryErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateEntry = (
    id: number,
    field: 'time' | 'description' | 'amount' | 'workers' | 'activityType',
    value: string | ActivityType
  ) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    setEntryErrors((prev) => ({ ...prev, [id]: { ...prev[id], [field]: undefined } }));
  };

  const handleSaveLog = async () => {
    const errors: Record<number, { time?: string; description?: string }> = {};
    let hasError = false;
    entries.forEach((e) => {
      const eErr: { time?: string; description?: string } = {};
      if (!e.time.trim()) {
        eErr.time = 'Please enter a time';
        hasError = true;
      }
      if (!e.description.trim()) {
        eErr.description = 'Please describe what happened';
        hasError = true;
      }
      if (Object.keys(eErr).length > 0) {
        errors[e.id] = eErr;
      }
    });
    setEntryErrors(errors);
    if (hasError) return;

    if (!projectId) {
      toast({ title: 'No project selected', variant: 'destructive' });
      return;
    }

    try {
      for (const entry of entries) {
        if (!entry.time.trim() || !entry.description.trim()) continue;

        const newEntry: Record<string, unknown> = {
          log_time: entry.time.trim(),
          activity_type: entry.activityType,
          description: entry.description.trim(),
          source: 'dashboard',
        };

        if (entry.amount && entry.activityType === 'expense') {
          newEntry.amount = parseFloat(entry.amount.replace(/,/g, '')) || null;
        }
        if (entry.activityType === 'labor' && entry.workers.trim()) {
          const w = parseInt(entry.workers.replace(/\D/g, ''), 10);
          if (Number.isFinite(w) && w >= 0) newEntry.worker_count = w;
        }

        await apiRequest('POST', '/api/daily-logs', {
          project_id: projectId,
          log_date: selectedDate,
          entry: newEntry,
        });
      }

      setShowDailyModal(false);
      setEntries([{ time: '', description: '', amount: '', workers: '', activityType: 'other', id: Date.now() }]);
      setEntryErrors({});
      
      // Refetch to show new entries
      await refetchDaily();
      await refetchStats();
      queryClient.invalidateQueries({ queryKey: ['project-daily', projectId] });
      queryClient.invalidateQueries({ queryKey: ['api/projects/summary'] });

      toast({ title: 'Activity logged! ✅' });
    } catch (err: any) {
      toast({ title: err.message || 'Failed to save activity', variant: 'destructive' });
    }
  };

  // Heatmap click handler
  const handleHeatmapClick = (date: string) => {
    setSelectedDate(date);
  };

  // Loading state
  if (isStatsLoading && !statsData) {
    return <DailySkeleton />;
  }

  if (!projectId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md space-y-6">
          <div className="w-20 h-20 rounded-full bg-[#00bcd4]/10 flex items-center justify-center mx-auto ring-1 ring-[#00bcd4]/20">
            <Calendar className="w-10 h-10 text-[#00bcd4]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t("daily.title")}</h1>
            <p className="text-muted-foreground">
              {hasProjects ? t("daily.noProjectSelect") : t("daily.noProjectCreate")}
            </p>
          </div>
          <Button
            onClick={() => setLocation("/projects")}
            className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {hasProjects ? t("projects.backToProjects") : t("projects.createFirst")}
          </Button>
        </div>
      </div>
    );
  }

  if (isStatsError && !statsData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <Activity className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{t("common.error")}</h1>
          <p className="text-muted-foreground">Failed to load daily data</p>
          <Button onClick={() => refetchStats()} variant="outline" className="border-border text-muted-foreground">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const stats = statsData?.stats;
  const heatmap = statsData?.heatmap || [];

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans pb-24">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Daily Accountability</h1>
            <p className="text-muted-foreground mt-1">Track site progress, worker attendance, and daily conditions.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => { refetchStats(); refetchDaily(); }}
              variant="outline"
              size="icon"
              className="rounded-full w-10 h-10 bg-card border-border text-muted-foreground hover:text-[#00bcd4] hover:border-[#00bcd4]/50 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group hover:border-border transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-muted/80 group-hover:text-foreground transition-colors">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("daily.totaldays")}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{stats?.totalActiveDays || 0}</span>
              <span className="text-sm text-muted-foreground">days recorded</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group hover:border-amber-500/30 transition-all">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Flame className="w-24 h-24 text-amber-500" />
            </div>
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Flame className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("daily.streak")}</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-bold text-foreground">{stats?.currentStreak || 0}</span>
              <span className="text-sm text-muted-foreground">days in a row</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group hover:border-[#00bcd4]/30 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users className="w-24 h-24 text-[#00bcd4]" />
            </div>
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="p-2 rounded-lg bg-[#00bcd4]/10 text-[#00bcd4]">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("daily.avgworkers")}</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-bold text-foreground">{stats?.avgWorkerCount || 0}</span>
              <span className="text-sm text-muted-foreground">per day</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Camera className="w-24 h-24 text-purple-500" />
            </div>
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("daily.photos")}</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-bold text-foreground">{stats?.totalPhotos || 0}</span>
              <span className="text-sm text-muted-foreground">captured</span>
            </div>
          </div>
        </div>

        {/* Heatmap */}
        <div id="daily-heatmap" className="bg-card border border-border rounded-xl p-6 scroll-mt-24">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-foreground">Activity Heatmap</h3>
            <span className="text-xs text-muted-foreground">Last 60 days</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {heatmap.map((h) => {
              const ec = h.entryCount ?? 0;
              let bgColor = "bg-muted";
              if (h.active) {
                if (ec === 0) bgColor = "bg-cyan-900";
                else if (ec <= 2) bgColor = "bg-cyan-700";
                else if (ec <= 5) bgColor = "bg-cyan-500";
                else bgColor = "bg-cyan-400";
              }
              
              return (
              <div
                key={h.date}
                  className="relative group cursor-pointer"
                  onClick={() => handleHeatmapClick(h.date)}
              >
                <div 
                  className={cn(
                      "w-8 h-8 rounded-md transition-all duration-300 hover:scale-110",
                    h.active 
                        ? `${bgColor} shadow-[0_0_10px_rgba(0,188,212,0.3)]` 
                      : "bg-muted scale-90 opacity-50 hover:bg-muted/80"
                  )}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-card border border-border rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                  <p className="font-bold text-foreground">{formatDate(h.date)}</p>
                    <p className="text-[#00bcd4]">{ec} entries</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline Section */}
        <div className="space-y-6">
          {/* Top Bar */}
          <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousDay}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Previous day"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <span className="font-semibold text-foreground text-base min-w-[250px] text-center">
                {formatTimelineDate(selectedDate)}
              </span>
              <button
                onClick={goToNextDay}
                disabled={isToday}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isToday 
                    ? "text-muted-foreground/30 cursor-not-allowed" 
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
                aria-label="Next day"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm">
                Chat reports ({chatReportCount})
              </span>
              <button
                type="button"
                onClick={() => document.getElementById('daily-heatmap')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="text-[#00bcd4] hover:text-[#00acc1] text-sm font-medium flex items-center gap-1 transition-colors"
              >
                View heatmap <ChevronRight className="w-4 h-4" />
              </button>
                    </div>
                  </div>

          {/* Day summary (workers, notes, weather, site photos — outside activity_entries) */}
          {!isDailyLoading && dailyLog && (
            (dailyLog.worker_count != null && dailyLog.worker_count > 0) ||
            (dailyLog.notes && dailyLog.notes.trim()) ||
            (dailyLog.weather_condition && dailyLog.weather_condition.trim()) ||
            (dailyLog.photo_urls && dailyLog.photo_urls.length > 0)
          ) ? (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Day summary</h3>
              {dailyLog!.worker_count != null && dailyLog!.worker_count > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4 text-[#00bcd4]" />
                  <span>
                    <span className="font-medium text-foreground">{dailyLog!.worker_count}</span> workers on site
                  </span>
                </div>
              )}
              {dailyLog!.weather_condition?.trim() && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Weather:</span> {dailyLog!.weather_condition}
                </p>
              )}
              {dailyLog!.notes?.trim() && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  <span className="font-medium text-foreground">Notes:</span> {dailyLog!.notes}
                </p>
              )}
              {dailyLog!.photo_urls && dailyLog!.photo_urls.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {dailyLog!.photo_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Timeline */}
          <div className="relative">
            {isDailyLoading ? (
              <TimelineSkeleton />
            ) : isDailyError ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Failed to load entries.</p>
                <Button onClick={() => refetchDaily()} variant="outline" className="border-border text-muted-foreground">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
                      </div>
            ) : timelineEntries.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4">No activity logged for this day.</p>
                <Button
                  onClick={() => {
                    setEntryErrors({});
                    setEntries([
                      {
                        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                        description: '',
                        amount: '',
                        workers: '',
                        activityType: 'other',
                        id: Date.now(),
                      },
                    ]);
                    setShowDailyModal(true);
                  }}
                  className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Log Activity
                </Button>
                            </div>
            ) : (
              <div className="space-y-4">
                {timelineEntries.map((entry, index) => (
                  <TimelineCard 
                    key={entry.id || index} 
                    entry={entry} 
                    index={index} 
                    total={timelineEntries.length} 
                  />
                ))}
                    </div>
                  )}
                </div>
        </div>

        {/* Floating + Log Activity Button */}
        <button
          onClick={() => {
            setEntryErrors({});
            setEntries([
              {
                time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                description: '',
                amount: '',
                workers: '',
                activityType: 'other',
                id: Date.now(),
              },
            ]);
            setShowDailyModal(true);
          }}
          className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3 rounded-full bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold shadow-lg hover:shadow-xl transition-all z-40"
        >
          <Plus className="w-5 h-5" />
          Log Activity
        </button>

        {/* Modal */}
        {showDailyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card rounded-xl p-6 w-full max-w-lg border border-border shadow-2xl scale-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-foreground font-bold text-xl">Log Activity</h3>
                <button 
                  type="button"
                  onClick={() => setShowDailyModal(false)} 
                  className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-muted-foreground text-sm mb-4">Record what happened on {formatTimelineDate(selectedDate)}</p>

              <div className="space-y-4">
                {entries.map((entry, idx) => (
                  <div key={entry.id} className="bg-muted/50 rounded-lg p-3 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Entry {idx + 1}</span>
                      {entries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    {/* Activity Type Selector */}
                    <div className="mb-2">
                      <select
                        value={entry.activityType}
                        onChange={(e) => updateEntry(entry.id, 'activityType', e.target.value as ActivityType)}
                        className="w-full px-2 py-1.5 rounded bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#00bcd4]"
                      >
                        <option value="delivery">📦 Delivery</option>
                        <option value="progress">✅ Progress</option>
                        <option value="photo">📷 Photo</option>
                        <option value="labor">👷 Labor</option>
                        <option value="expense">💳 Expense</option>
                        <option value="other">📝 Other</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3">
                    <input
                          type="time"
                          value={entry.time}
                          onChange={(e) => updateEntry(entry.id, 'time', e.target.value)}
                          className="w-full px-2 py-2 rounded bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#00bcd4]"
                        />
                        {entryErrors[entry.id]?.time && (
                          <p className="text-red-500 text-[10px] mt-0.5">{entryErrors[entry.id]?.time}</p>
                        )}
                  </div>
                      <div
                        className={entry.activityType === 'expense' || entry.activityType === 'labor' ? 'col-span-6' : 'col-span-9'}
                      >
                        <input
                          type="text"
                          placeholder="What happened?"
                          value={entry.description}
                          onChange={(e) => updateEntry(entry.id, 'description', e.target.value)}
                          className="w-full px-3 py-2 rounded bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#00bcd4] placeholder:text-muted-foreground"
                        />
                        {entryErrors[entry.id]?.description && (
                          <p className="text-red-500 text-[10px] mt-0.5">{entryErrors[entry.id]?.description}</p>
                        )}
                      </div>
                      {entry.activityType === 'labor' && (
                        <div className="col-span-3">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="# workers"
                            value={entry.workers}
                            onChange={(e) => updateEntry(entry.id, 'workers', e.target.value)}
                            className="w-full px-2 py-2 rounded bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#00bcd4] placeholder:text-muted-foreground"
                          />
                        </div>
                      )}
                      {entry.activityType === 'expense' && (
                        <div className="col-span-3">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="UGX"
                            value={entry.amount}
                            onChange={(e) => updateEntry(entry.id, 'amount', e.target.value)}
                            className="w-full px-2 py-2 rounded bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#00bcd4] placeholder:text-muted-foreground"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addEntry}
                  className="w-full py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-[#00bcd4]/50 hover:bg-[#00bcd4]/5 transition-all text-sm"
                >
                  + Add another entry
                </button>
              </div>

              <div className="flex flex-col gap-3 mt-6">
                <Button 
                  type="button" 
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground hover:bg-muted h-11"
                  onClick={() => setShowDailyModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  className="w-full bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold h-11"
                  onClick={handleSaveLog}
                >
                  Save Activity
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
