"use client";

import React, { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectDaily } from "@/hooks/useDashboard";
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
      <div className="h-8 bg-zinc-800 rounded w-48" />
      <div className="h-32 bg-zinc-800/50 rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-zinc-800/50 rounded-lg" />
        ))}
      </div>
      <div className="h-48 bg-zinc-800/50 rounded-lg" />
      <div className="h-64 bg-zinc-800/50 rounded-lg" />
    </div>
  );
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="py-8 px-4 text-center">
      <p className="text-zinc-400 text-sm font-medium">{message}</p>
      {hint && <p className="text-zinc-500 text-xs mt-2 max-w-sm mx-auto">{hint}</p>}
    </div>
  );
}

export default function DailyPage() {
  const [, setLocation] = useLocation();
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const search = typeof window !== "undefined" ? window.location.search : "";
  const projectId = new URLSearchParams(search).get("project") ?? currentProject?.id ?? null;

  const { data, isLoading, isError, error, refetch } = useProjectDaily(projectId);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (!projectId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Daily Accountability</h1>
          <p className="text-zinc-400 mb-4">
            {hasProjects
              ? "No project selected. Select a project from the sidebar or dashboard."
              : "Create your first project to log daily updates."}
          </p>
          <Button
            onClick={() => setLocation("/projects")}
            className="border border-zinc-700 text-white hover:bg-zinc-800/50 hover:border-zinc-600 bg-transparent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {hasProjects ? "Back to Projects" : "Create your first project"}
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Daily Accountability</h1>
          <DailySkeleton />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="py-16 px-4 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Daily Accountability</h1>
          <p className="text-zinc-400 mb-4">{error instanceof Error ? error.message : "Something went wrong."}</p>
          <Button
            onClick={() => refetch()}
            className="border border-zinc-700 text-white hover:bg-zinc-800/50 hover:border-zinc-600 bg-transparent"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { heatmap, recentLogs, stats, today } = data!;
  const selectedLog = selectedDate ? recentLogs.find((l) => (l.log_date || "").toString().substring(0, 10) === selectedDate) : null;
  const allPhotos = recentLogs.flatMap((l) => l.photo_urls || []);

  if (recentLogs.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Daily Accountability</h1>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <EmptyState
                message="No daily updates yet."
                hint="Send '6 workers on site today' or 'Foundation 80% complete' via WhatsApp to start your activity log."
              />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Daily Accountability</h1>

        {/* Today's status */}
        <Card className="border-border bg-card mb-6">
          <CardHeader>
            <CardTitle className="text-white font-bold">Today&apos;s Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className={`text-2xl ${today.active ? "text-[#22c55e]" : "text-zinc-500"}`}>
                {today.active ? "Active today" : "No updates yet"}
              </span>
              {today.active && today.workerCount > 0 && (
                <span className="text-zinc-400 text-sm">{today.workerCount} workers logged</span>
              )}
            </div>
            {today.active && today.notes && (
              <p className="text-zinc-400 text-sm mt-2">{today.notes}</p>
            )}
            {today.photos.length > 0 && (
              <div className="flex gap-2 mt-2">
                {today.photos.slice(0, 5).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Site photo ${i + 1}`}
                    className="w-20 h-20 object-cover rounded-lg border border-zinc-800"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="border-border bg-card">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-zinc-500 mb-1">Active Days</p>
              <p className="text-xl font-bold text-white">{stats.totalActiveDays}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-zinc-500 mb-1">Current Streak</p>
              <p className="text-xl font-bold text-[#22c55e]">{stats.currentStreak}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-zinc-500 mb-1">Avg Workers</p>
              <p className="text-xl font-bold text-white">{stats.avgWorkerCount}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-zinc-500 mb-1">This Week</p>
              <p className="text-xl font-bold text-white">{stats.thisWeekActive}/7 days</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-zinc-500 mb-1">Photos</p>
              <p className="text-xl font-bold text-white">{stats.totalPhotos}</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar heatmap */}
        <Card className="border-border bg-card mb-6">
          <CardHeader>
            <CardTitle className="text-white font-bold">Activity (Last 60 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-10 sm:grid-cols-12 gap-1">
              {heatmap.map((h) => (
                <button
                  key={h.date}
                  type="button"
                  onClick={() => setSelectedDate(selectedDate === h.date ? null : h.date)}
                  title={`${h.date} ${h.active ? `- ${h.workerCount} workers` : ""}`}
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-sm transition-colors ${
                    h.active ? "bg-[#22c55e]" : "bg-zinc-800"
                  } ${selectedDate === h.date ? "ring-2 ring-[#14b8a6]" : ""}`}
                />
              ))}
            </div>
            {selectedDate && selectedLog && (
              <div className="mt-4 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
                <p className="text-white font-medium">{formatDate(selectedDate)}</p>
                {selectedLog.worker_count != null && (
                  <p className="text-zinc-400 text-sm">{selectedLog.worker_count} workers</p>
                )}
                {selectedLog.notes && <p className="text-zinc-400 text-sm mt-1">{selectedLog.notes}</p>}
                {selectedLog.weather_condition && (
                  <p className="text-zinc-400 text-sm mt-1 flex items-center gap-1">
                    <CloudRain className="w-4 h-4" /> {selectedLog.weather_condition}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="border-border bg-card mb-6">
          <CardHeader>
            <CardTitle className="text-white font-bold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/30"
                >
                  <div className="flex-1">
                    <p className="font-medium text-white">{formatDate(log.log_date || "")}</p>
                    {log.worker_count != null && (
                      <p className="text-zinc-400 text-sm">{log.worker_count} workers</p>
                    )}
                    {log.notes && (
                      <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{log.notes}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      {log.weather_condition && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <CloudRain className="w-3 h-3" /> {log.weather_condition}
                        </span>
                      )}
                      {(log.photo_urls?.length || 0) > 0 && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
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
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-white font-bold">Site Photos</CardTitle>
          </CardHeader>
          <CardContent>
            {allPhotos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {allPhotos.slice(0, 20).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Site photo ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border border-zinc-800"
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No photos yet." hint="Send site photos via WhatsApp to see them here." />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
