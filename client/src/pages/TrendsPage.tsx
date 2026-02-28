"use client";

import React from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectTrends } from "@/hooks/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { RefreshCw, ArrowLeft, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

function formatUgx(n: number) {
  return `UGX ${Math.round(n).toLocaleString()}`;
}

function formatDate(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function TrendsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 dark:bg-zinc-800 bg-slate-200 rounded w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 dark:bg-zinc-800/50 bg-slate-100 rounded-lg" />
        <div className="h-80 dark:bg-zinc-800/50 bg-slate-100 rounded-lg" />
      </div>
      <div className="h-64 dark:bg-zinc-800/50 bg-slate-100 rounded-lg" />
      <div className="h-48 dark:bg-zinc-800/50 bg-slate-100 rounded-lg" />
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

function TrendBadge({ trend }: { trend: "increasing" | "decreasing" | "stable" }) {
  if (trend === "increasing") {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-[#22c55e]">
        <TrendingUp className="w-4 h-4" /> Increasing
      </span>
    );
  }
  if (trend === "decreasing") {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-amber-500">
        <TrendingDown className="w-4 h-4" /> Decreasing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm dark:text-zinc-400 text-slate-500">
      <Minus className="w-4 h-4" /> Stable
    </span>
  );
}

export default function TrendsPage() {
  const [, setLocation] = useLocation();
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const search = typeof window !== "undefined" ? window.location.search : "";
  const projectId = new URLSearchParams(search).get("project") ?? currentProject?.id ?? null;

  const { data, isLoading, isError, error, refetch } = useProjectTrends(projectId);

  if (!projectId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-2">Trends & Insights</h1>
          <p className="dark:text-zinc-400 text-slate-500 mb-4">
            {hasProjects
              ? "No project selected. Select a project from the sidebar or dashboard."
              : "Create your first project to view trends and insights."}
          </p>
          <Button
            onClick={() => setLocation("/projects")}
            className="dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800/50 dark:hover:border-zinc-600 border-slate-300 text-slate-700 hover:bg-slate-100 bg-white"
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
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-6">Trends & Insights</h1>
          <TrendsSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="py-16 px-4 text-center">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-2">Trends & Insights</h1>
          <p className="dark:text-zinc-400 text-slate-500 mb-4">{error instanceof Error ? error.message : "Something went wrong."}</p>
          <Button
            onClick={() => refetch()}
            className="dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800/50 dark:hover:border-zinc-600 border-slate-300 text-slate-700 hover:bg-slate-100 bg-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { spending, workers, materials, alerts, predictions } = data!;
  const hasData =
    spending.byMonth.length > 0 || workers.byDay.length > 0 || materials.mostUsed.length > 0;

  if (!hasData) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-6">Trends & Insights</h1>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <EmptyState
                message="Trends will appear after a few days of WhatsApp updates."
                hint="Send expenses, worker counts, and material updates to see trends."
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
        <h1 className="text-2xl font-bold text-white mb-6">Trends & Insights</h1>

        {/* Alerts */}
        <Card className="border-border bg-card mb-6">
          <CardHeader>
            <CardTitle className="text-white font-bold">Alerts & Anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-3 rounded-lg ${
                      a.severity === "high"
                        ? "bg-red-500/10 border border-red-500/20"
                        : a.severity === "medium"
                        ? "bg-amber-500/10 border border-amber-500/20"
                        : "bg-zinc-800/50 border border-zinc-700"
                    }`}
                  >
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        a.severity === "high"
                          ? "text-red-500"
                          : a.severity === "medium"
                          ? "text-amber-500"
                          : "text-zinc-500"
                      }`}
                    />
                    <p className="text-sm text-white">{a.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-400 text-sm font-medium">No issues detected</p>
            )}
          </CardContent>
        </Card>

        {/* Predictions */}
        <Card className="border-border bg-card mb-6">
          <CardHeader>
            <CardTitle className="text-white font-bold">Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Weekly Burn Rate</p>
                <p className="text-lg font-bold text-white">{formatUgx(predictions.weeklyBurnRate)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Budget Runout Estimate</p>
                <p className="text-lg font-medium text-white">
                  {predictions.budgetRunout ? formatDate(predictions.budgetRunout) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Project Completion</p>
                <p className="text-lg font-medium text-white">
                  {predictions.estimatedCompletion || "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Spending trend */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white font-bold">Spending Trend</CardTitle>
              <TrendBadge trend={spending.trend} />
            </CardHeader>
            <CardContent>
              {spending.byMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={spending.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94A3B8" />
                    <YAxis stroke="#94A3B8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatUgx(v)} />
                    <Line type="monotone" dataKey="amount" stroke="#22c55e" strokeWidth={2} name="Spent" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No spending data yet." />
              )}
            </CardContent>
          </Card>

          {/* Worker activity */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white font-bold">Worker Activity</CardTitle>
              <TrendBadge trend={workers.trend} />
            </CardHeader>
            <CardContent>
              {workers.byDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={workers.byDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94A3B8" tickFormatter={(v) => formatDate(v)} />
                    <YAxis stroke="#94A3B8" />
                    <Tooltip />
                    <ReferenceLine y={workers.average} stroke="#14b8a6" strokeDasharray="3 3" name="Avg" />
                    <Bar dataKey="count" fill="#14b8a6" name="Workers" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No worker data yet." />
              )}
              <div className="flex gap-4 mt-2 text-sm text-zinc-500">
                <span>Avg: {workers.average}</span>
                <span>Peak: {workers.peak}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Materials usage */}
        <Card className="border-border bg-card mb-6">
          <CardHeader>
            <CardTitle className="text-white font-bold">Materials Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {materials.mostUsed.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={materials.mostUsed} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#94A3B8" />
                    <YAxis type="category" dataKey="name" stroke="#94A3B8" width={80} />
                    <Tooltip
                      formatter={(v: number, name: string, props: { payload?: { unit?: string } }) =>
                        `${(v as number).toLocaleString()} ${props?.payload?.unit || ""}`
                      }
                    />
                    <Bar dataKey="quantity" fill="#22c55e" name="Quantity" />
                  </BarChart>
                </ResponsiveContainer>
                {materials.topVendors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">Top Vendors</h4>
                    <ul className="space-y-2">
                      {materials.topVendors.map((v) => (
                        <li key={v.name} className="flex justify-between text-sm">
                          <span className="text-white">{v.name}</span>
                          <span className="text-zinc-400">{formatUgx(v.total)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState message="No materials data yet." />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
