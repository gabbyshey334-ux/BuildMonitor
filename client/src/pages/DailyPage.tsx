"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  ArrowLeft,
  Flame,
  Users,
  Camera,
  Calendar,
  X,
  Plus,
  ChevronRight,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { uploadPhotoDirectly } from "@/lib/uploadPhoto";

// Normalize a single photo entry that may be a plain URL string, a JSON-stringified
// object, or a proper { url } object — always returns a clean URL string or null.
function extractPhotoUrl(e: unknown): string | null {
  if (typeof e === 'string') {
    const t = e.trim();
    if (t.startsWith('{') || t.startsWith('"')) {
      try {
        const parsed = JSON.parse(t);
        if (parsed && typeof parsed === 'object' && (parsed as any).url) return (parsed as any).url;
      } catch { /* not JSON */ }
    }
    return t.startsWith('http') ? t : null;
  }
  if (e && typeof e === 'object' && (e as any).url) return (e as any).url;
  return null;
}

function toPhotoUrls(raw: unknown[] | null | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(extractPhotoUrl).filter((u): u is string => u !== null);
}

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
  // Use local date to avoid UTC offset shifting the calendar day
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DESC_PREVIEW_LEN = 160;

function activityTypeLabel(entry: TimelineEntry): string {
  const raw = String(entry.activity_type || 'other').toLowerCase();
  if (raw === 'expense' && entry.amount != null && Number(entry.amount) > 0) {
    return 'Labour payment';
  }
  const map: Record<string, string> = {
    delivery: 'Delivery',
    progress: 'Task completion',
    photo: 'Media upload',
    labor: 'Staffing',
    expense: 'Financials',
    other: 'Activity',
  };
  return map[raw] ?? 'Activity';
}

function sourceLabel(source?: string | null): string {
  if (source === 'whatsapp') return 'WhatsApp';
  if (source === 'dashboard') return 'Dashboard';
  return source || '';
}

function DailyTimelineRow({
  entry,
  isLast,
}: {
  entry: TimelineEntry;
  isLast: boolean;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const timeDisplay = formatTime12Hour(entry.log_time);
  const typeLabel = activityTypeLabel(entry);
  const photos = toPhotoUrls(entry.photo_urls);
  const hasPhotos = photos.length > 0;
  const longText =
    (entry.description?.length ?? 0) > DESC_PREVIEW_LEN && !hasPhotos;
  const descPreview = longText
    ? `${entry.description.slice(0, DESC_PREVIEW_LEN).trim()}…`
    : entry.description;

  return (
    <>
      <div
        className={cn(
          'flex gap-2 sm:gap-4',
          !isLast && 'border-b border-border',
        )}
      >
        <div className="w-14 sm:w-[72px] shrink-0 text-right pt-1">
          <span className="text-xs sm:text-sm text-muted-foreground tabular-nums">
            {timeDisplay}
          </span>
        </div>

        <div className="flex flex-col items-center shrink-0 w-3 pt-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#E07B39] shadow-[0_0_8px_rgba(0,188,212,0.8)] ring-4 ring-background z-10 shrink-0" />
          {!isLast && (
            <div className="w-0.5 flex-1 bg-gradient-to-b from-[#E07B39] to-[#E07B39]/20 min-h-[48px] mt-1 rounded-full" />
          )}
        </div>

        <div className="flex-1 min-w-0 py-4 pr-1 sm:pr-3 group">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E07B39]/10 text-[#E07B39] text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">
                {typeLabel}
              </div>
              <p className="text-sm sm:text-base text-foreground leading-relaxed whitespace-pre-wrap">
                {longText ? descPreview : entry.description}
              </p>
              {entry.amount != null &&
                entry.activity_type === 'expense' &&
                Number(entry.amount) > 0 && (
                  <p className="text-[#E07B39] font-mono tabular-nums font-bold text-base mt-1">
                    {(typeof window !== 'undefined' &&
                      (window as { __dailyCurrency?: string }).__dailyCurrency) ||
                      'UGX'}{' '}
                    {Number(entry.amount).toLocaleString()}
                  </p>
                )}
              {entry.worker_count != null &&
                entry.activity_type === 'labor' &&
                entry.worker_count > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {entry.worker_count} workers
                  </p>
                )}
              {(entry.author || entry.source) && (
                <p className="text-xs text-muted-foreground mt-2">
                  {entry.author && <span>{entry.author}</span>}
                  {entry.author && entry.source && <span> · </span>}
                  {entry.source && (
                    <span>{sourceLabel(entry.source)}</span>
                  )}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-start">
              {hasPhotos && (
                <button
                  type="button"
                  onClick={() => setGalleryOpen(true)}
                  className="text-xs font-bold text-[#E07B39] hover:text-[#F08B49] flex items-center gap-1 whitespace-nowrap bg-[#E07B39]/10 hover:bg-[#E07B39]/20 px-2.5 py-1 rounded-md transition-colors"
                >
                  View all
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              {longText && (
                <button
                  type="button"
                  onClick={() => setTextOpen(true)}
                  className="text-xs font-bold text-[#E07B39] hover:text-[#F08B49] flex items-center gap-1 whitespace-nowrap bg-[#E07B39]/10 hover:bg-[#E07B39]/20 px-2.5 py-1 rounded-md transition-colors"
                >
                  View all
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {hasPhotos && (
            <div className="mt-4 flex flex-col sm:flex-row gap-4 sm:items-start">
              <button
                type="button"
                onClick={() => setGalleryOpen(true)}
                className="flex items-center gap-3 text-left shrink-0 group-hover:bg-muted/50 p-2 rounded-xl transition-colors"
              >
                <div className="flex -space-x-2">
                  {photos.slice(0, 3).map((photo, idx) => (
                    <img
                      key={idx}
                      src={photo}
                      alt=""
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover border-2 border-card"
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground flex items-center gap-0.5">
                  {photos.length} photos
                  <ChevronRight className="w-4 h-4" />
                </span>
              </button>
              <div className="flex-1 flex gap-2 min-w-0">
                {photos[0] && (
                  <img
                    src={photos[0]}
                    alt=""
                    className="flex-1 min-w-0 h-32 sm:h-36 rounded-lg object-cover border border-border"
                  />
                )}
                {photos[1] && (
                  <img
                    src={photos[1]}
                    alt=""
                    className="flex-1 min-w-0 h-32 sm:h-36 rounded-lg object-cover border border-border hidden sm:block"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Photos</DialogTitle>
            <DialogDescription className="sr-only">Gallery of photos attached to this daily log entry.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
            {photos.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square rounded-lg overflow-hidden border border-border"
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={textOpen} onOpenChange={setTextOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{typeLabel}</DialogTitle>
            <DialogDescription className="sr-only">Full text for this log entry.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-foreground whitespace-pre-wrap pt-2">
            {entry.description}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TimelineSkeleton() {
  return (
    <div className="animate-pulse">
      {[1, 2, 3].map((i, idx) => (
        <div
          key={i}
          className={cn(
            'flex gap-2 sm:gap-4',
            idx < 2 && 'border-b border-border',
          )}
        >
          <div className="w-14 sm:w-[72px] shrink-0 pt-2">
            <div className="h-4 bg-muted rounded w-full" />
          </div>
          <div className="flex flex-col items-center shrink-0 w-3 pt-2">
            <div className="w-2.5 h-2.5 rounded-full bg-muted" />
            {idx < 2 && (
              <div className="w-0.5 flex-1 bg-muted min-h-[48px] mt-1" />
            )}
          </div>
          <div className="flex-1 py-4 space-y-2">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-4 bg-muted rounded w-full max-w-md" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DailySkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="w-full space-y-6 md:space-y-8">
        <div className="h-10 bg-muted rounded w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-card border border-border rounded-xl" />
          ))}
        </div>
        <div className="flex flex-col-reverse xl:flex-row gap-6">
          <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card p-4 space-y-4">
            <div className="h-12 bg-muted rounded-lg w-full" />
            <TimelineSkeleton />
          </div>
          <div className="w-full xl:w-[min(100%,320px)] xl:min-w-[260px] shrink-0 h-40 xl:h-64 rounded-2xl border border-border bg-card" />
        </div>
      </div>
    </div>
  );
}

export default function DailyPage() {
  usePageTitle("Daily Log");
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const search = typeof window !== "undefined" ? window.location.search : "";
  const projectId = new URLSearchParams(search).get("project") ?? currentProject?.id ?? null;

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      (window as { __dailyCurrency?: string }).__dailyCurrency =
        currentProject?.currency || "UGX";
    }
  }, [currentProject?.currency]);

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

  // Per-entry photo state (keyed by entry.id)
  const [entryPhotos, setEntryPhotos] = useState<Record<number, string[]>>({});
  const [uploadingEntryId, setUploadingEntryId] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoTargetEntryId, setPhotoTargetEntryId] = useState<number | null>(null);

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

  const [chatFilterOnly, setChatFilterOnly] = useState(false);

  const displayTimelineEntries = useMemo(() => {
    if (!chatFilterOnly) return timelineEntries;
    return timelineEntries.filter((e) => e.source === 'whatsapp');
  }, [timelineEntries, chatFilterOnly]);

  // Chat report count (WhatsApp-sourced entries)
  const chatReportCount = useMemo(() => {
    if (!dailyLog?.activity_entries) return 0;
    return dailyLog.activity_entries.filter(e => e.source === 'whatsapp').length;
  }, [dailyLog]);

  function formatChatReportsDateLabel(): string {
    if (selectedDate === todayKey) return 'Today';
    return formatDate(selectedDate);
  }

  useEffect(() => {
    setChatFilterOnly(false);
  }, [selectedDate]);

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

  const openPhotoPicker = (entryId: number) => {
    console.log('[Photo] ref:', photoInputRef.current, 'entryId:', entryId);
    setPhotoTargetEntryId(entryId);
    photoInputRef.current?.click();
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !photoTargetEntryId || !projectId) return;
    setUploadingEntryId(photoTargetEntryId);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const url = await uploadPhotoDirectly(file, projectId);
        urls.push(url);
      }
      setEntryPhotos((prev) => ({
        ...prev,
        [photoTargetEntryId]: [...(prev[photoTargetEntryId] || []), ...urls],
      }));
      toast({ title: `${urls.length} photo${urls.length > 1 ? 's' : ''} uploaded` });
    } catch (err: any) {
      toast({ title: err?.message || 'Photo upload failed', variant: 'destructive' });
    } finally {
      setUploadingEntryId(null);
      setPhotoTargetEntryId(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
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
          photo_urls: entryPhotos[entry.id] || [],
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
      setEntryPhotos({});
      
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
      <div className="w-full min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md space-y-6">
          <div className="w-20 h-20 rounded-full bg-[#E07B39]/10 flex items-center justify-center mx-auto ring-1 ring-[#E07B39]/20">
            <Calendar className="w-10 h-10 text-[#E07B39]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t("daily.title")}</h1>
            <p className="text-muted-foreground">
              {hasProjects ? t("daily.noProjectSelect") : t("daily.noProjectCreate")}
            </p>
          </div>
          <Button
            onClick={() => setLocation("/projects")}
            className="bg-[#E07B39] hover:bg-[#F08B49] text-black font-semibold"
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
      <div className="w-full min-h-[60vh] flex items-center justify-center">
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
    <div className="w-full min-w-0 max-w-full overflow-x-hidden text-foreground font-sans">
      <div className="w-full space-y-6 md:space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#E07B39] to-blue-500 truncate">
              Daily Accountability
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl">
              Track site progress, worker attendance, and daily conditions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => { refetchStats(); refetchDaily(); }}
              variant="outline"
              size="icon"
              className="rounded-full w-10 h-10 bg-card/50 backdrop-blur-sm border-border text-muted-foreground hover:text-[#E07B39] hover:border-[#E07B39]/50 hover:bg-[#E07B39]/10 transition-all shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-card to-card/50 border border-border rounded-2xl p-4 sm:p-6 relative overflow-hidden group hover:border-[#E07B39]/30 hover:shadow-lg hover:shadow-[#E07B39]/5 transition-all duration-300 min-w-0">
            <div className="flex items-center gap-3 mb-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-muted text-muted-foreground group-hover:bg-[#E07B39]/10 group-hover:text-[#E07B39] transition-colors shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">{t("daily.totaldays")}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">{stats?.totalActiveDays || 0}</span>
              <span className="text-sm font-medium text-muted-foreground">days recorded</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-card to-card/50 border border-border rounded-2xl p-4 sm:p-6 relative overflow-hidden group hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300 min-w-0">
             <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
              <Flame className="w-32 h-32 text-amber-500" />
            </div>
            <div className="flex items-center gap-3 mb-3 relative z-10 min-w-0">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">{t("daily.streak")}</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">{stats?.currentStreak || 0}</span>
              <span className="text-sm font-medium text-muted-foreground">days in a row</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-card to-card/50 border border-border rounded-2xl p-4 sm:p-6 relative overflow-hidden group hover:border-[#E07B39]/30 hover:shadow-lg hover:shadow-[#E07B39]/5 transition-all duration-300 min-w-0">
            <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
              <Users className="w-32 h-32 text-[#E07B39]" />
            </div>
            <div className="flex items-center gap-3 mb-3 relative z-10 min-w-0">
              <div className="p-2.5 rounded-xl bg-[#E07B39]/10 text-[#E07B39] shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">{t("daily.avgworkers")}</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">{stats?.avgWorkerCount || 0}</span>
              <span className="text-sm font-medium text-muted-foreground">per day</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-card to-card/50 border border-border rounded-2xl p-4 sm:p-6 relative overflow-hidden group hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 min-w-0">
            <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
              <Camera className="w-32 h-32 text-purple-500" />
            </div>
            <div className="flex items-center gap-3 mb-3 relative z-10 min-w-0">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">{t("daily.photos")}</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">{stats?.totalPhotos || 0}</span>
              <span className="text-sm font-medium text-muted-foreground">captured</span>
            </div>
          </div>
        </div>

        {/* Daily log + heatmap: mobile heatmap first (flex-col-reverse), desktop timeline left */}
        <div className="flex flex-col-reverse xl:flex-row xl:items-start gap-6">
          <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 p-4 border-b border-border">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={goToPreviousDay}
                  className="p-2 rounded-xl bg-muted/50 hover:bg-[#E07B39]/10 text-muted-foreground hover:text-[#E07B39] transition-all shrink-0"
                  aria-label="Previous day"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <span className="font-bold text-foreground text-sm sm:text-base text-center flex-1 min-w-0 px-1 truncate">
                  {formatTimelineDate(selectedDate)}
                </span>
                <button
                  type="button"
                  onClick={goToNextDay}
                  disabled={isToday}
                  className={cn(
                    'p-2 rounded-xl transition-all shrink-0',
                    isToday
                      ? 'bg-transparent text-muted-foreground/30 cursor-not-allowed'
                      : 'bg-muted/50 hover:bg-[#E07B39]/10 text-muted-foreground hover:text-[#E07B39]',
                  )}
                  aria-label="Next day"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-center sm:justify-end gap-3 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setChatFilterOnly((v) => !v)}
                  className={cn(
                    'rounded-lg border-[#E07B39] text-[#E07B39] bg-transparent hover:bg-[#E07B39]/10 hover:text-[#E07B39]',
                    chatFilterOnly && 'bg-[#E07B39]/10',
                  )}
                >
                  Chat reports · {formatChatReportsDateLabel()} ({chatReportCount})
                </Button>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('daily-heatmap')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className="text-[#E07B39] hover:text-[#F08B49] text-sm font-medium flex items-center gap-1 transition-colors xl:hidden"
                >
                  View heatmap <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isDailyLoading &&
              dailyLog &&
              ((dailyLog.worker_count != null && dailyLog.worker_count > 0) ||
                (dailyLog.notes && dailyLog.notes.trim()) ||
                (dailyLog.weather_condition && dailyLog.weather_condition.trim()) ||
                (dailyLog.photo_urls && dailyLog.photo_urls.length > 0)) && (
                <div className="px-5 py-4 border-b border-border space-y-3 bg-gradient-to-r from-muted/30 to-transparent">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E07B39]/70" />
                    Day summary
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3 sm:gap-6">
                    <div className="space-y-2">
                      {dailyLog.worker_count != null && dailyLog.worker_count > 0 && (
                        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                          <div className="p-1.5 rounded-lg bg-[#E07B39]/10 text-[#E07B39] shrink-0">
                            <Users className="w-3.5 h-3.5" />
                          </div>
                          <span>
                            <span className="font-bold text-foreground">{dailyLog.worker_count}</span> workers on site
                          </span>
                        </div>
                      )}
                      {dailyLog.weather_condition?.trim() && (
                        <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                          <span className="font-bold text-foreground mt-0.5">Weather:</span> 
                          <span className="leading-snug">{dailyLog.weather_condition}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {dailyLog.notes?.trim() && (
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          <span className="font-bold text-foreground block mb-0.5">Notes:</span> 
                          {dailyLog.notes}
                        </div>
                      )}
                      {dailyLog.photo_urls && dailyLog.photo_urls.length > 0 && (() => {
                        const cleanUrls = toPhotoUrls(dailyLog.photo_urls);
                        return cleanUrls.length > 0 ? (
                          <div className="flex flex-wrap gap-2 pt-1.5">
                            {cleanUrls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-lg shadow-sm">
                                <img src={url} alt="" className="w-12 h-12 sm:w-14 sm:h-14 object-cover border border-border group-hover:scale-110 transition-transform duration-300" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                              </a>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              )}

            <div className="p-4 sm:px-5">
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
              ) : displayTimelineEntries.length === 0 ? (
                <div className="text-center py-16">
                  {chatFilterOnly && timelineEntries.length > 0 ? (
                    <>
                      <p className="text-muted-foreground mb-4">No WhatsApp chat reports for this day.</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-border text-muted-foreground"
                        onClick={() => setChatFilterOnly(false)}
                      >
                        Show all activity
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-[#E07B39]/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-[#E07B39]/20 shadow-sm">
                        <Activity className="w-8 h-8 text-[#E07B39]" />
                      </div>
                      <p className="text-muted-foreground font-medium mb-6">No activity logged for this day.</p>
                      <Button
                        onClick={() => {
                          setEntryErrors({});
                          setEntries([
                            {
                              time: new Date().toLocaleTimeString('en-US', {
                                hour12: false,
                                hour: '2-digit',
                                minute: '2-digit',
                              }),
                              description: '',
                              amount: '',
                              workers: '',
                              activityType: 'other',
                              id: Date.now(),
                            },
                          ]);
                          setShowDailyModal(true);
                        }}
                        className="bg-[#E07B39] hover:bg-[#F08B49] text-black font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-xl px-6"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Log Activity
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {displayTimelineEntries.map((entry, index) => (
                    <DailyTimelineRow
                      key={entry.id ?? index}
                      entry={entry}
                      isLast={index === displayTimelineEntries.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            id="daily-heatmap"
            className="w-full xl:w-[min(100%,320px)] xl:min-w-[260px] shrink-0 rounded-2xl border border-border bg-gradient-to-b from-card to-card/50 p-5 sm:p-6 scroll-mt-24 shadow-sm"
          >
            <h3 className="text-lg font-bold text-foreground mb-6">Activity — last 60 days</h3>
            <div className="flex flex-wrap gap-2">
              {heatmap.map((h) => {
                const ec = h.entryCount ?? 0;
                let bgColor = 'bg-muted';
                if (h.active) {
                  if (ec === 0) bgColor = 'bg-cyan-900';
                  else if (ec <= 2) bgColor = 'bg-cyan-700';
                  else if (ec <= 5) bgColor = 'bg-cyan-500';
                  else bgColor = 'bg-cyan-400';
                }

                return (
                  <div
                    key={h.date}
                    className="relative group cursor-pointer"
                    onClick={() => handleHeatmapClick(h.date)}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-md transition-all duration-300 hover:scale-110',
                        h.active
                          ? `${bgColor} shadow-[0_0_10px_rgba(0,188,212,0.3)]`
                          : 'bg-muted scale-90 opacity-50 hover:bg-muted/80',
                      )}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-card border border-border rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                      <p className="font-bold text-foreground">{formatDate(h.date)}</p>
                      <p className="text-[#E07B39]">{ec} entries</p>
                    </div>
                  </div>
                );
              })}
            </div>
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
          className="fixed bottom-24 md:bottom-6 right-4 md:right-6 flex items-center gap-2 px-4 sm:px-5 py-3 rounded-full bg-gradient-to-r from-[#E07B39] to-blue-500 hover:from-[#F08B49] hover:to-blue-600 text-white text-sm sm:text-base font-bold shadow-lg hover:shadow-xl hover:shadow-[#E07B39]/20 hover:-translate-y-1 transition-all duration-300 z-[60]"
        >
          <Plus className="w-5 h-5" />
          Log Activity
        </button>

        {/* Hidden file input — must be at root level (outside conditional block) so ref stays mounted */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handlePhotoFileChange}
        />

        {/* Modal */}
        {showDailyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card rounded-xl p-6 w-full max-w-lg border border-border shadow-2xl scale-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-foreground font-bold text-xl">Log Activity</h3>
                <button 
                  type="button"
                  onClick={() => { setShowDailyModal(false); setEntryPhotos({}); }} 
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
                        className="w-full px-2 py-1.5 rounded bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#E07B39]"
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
                          className="w-full px-2 py-2 rounded bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#E07B39]"
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
                          className="w-full px-3 py-2 rounded bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#E07B39] placeholder:text-muted-foreground"
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
                            className="w-full px-2 py-2 rounded bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#E07B39] placeholder:text-muted-foreground"
                          />
                        </div>
                      )}
                      {entry.activityType === 'expense' && (
                        <div className="col-span-3">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder={currentProject?.currency || "UGX"}
                            value={entry.amount}
                            onChange={(e) => updateEntry(entry.id, 'amount', e.target.value)}
                            className="w-full px-2 py-2 rounded bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#E07B39] placeholder:text-muted-foreground"
                          />
                        </div>
                      )}
                    </div>

                    {/* Photo upload area — shown for photo type or when photos already attached */}
                    {(entry.activityType === 'photo' || (entryPhotos[entry.id] && entryPhotos[entry.id].length > 0)) && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => openPhotoPicker(entry.id)}
                          disabled={uploadingEntryId === entry.id}
                          className="flex items-center gap-2 text-sm text-[#E07B39] hover:text-[#F08B49] bg-[#E07B39]/10 hover:bg-[#E07B39]/20 px-3 py-2 rounded-lg transition-colors w-full justify-center"
                        >
                          <Camera className="w-4 h-4" />
                          {uploadingEntryId === entry.id
                            ? 'Uploading…'
                            : entryPhotos[entry.id]?.length
                            ? `${entryPhotos[entry.id].length} photo${entryPhotos[entry.id].length > 1 ? 's' : ''} attached — add more`
                            : 'Choose photos'}
                        </button>
                        {entryPhotos[entry.id]?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {entryPhotos[entry.id].map((url, i) => (
                              <img
                                key={i}
                                src={url}
                                alt=""
                                className="w-12 h-12 rounded object-cover border border-border"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addEntry}
                  className="w-full py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-[#E07B39]/50 hover:bg-[#E07B39]/5 transition-all text-sm"
                >
                  + Add another entry
                </button>
              </div>

              <div className="flex flex-col gap-3 mt-6">
                <Button 
                  type="button" 
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground hover:bg-muted h-11"
                  onClick={() => { setShowDailyModal(false); setEntryPhotos({}); }}
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  className="w-full bg-[#E07B39] hover:bg-[#F08B49] text-black font-bold h-11"
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