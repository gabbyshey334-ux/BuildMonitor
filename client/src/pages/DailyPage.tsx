"use client";

import React, { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectDaily, useProjectTasks } from "@/hooks/useDashboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowLeft, CloudRain, Camera } from "lucide-react";

function formatDate(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DailySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 dark:bg-zinc-800 bg-slate-200 rounded w-48" />
      <div className="h-32 dark:bg-zinc-800/50 bg-slate-100 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 dark:bg-zinc-800/50 bg-slate-100 rounded-lg" />
        ))}
      </div>
      <div className="h-48 dark:bg-zinc-800/50 bg-slate-100 rounded-lg" />
      <div className="h-64 dark:bg-zinc-800/50 bg-slate-100 rounded-lg" />
    </div>
  );
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="py-8 px-4 text-center">
      <p className="dark:text-zinc-400 text-slate-600 text-sm font-medium">{message}</p>
      {hint && <p className="dark:text-zinc-500 text-slate-500 text-xs mt-2 max-w-sm mx-auto">{hint}</p>}
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
  const today = new Date().toISOString().split("T")[0];
  const { data: tasksData, refetch: refetchTasks } = useProjectTasks(projectId);
  const tasksList = Array.isArray(tasksData) ? tasksData : (tasksData as any)?.tasks ?? [];
  const todayTasks = tasksList.filter(
    (t: any) => t.completed_at && String(t.completed_at).slice(0, 10) === today
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (!projectId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-2">{t("daily.title")}</h1>
          <p className="dark:text-zinc-400 text-slate-500 mb-4">
            {hasProjects ? t("daily.noProjectSelect") : t("daily.noProjectCreate")}
          </p>
          <Button
            onClick={() => setLocation("/projects")}
            className="dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800/50 dark:hover:border-zinc-600 border-slate-300 text-slate-700 hover:bg-slate-100 bg-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {hasProjects ? t("projects.backToProjects") : t("projects.createFirst")}
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-6">{t("daily.title")}</h1>
          <DailySkeleton />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="py-16 px-4 text-center">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-2">{t("daily.title")}</h1>
          <p className="dark:text-zinc-400 text-slate-500 mb-4">{error instanceof Error ? error.message : t("common.error")}</p>
          <Button
            onClick={() => refetch()}
            className="dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800/50 dark:hover:border-zinc-600 border-slate-300 text-slate-700 hover:bg-slate-100 bg-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("common.retry")}
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { heatmap, recentLogs, stats, today: todayData } = data!;
  const selectedLog = selectedDate ? recentLogs.find((l) => (l.log_date || "").toString().substring(0, 10) === selectedDate) : null;
  const allPhotos = recentLogs.flatMap((l) => l.photo_urls || []);

  // Show full page even when no logs: heatmap (all grey), today card, stats, empty activity
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-0">{t("daily.title")}</h1>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 bg-slate-200 text-slate-700 hover:bg-slate-300 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Today's status */}
        <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white mb-6">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 font-bold">{t("daily.today")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className={`text-2xl ${todayData.active ? "text-[#22c55e]" : "dark:text-zinc-500 text-slate-500"}`}>
                {todayData.active ? t("daily.activeToday") : t("daily.noUpdatesYet")}
              </span>
              <span className="dark:text-zinc-400 text-slate-500 text-sm font-medium">
                Workers on site today: {todayData.workerCount ?? 0}
              </span>
            </div>
            {todayData.active && todayData.notes && (
              <p className="dark:text-zinc-400 text-slate-500 text-sm mt-2">{todayData.notes}</p>
            )}
            {todayTasks.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium dark:text-white text-slate-800 mb-2">Tasks completed today</p>
                <ul className="space-y-1">
                  {todayTasks.map((task: any) => (
                    <li key={task.id} className="flex items-center gap-2 text-sm dark:text-zinc-300 text-slate-700">
                      <span className="text-[#22c55e]">✓</span>
                      {task.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {todayData.photos.length > 0 && (
              <div className="flex gap-2 mt-2">
                {todayData.photos.slice(0, 5).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Site photo ${i + 1}`}
                    className="w-20 h-20 object-cover rounded-lg border dark:border-zinc-800 border-slate-300"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs dark:text-zinc-500 text-slate-500 mb-1">{t("daily.totaldays")}</p>
              <p className="text-xl font-bold dark:text-white text-slate-800">{stats.totalActiveDays}</p>
            </CardContent>
          </Card>
          <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs dark:text-zinc-500 text-slate-500 mb-1">{t("daily.streak")}</p>
              <p className="text-xl font-bold text-[#22c55e]">{stats.currentStreak}</p>
            </CardContent>
          </Card>
          <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs dark:text-zinc-500 text-slate-500 mb-1">{t("daily.avgworkers")}</p>
              <p className="text-xl font-bold dark:text-white text-slate-800">{stats.avgWorkerCount}</p>
            </CardContent>
          </Card>
          <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs dark:text-zinc-500 text-slate-500 mb-1">{t("daily.thisWeek")}</p>
              <p className="text-xl font-bold dark:text-white text-slate-800">{stats.thisWeekActive}/7 days</p>
            </CardContent>
          </Card>
          <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs dark:text-zinc-500 text-slate-500 mb-1">{t("daily.photos")}</p>
              <p className="text-xl font-bold dark:text-white text-slate-800">{stats.totalPhotos}</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar heatmap */}
        <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white mb-6">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 font-bold">{t("daily.activity60")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-10 sm:grid-cols-12 gap-1">
              {heatmap.map((h) => (
                <button
                  key={h.date}
                  type="button"
                  onClick={() => setSelectedDate(selectedDate === h.date ? null : h.date)}
                  title={`${h.date} ${h.active ? `- ${h.workerCount} ${t("daily.workersCount")}` : ""}`}
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-sm transition-colors ${
                    h.active ? "bg-[#22c55e]" : "dark:bg-zinc-700 bg-slate-200"
                  } ${selectedDate === h.date ? "ring-2 ring-[#14b8a6]" : ""}`}
                />
              ))}
            </div>
            {selectedDate && selectedLog && (
              <div className="mt-4 p-4 rounded-lg border dark:border-zinc-800 dark:bg-zinc-900/50 border-slate-200 bg-slate-50">
                <p className="dark:text-white text-slate-800 font-medium">{formatDate(selectedDate)}</p>
                {selectedLog.worker_count != null && (
                  <p className="dark:text-zinc-400 text-slate-500 text-sm">{selectedLog.worker_count} {t("daily.workersCount")}</p>
                )}
                {selectedLog.notes && <p className="dark:text-zinc-400 text-slate-500 text-sm mt-1">{selectedLog.notes}</p>}
                {selectedLog.weather_condition && (
                  <p className="dark:text-zinc-400 text-slate-500 text-sm mt-1 flex items-center gap-1">
                    <CloudRain className="w-4 h-4" /> {selectedLog.weather_condition}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white mb-6">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 font-bold">{t("daily.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border dark:border-zinc-800 dark:bg-zinc-900/30 border-slate-200 bg-slate-50"
                >
                  <div className="flex-1">
                    <p className="font-medium dark:text-white text-slate-800">{formatDate(log.log_date || "")}</p>
                    {log.worker_count != null && (
                      <p className="dark:text-zinc-400 text-slate-500 text-sm">{log.worker_count} {t("daily.workersCount")}</p>
                    )}
                    {log.notes && (
                      <p className="dark:text-zinc-400 text-slate-500 text-sm mt-1 line-clamp-2">{log.notes}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      {log.weather_condition && (
                        <span className="text-xs dark:text-zinc-500 text-slate-500 flex items-center gap-1">
                          <CloudRain className="w-3 h-3" /> {log.weather_condition}
                        </span>
                      )}
                      {(log.photo_urls?.length || 0) > 0 && (
                        <span className="text-xs dark:text-zinc-500 text-slate-500 flex items-center gap-1">
                          <Camera className="w-3 h-3" /> {(log.photo_urls?.length || 0)} photos
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Photo gallery */}
        <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 font-bold">{t("daily.sitePhotos")}</CardTitle>
          </CardHeader>
          <CardContent>
            {allPhotos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {allPhotos.slice(0, 20).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Site photo ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border dark:border-zinc-800 border-slate-300"
                  />
                ))}
              </div>
            ) : (
              <EmptyState message={t("daily.noPhotosYet")} hint={t("daily.noPhotosHint")} />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
