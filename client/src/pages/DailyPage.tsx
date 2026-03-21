"use client";

import React, { useState } from "react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectDaily } from "@/hooks/useDashboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, ArrowLeft, Flame, Users, Camera, Calendar, 
  X, CloudRain, Plus, ChevronRight, CheckCircle, Activity,
  Package, CreditCard, Image as ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/authToken";
import { useToast } from "@/hooks/use-toast";

function formatDate(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DailySkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 space-y-8 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-10 w-32 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-card border border-border rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-card border border-border rounded-xl" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-card border border-border rounded-xl" />
        ))}
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

  const { data, isLoading, isError, error, refetch } = useProjectDaily(projectId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const token = getToken();

  // Modal State — Daily Timeline Logger
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState<Array<{ time: string; description: string; amount: string; id: number }>>([
    { time: '', description: '', amount: '', id: Date.now() }
  ]);
  const [entryErrors, setEntryErrors] = useState<Record<number, { time?: string; description?: string }>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Timeline date navigation
  const [timelineDate, setTimelineDate] = useState<Date>(new Date());
  const [chatReportCount] = useState<number>(26); // Would come from API in real implementation

  const addEntry = () => {
    setEntries((prev) => [...prev, { time: '', description: '', amount: '', id: Date.now() }]);
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

  const updateEntry = (id: number, field: 'time' | 'description' | 'amount', value: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    setEntryErrors((prev) => ({ ...prev, [id]: { ...prev[id], [field]: undefined } }));
  };

  // Date navigation helpers
  const formatTimelineDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const goToPreviousDay = () => {
    setTimelineDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 1);
      return newDate;
    });
  };

  const goToNextDay = () => {
    setTimelineDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 1);
      return newDate;
    });
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return formatDateKey(date) === formatDateKey(today);
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

    const activityEntries = entries
      .filter((e) => e.time.trim() && e.description.trim())
      .map((e) => ({
        log_time: e.time.trim(),
        activity_type: 'Entry',
        description: e.description.trim(),
        amount: e.amount ? parseFloat(e.amount.replace(/,/g, '')) || null : null,
      }));

    try {
      const res = await fetch('/api/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({
          project_id: projectId,
          log_date: logDate,
          entries: activityEntries,
        }),
      });
      if (!res.ok) throw new Error('Failed to save daily log');
      setShowDailyModal(false);
      setEntries([{ time: '', description: '', amount: '', id: Date.now() }]);
      setEntryErrors({});
      queryClient.invalidateQueries({ queryKey: ['project-daily', projectId] });
      toast({ title: 'Daily log saved! ✅' });
    } catch {
      toast({ title: 'Failed to save daily log', variant: 'destructive' });
    }
  };

  if (isLoading) return <DailySkeleton />;

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

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <Activity className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{t("common.error")}</h1>
          <p className="text-muted-foreground">{error instanceof Error ? error.message : t("common.error")}</p>
          <Button onClick={() => refetch()} variant="outline" className="border-border text-muted-foreground">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const { heatmap, recentLogs, stats } = data!;
  const allPhotos = recentLogs.flatMap((l) => l.photo_urls || []);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* 1. Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Daily Accountability</h1>
            <p className="text-muted-foreground mt-1">Track site progress, worker attendance, and daily conditions.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="icon"
              className="rounded-full w-10 h-10 bg-card border-border text-muted-foreground hover:text-[#00bcd4] hover:border-[#00bcd4]/50 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <button
              onClick={() => {
                setEntryErrors({});
                setLogDate(new Date().toISOString().split('T')[0]);
                setEntries([{ time: '', description: '', amount: '', id: Date.now() }]);
                setShowDailyModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold transition-all shadow-[0_0_15px_rgba(0,188,212,0.2)] hover:shadow-[0_0_20px_rgba(0,188,212,0.4)]"
            >
              <Plus className="w-4 h-4" />
              Log Today
            </button>
          </div>
        </div>

        {/* 2. Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Days */}
          <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group hover:border-border transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-muted/80 group-hover:text-foreground transition-colors">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("daily.totaldays")}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{stats.totalActiveDays}</span>
              <span className="text-sm text-muted-foreground">days recorded</span>
            </div>
          </div>

          {/* Current Streak */}
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
              <span className="text-3xl font-bold text-foreground">{stats.currentStreak}</span>
              <span className="text-sm text-muted-foreground">days in a row</span>
            </div>
          </div>

          {/* Avg Workers */}
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
              <span className="text-3xl font-bold text-foreground">{stats.avgWorkerCount}</span>
              <span className="text-sm text-muted-foreground">per day</span>
            </div>
          </div>

          {/* Total Photos */}
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
              <span className="text-3xl font-bold text-foreground">{stats.totalPhotos}</span>
              <span className="text-sm text-muted-foreground">captured</span>
            </div>
          </div>
        </div>

        {/* 3. Activity Heatmap */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-foreground">Activity Heatmap</h3>
            <span className="text-xs text-muted-foreground">Last 60 days</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {heatmap.map((h, i) => (
              <div
                key={h.date}
                className="relative group"
                onMouseEnter={() => setSelectedDate(h.date)}
                onMouseLeave={() => setSelectedDate(null)}
              >
                <div 
                  className={cn(
                    "w-8 h-8 rounded-md transition-all duration-300",
                    h.active 
                      ? "bg-[#00bcd4] shadow-[0_0_10px_rgba(0,188,212,0.3)] scale-100" 
                      : "bg-muted scale-90 opacity-50 hover:bg-muted/80"
                  )}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-card border border-border rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                  <p className="font-bold text-foreground">{formatDate(h.date)}</p>
                  {h.active ? (
                    <p className="text-[#00bcd4]">{h.workerCount} workers</p>
                  ) : (
                    <p className="text-muted-foreground">No activity</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Timeline Feed */}
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
              <span className="font-semibold text-foreground text-base min-w-[200px] text-center">
                {formatTimelineDate(timelineDate)}
              </span>
              <button
                onClick={goToNextDay}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Next day"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm">
                Chat reports Today ({chatReportCount})
              </span>
              <button className="text-[#00bcd4] hover:text-[#00acc1] text-sm font-medium flex items-center gap-1 transition-colors">
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[60px] top-0 bottom-0 w-px bg-border hidden md:block" />

            {/* Timeline entries */}
            <div className="space-y-4">
              {/* Mock timeline data - in real implementation, fetch from API based on timelineDate */}
              {[
                {
                  id: 1,
                  time: '8:17am',
                  type: 'delivery',
                  title: '30 tons of cement delivered via ABC Transport',
                  subtext: null,
                  author: null,
                  photos: [],
                  amount: null,
                  receipt: null
                },
                {
                  id: 2,
                  time: '9:25am',
                  type: 'progress',
                  title: 'Slab casting completed',
                  subtext: null,
                  author: null,
                  photos: [],
                  amount: null,
                  receipt: null
                },
                {
                  id: 3,
                  time: '11:45am',
                  type: 'photo',
                  title: 'Inspection photos uploaded',
                  subtext: 'Cassaundra (Supervisor) submitted 8 detailed images.',
                  author: 'Cassaundra (Supervisor)',
                  photos: [
                    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=100&h=100&fit=crop',
                    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=100&h=100&fit=crop',
                    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=100&h=100&fit=crop'
                  ],
                  photoCount: 8,
                  amount: null,
                  receipt: null
                },
                {
                  id: 4,
                  time: '2:10pm',
                  type: 'labor',
                  title: '12 workers logged for today',
                  subtext: 'Eric said 10 masons, 2 helpers were on site.',
                  author: 'Eric',
                  photos: [],
                  amount: null,
                  receipt: null
                },
                {
                  id: 5,
                  time: '5:25pm',
                  type: 'expense',
                  title: 'Labour Payment recorded',
                  subtext: '5 workers paid',
                  author: 'Julius',
                  photos: [
                    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=100&h=100&fit=crop',
                    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=100&h=100&fit=crop'
                  ],
                  amount: 300000,
                  receipt: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=200&h=280&fit=crop'
                }
              ].map((entry, index, array) => (
                <div key={entry.id} className="relative flex gap-4 md:gap-6">
                  {/* Time column */}
                  <div className="w-[60px] shrink-0 text-right">
                    <span className="text-sm font-mono text-muted-foreground">{entry.time}</span>
                  </div>

                  {/* Timeline dot */}
                  <div className="hidden md:flex flex-col items-center shrink-0">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full border-2 z-10",
                        entry.type === 'delivery' && "bg-[#00bcd4] border-[#00bcd4]",
                        entry.type === 'progress' && "bg-emerald-500 border-emerald-500",
                        entry.type === 'photo' && "bg-blue-500 border-blue-500",
                        entry.type === 'labor' && "bg-amber-500 border-amber-500",
                        entry.type === 'expense' && "bg-purple-500 border-purple-500"
                      )}
                    />
                    {index < array.length - 1 && (
                      <div className="w-px flex-1 bg-border min-h-[40px]" />
                    )}
                  </div>

                  {/* Card */}
                  <div
                    className={cn(
                      "flex-1 bg-card border border-border rounded-xl p-4 relative overflow-hidden",
                      "hover:border-border/80 transition-all",
                      entry.type === 'delivery' && "border-l-4 border-l-[#00bcd4]",
                      entry.type === 'progress' && "border-l-4 border-l-emerald-500",
                      entry.type === 'photo' && "border-l-4 border-l-blue-500",
                      entry.type === 'labor' && "border-l-4 border-l-amber-500",
                      entry.type === 'expense' && "border-l-4 border-l-purple-500"
                    )}
                  >
                    {/* Icon */}
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-lg shrink-0",
                          entry.type === 'delivery' && "bg-[#00bcd4]/10 text-[#00bcd4]",
                          entry.type === 'progress' && "bg-emerald-500/10 text-emerald-500",
                          entry.type === 'photo' && "bg-blue-500/10 text-blue-500",
                          entry.type === 'labor' && "bg-amber-500/10 text-amber-500",
                          entry.type === 'expense' && "bg-purple-500/10 text-purple-500"
                        )}
                      >
                        {entry.type === 'delivery' && <Package className="w-4 h-4" />}
                        {entry.type === 'progress' && <CheckCircle className="w-4 h-4" />}
                        {entry.type === 'photo' && <ImageIcon className="w-4 h-4" />}
                        {entry.type === 'labor' && <Users className="w-4 h-4" />}
                        {entry.type === 'expense' && <CreditCard className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Title */}
                        <h4 className="font-semibold text-foreground">{entry.title}</h4>

                        {/* Subtext */}
                        {entry.subtext && (
                          <p className="text-muted-foreground text-sm mt-1">{entry.subtext}</p>
                        )}

                        {/* Amount for expenses */}
                        {entry.amount && (
                          <p className="text-[#00bcd4] font-bold text-lg mt-2">
                            UGX {entry.amount.toLocaleString()}
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
                        {entry.photos && entry.photos.length > 0 && (
                          <div className="flex items-center gap-2 mt-3">
                            <div className="flex -space-x-2">
                              {entry.photos.slice(0, 3).map((photo, idx) => (
                                <img
                                  key={idx}
                                  src={photo}
                                  alt=""
                                  className="w-10 h-10 rounded-lg object-cover border-2 border-card"
                                />
                              ))}
                            </div>
                            {entry.photoCount && entry.photoCount > 3 && (
                              <span className="text-sm text-muted-foreground">
                                {entry.photoCount} photos <ChevronRight className="w-3 h-3 inline" />
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Receipt thumbnail for expenses */}
                      {entry.receipt && (
                        <img
                          src={entry.receipt}
                          alt="Receipt"
                          className="w-20 h-24 rounded-lg object-cover shrink-0 ml-2"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {false && (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4">No activity logged for this day.</p>
                <Button
                  onClick={() => {
                    setEntryErrors({});
                    setLogDate(formatDateKey(timelineDate));
                    setEntries([{ time: '', description: '', amount: '', id: Date.now() }]);
                    setShowDailyModal(true);
                  }}
                  className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Log Activity
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Floating + Log Activity Button */}
        <button
          onClick={() => {
            setEntryErrors({});
            setLogDate(formatDateKey(timelineDate));
            setEntries([{ time: '', description: '', amount: '', id: Date.now() }]);
            setShowDailyModal(true);
          }}
          className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3 rounded-full bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold shadow-lg hover:shadow-xl transition-all z-40"
        >
          <Plus className="w-5 h-5" />
          Log Activity
        </button>

        {/* Modal — Daily Timeline Logger */}
        {showDailyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card rounded-xl p-6 w-full max-w-lg border border-border shadow-2xl scale-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-foreground font-bold text-xl">Daily Site Log</h3>
                <button
                  type="button"
                  onClick={() => setShowDailyModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-muted-foreground text-sm mb-4">Record what happened today — time, activity, and cost</p>

              <div className="space-y-4">
                {/* Date picker */}
                <div>
                  <label className="text-muted-foreground text-sm font-medium mb-2 block">Date</label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#00bcd4] transition-all"
                  />
                </div>

                {/* Timeline entries */}
                <div className="space-y-3">
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
                        <div className="col-span-6">
                          <input
                            type="text"
                            placeholder="What happened? e.g. Cement delivery"
                            value={entry.description}
                            onChange={(e) => updateEntry(entry.id, 'description', e.target.value)}
                            className="w-full px-3 py-2 rounded bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#00bcd4] placeholder:text-muted-foreground"
                          />
                          {entryErrors[entry.id]?.description && (
                            <p className="text-red-500 text-[10px] mt-0.5">{entryErrors[entry.id]?.description}</p>
                          )}
                        </div>
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
                      </div>
                    </div>
                  ))}
                </div>

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
                  Save Daily Log
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
