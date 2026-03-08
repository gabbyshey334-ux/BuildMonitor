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
  X, CloudRain, Plus, ChevronRight, CheckCircle, Activity 
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
    <div className="min-h-screen bg-[#0a0c12] p-6 space-y-8 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-[#1e2230] rounded" />
        <div className="h-10 w-32 bg-[#1e2230] rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-[#0f1219] border border-white/5 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-[#0f1219] border border-white/5 rounded-xl" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-[#0f1219] border border-white/5 rounded-xl" />
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

  // Modal State
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [dailyForm, setDailyForm] = useState({ workerCount: '', notes: '' });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleDailyLog = async () => {
    if (!dailyForm.workerCount.trim() && !dailyForm.notes.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/daily/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({
          worker_count: parseInt(dailyForm.workerCount, 10) || 0,
          notes: dailyForm.notes.trim(),
          log_date: new Date().toISOString().split('T')[0],
        }),
      });
      if (!res.ok) throw new Error('Failed to save daily log');
      setShowDailyModal(false);
      setDailyForm({ workerCount: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['project-daily', projectId] });
      toast({ title: 'Daily log saved! ✅' });
    } catch {
      toast({ title: 'Failed to save daily log', variant: 'destructive' });
    }
  };

  if (isLoading) return <DailySkeleton />;

  if (!projectId) {
    return (
      <div className="min-h-screen bg-[#0a0c12] flex items-center justify-center p-6">
        <div className="text-center max-w-md space-y-6">
          <div className="w-20 h-20 rounded-full bg-[#00bcd4]/10 flex items-center justify-center mx-auto ring-1 ring-[#00bcd4]/20">
            <Calendar className="w-10 h-10 text-[#00bcd4]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">{t("daily.title")}</h1>
            <p className="text-zinc-400">
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
      <div className="min-h-screen bg-[#0a0c12] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <Activity className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-white">{t("common.error")}</h1>
          <p className="text-zinc-400">{error instanceof Error ? error.message : t("common.error")}</p>
          <Button onClick={() => refetch()} variant="outline" className="border-zinc-700 text-zinc-300">
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
    <div className="min-h-screen bg-[#0a0c12] text-zinc-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* 1. Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Daily Accountability</h1>
            <p className="text-zinc-400 mt-1">Track site progress, worker attendance, and daily conditions.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="icon"
              className="rounded-full w-10 h-10 bg-[#0f1219] border-zinc-800 text-zinc-400 hover:text-[#00bcd4] hover:border-[#00bcd4]/50 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <button
              onClick={() => setShowDailyModal(true)}
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
          <div className="bg-[#0f1219] border border-white/5 rounded-xl p-6 relative overflow-hidden group hover:border-white/10 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-zinc-800/50 text-zinc-400 group-hover:bg-white/10 group-hover:text-white transition-colors">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-zinc-400 uppercase tracking-wider">{t("daily.totaldays")}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{stats.totalActiveDays}</span>
              <span className="text-sm text-zinc-500">days recorded</span>
            </div>
          </div>

          {/* Current Streak */}
          <div className="bg-[#0f1219] border border-white/5 rounded-xl p-6 relative overflow-hidden group hover:border-amber-500/30 transition-all">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Flame className="w-24 h-24 text-amber-500" />
            </div>
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Flame className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-zinc-400 uppercase tracking-wider">{t("daily.streak")}</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-bold text-white">{stats.currentStreak}</span>
              <span className="text-sm text-zinc-500">days in a row</span>
            </div>
          </div>

          {/* Avg Workers */}
          <div className="bg-[#0f1219] border border-white/5 rounded-xl p-6 relative overflow-hidden group hover:border-[#00bcd4]/30 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users className="w-24 h-24 text-[#00bcd4]" />
            </div>
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="p-2 rounded-lg bg-[#00bcd4]/10 text-[#00bcd4]">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-zinc-400 uppercase tracking-wider">{t("daily.avgworkers")}</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-bold text-white">{stats.avgWorkerCount}</span>
              <span className="text-sm text-zinc-500">per day</span>
            </div>
          </div>

          {/* Total Photos */}
          <div className="bg-[#0f1219] border border-white/5 rounded-xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Camera className="w-24 h-24 text-purple-500" />
            </div>
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-zinc-400 uppercase tracking-wider">{t("daily.photos")}</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-bold text-white">{stats.totalPhotos}</span>
              <span className="text-sm text-zinc-500">captured</span>
            </div>
          </div>
        </div>

        {/* 3. Activity Heatmap */}
        <div className="bg-[#0f1219] border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Activity Heatmap</h3>
            <span className="text-xs text-zinc-500">Last 60 days</span>
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
                      : "bg-zinc-800/50 scale-90 opacity-50 hover:bg-zinc-700"
                  )}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 border border-white/10 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                  <p className="font-bold text-white">{formatDate(h.date)}</p>
                  {h.active ? (
                    <p className="text-[#00bcd4]">{h.workerCount} workers</p>
                  ) : (
                    <p className="text-zinc-500">No activity</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Recent Logs List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Recent Daily Logs</h2>
          
          {recentLogs.length === 0 ? (
            <div className="bg-[#0f1219] border border-white/5 rounded-xl p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">{t("daily.noUpdatesYet")}</h3>
              <p className="text-zinc-500 max-w-sm mx-auto">
                Start tracking daily progress by clicking the "Log Today" button above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="bg-[#0f1219] border border-white/5 rounded-xl p-5 hover:border-[#00bcd4]/30 transition-all group flex flex-col h-full"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-white text-lg">{formatDate(log.log_date || "")}</span>
                    <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#00bcd4]/10 text-[#00bcd4] text-xs font-bold">
                      <Users className="w-3 h-3" />
                      {log.worker_count ?? 0} Workers
                    </div>
                  </div>

                  <div className="flex-1 mb-4">
                    {log.weather_condition && (
                      <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-2">
                        <CloudRain className="w-3 h-3 text-[#00bcd4]" />
                        <span>{log.weather_condition}</span>
                      </div>
                    )}
                    {log.notes ? (
                      <p className="text-zinc-400 text-sm line-clamp-2 leading-relaxed">
                        {log.notes}
                      </p>
                    ) : (
                      <p className="text-zinc-600 text-sm italic">No notes recorded.</p>
                    )}
                  </div>

                  {/* Photos footer */}
                  {log.photo_urls && log.photo_urls.length > 0 && (
                    <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
                      {log.photo_urls.slice(0, 3).map((url, idx) => (
                        <a 
                          key={idx} 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-[#00bcd4] transition-colors relative group/img"
                        >
                          <img src={url} alt="Site" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors" />
                        </a>
                      ))}
                      {log.photo_urls.length > 3 && (
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-white/5 flex items-center justify-center text-xs font-medium text-zinc-400">
                          +{log.photo_urls.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal */}
        {showDailyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1e2235] rounded-xl p-6 w-full max-w-md border border-white/10 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold text-xl">Daily Log</h3>
                <button 
                  onClick={() => setShowDailyModal(false)} 
                  className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="text-zinc-300 text-sm font-medium mb-2 block">Workers on site</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={dailyForm.workerCount}
                      onChange={(e) => setDailyForm((p) => ({ ...p, workerCount: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#0f1219] border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#00bcd4] placeholder-zinc-600 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-zinc-300 text-sm font-medium mb-2 block">Notes</label>
                  <textarea
                    placeholder="e.g. Foundation 80% complete, rain delayed work..."
                    value={dailyForm.notes}
                    onChange={(e) => setDailyForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-[#0f1219] border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#00bcd4] placeholder-zinc-600 resize-none transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 border-white/10 hover:bg-white/5 hover:text-white text-zinc-300 h-12" 
                  onClick={() => setShowDailyModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  className="flex-1 bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold h-12" 
                  onClick={handleDailyLog}
                >
                  Save Log
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
