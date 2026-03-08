"use client";

import React from "react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectTrends } from "@/hooks/useDashboard";
import { useLanguage } from "@/contexts/LanguageContext";
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
} from "recharts";
import { 
  RefreshCw, ArrowLeft, TrendingUp, TrendingDown, Minus, 
  AlertTriangle, ShieldCheck, AlertCircle, Calendar, 
  DollarSign, Users, Package, Activity 
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="min-h-screen bg-background p-6 space-y-8 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-10 w-10 bg-muted rounded" />
      </div>
      <div className="h-32 bg-card border border-border rounded-xl" />
      <div className="h-80 bg-card border border-border rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-card border border-border rounded-xl" />
        <div className="h-80 bg-card border border-border rounded-xl" />
      </div>
    </div>
  );
}

function EmptyState({ message, icon: Icon }: { message: string; icon?: any }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
      {Icon && <Icon className="w-8 h-8 mb-3 opacity-50" />}
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

export default function TrendsPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const search = typeof window !== "undefined" ? window.location.search : "";
  const projectId = new URLSearchParams(search).get("project") ?? currentProject?.id ?? null;

  const { data, isLoading, isError, error, refetch } = useProjectTrends(projectId);

  if (isLoading) return <TrendsSkeleton />;

  if (!projectId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md space-y-6">
          <div className="w-20 h-20 rounded-full bg-[#00bcd4]/10 flex items-center justify-center mx-auto ring-1 ring-[#00bcd4]/20">
            <Activity className="w-10 h-10 text-[#00bcd4]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t("trends.title")}</h1>
            <p className="text-muted-foreground">
              {hasProjects ? t("trends.noProjectSelect") : t("trends.noProjectCreate")}
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
            <AlertTriangle className="w-8 h-8 text-red-500" />
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

  const { spending, workers, materials, alerts, predictions } = data!;
  const hasBudgetWarning = alerts.some(a => a.type === 'budget_warning');
  
  // Custom Tooltip for charts
  const CustomTooltip = ({ active, payload, label, formatter }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-xl">
          <p className="text-muted-foreground text-xs mb-1">{label}</p>
          <p className="text-foreground font-bold text-sm">
            {formatter ? formatter(payload[0].value) : payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 1. Header Row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Trends & Insights</h1>
            <p className="text-muted-foreground mt-1">Analytics and predictive metrics for your project.</p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="icon"
            className="rounded-full w-10 h-10 bg-card border-border text-muted-foreground hover:text-[#00bcd4] hover:border-[#00bcd4]/50 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* 2. Prediction Banner */}
        <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-[#00bcd4] to-amber-500">
          <div className="bg-card rounded-[11px] p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              {hasBudgetWarning ? (
                <AlertTriangle className="w-32 h-32 text-amber-500" />
              ) : (
                <ShieldCheck className="w-32 h-32 text-emerald-500" />
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-2 text-[#00bcd4]">
                  <Activity className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wider">Weekly Burn Rate</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{formatUgx(predictions.weeklyBurnRate)}</p>
                <p className="text-muted-foreground text-xs mt-1">Average spent per week</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2 text-amber-500">
                  <Calendar className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wider">Runout Date</span>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {predictions.budgetRunout ? formatDate(predictions.budgetRunout) : "—"}
                </p>
                <p className="text-muted-foreground text-xs mt-1">Estimated based on current rate</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                  <ShieldCheck className={cn("w-5 h-5", hasBudgetWarning ? "text-amber-500" : "text-emerald-500")} />
                  <span className="text-sm font-bold uppercase tracking-wider">Budget Status</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-2xl font-bold", hasBudgetWarning ? "text-amber-500" : "text-emerald-500")}>
                    {hasBudgetWarning ? "Attention Needed" : "On Track"}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs mt-1">
                  {predictions.estimatedCompletion ? `Est. completion: ${predictions.estimatedCompletion}` : "Sufficient funds projected"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Spending by Month */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#00bcd4]" />
              Spending History
            </h3>
            {spending.trend === 'increasing' && <span className="text-xs text-red-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Increasing</span>}
            {spending.trend === 'decreasing' && <span className="text-xs text-emerald-400 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Decreasing</span>}
          </div>
          <div className="h-[300px] w-full">
            {spending.byMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spending.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#52525b" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#52525b" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                    dx={-10}
                  />
                  <Tooltip content={<CustomTooltip formatter={formatUgx} />} cursor={{ fill: '#ffffff05' }} />
                  <Bar 
                    dataKey="amount" 
                    fill="#00bcd4" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No spending data available" icon={DollarSign} />
            )}
          </div>
        </div>

        {/* 4. Two Column Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Worker Trend */}
          <div className="bg-card border border-border rounded-xl p-6">
             <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                Worker Activity
              </h3>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>Avg: <span className="text-foreground font-medium">{workers.average}</span></span>
                <span>Peak: <span className="text-foreground font-medium">{workers.peak}</span></span>
              </div>
            </div>
            <div className="h-[250px] w-full">
              {workers.byDay.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={workers.byDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#52525b" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(d) => formatDate(d).split(',')[0]} // Short date
                      dy={10}
                    />
                    <YAxis 
                      stroke="#52525b" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dx={-10}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={{ fill: '#f59e0b', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No worker data recorded" icon={Users} />
              )}
            </div>
          </div>

          {/* Top Materials */}
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-6">
              <Package className="w-5 h-5 text-[#00bcd4]" />
              Top Materials
            </h3>
            <div className="flex-1">
              {materials.mostUsed.length > 0 ? (
                <div className="space-y-4">
                  {materials.mostUsed.slice(0, 5).map((m, i) => {
                    // Calculate mock percentage for visual bar since we don't have max capacity
                    const max = Math.max(...materials.mostUsed.map(x => x.quantity));
                    const pct = (m.quantity / max) * 100;
                    
                    return (
                      <div key={m.name} className="group">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-foreground font-medium group-hover:text-foreground transition-colors">{m.name}</span>
                          <span className="text-muted-foreground">
                            <span className="text-foreground font-bold">{m.quantity.toLocaleString()}</span> {m.unit}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#00bcd4] rounded-full opacity-80 group-hover:opacity-100 transition-all duration-500" 
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState message="No material data available" icon={Package} />
              )}
            </div>
          </div>
        </div>

        {/* 5. Alerts List */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Alerts & Anomalies
            </h3>
            {alerts.length > 0 && (
              <span className="px-2 py-1 rounded bg-red-500/10 text-red-500 text-xs font-bold border border-red-500/20">
                {alerts.length} Issues
              </span>
            )}
          </div>
          
          {alerts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alerts.map((alert, i) => (
                <div 
                  key={i}
                  className={cn(
                    "p-4 rounded-lg border flex items-start gap-3 transition-colors",
                    alert.severity === 'high' || alert.type === 'budget_warning'
                      ? "bg-red-500/5 border-red-500/20 hover:bg-red-500/10" 
                      : "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-full shrink-0",
                    alert.severity === 'high' || alert.type === 'budget_warning' ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                  )}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={cn(
                      "font-bold text-sm mb-0.5",
                      alert.severity === 'high' || alert.type === 'budget_warning' ? "text-red-400" : "text-amber-400"
                    )}>
                      {alert.type === 'budget_warning' ? 'Budget Warning' : 'Attention Required'}
                    </h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted">
              <ShieldCheck className="w-12 h-12 mb-3 text-emerald-500/50" />
              <p className="font-medium text-emerald-500/80">All systems operational</p>
              <p className="text-xs">No alerts or anomalies detected.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
