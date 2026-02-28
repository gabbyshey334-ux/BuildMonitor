"use client";

import React from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/hooks/useProjects";
import { useProjectExpenses } from "@/hooks/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { MessageCircle, Flag, RefreshCw } from "lucide-react";

const COLORS = ["#22c55e", "#14b8a6", "#218598", "#93C54E", "#B4D68C", "#6EC1C0"];

function formatUgx(n: number) {
  return `UGX ${Math.round(n).toLocaleString()}`;
}

function BudgetSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 dark:bg-zinc-800 bg-slate-200 rounded w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 dark:bg-zinc-800/50 bg-slate-100 rounded-lg" />
        ))}
      </div>
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

export default function BudgetPage() {
  const { currentProject } = useProject();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const projectIdFromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("project") : null;
  const projectId = projectIdFromUrl || currentProject?.id || null;

  const { data, isLoading, isError, error, refetch } = useProjectExpenses(projectId);

  if (!projectId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-2">Budgets & Costs</h1>
          <p className="dark:text-zinc-400 text-slate-500 max-w-md mx-auto mb-6">
            {hasProjects
              ? "Select a project from the sidebar or dashboard to view budget and expenses."
              : "Create your first project to track budget and expenses."}
          </p>
          <Button asChild variant="outline" className="dark:border-zinc-600 dark:text-zinc-300 border-slate-300 text-slate-700">
            <Link href="/projects">{hasProjects ? "Back to Projects" : "Create your first project"}</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-6">Budgets & Costs</h1>
          <BudgetSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="py-16 px-4 text-center">
          <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-2">Budgets & Costs</h1>
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

  const payload = data!;
  const { summary, byCategory, byMonth, recent, vendors } = payload;
  const cumulativeData = (() => {
    let run = 0;
    return byMonth.map((m) => {
      run += m.amount;
      return { month: m.month, amount: run };
    });
  })();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold dark:text-white text-slate-800 mb-6">Budgets & Costs</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm dark:text-[#CBD5E1] text-slate-600 mb-1">Total Budget</p>
              <p className="text-2xl font-bold dark:text-white text-slate-800">{formatUgx(summary.total)}</p>
            </CardContent>
          </Card>
          <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm dark:text-[#CBD5E1] text-slate-600 mb-1">Spent</p>
              <p className="text-2xl font-bold dark:text-white text-slate-800">
                {formatUgx(summary.spent)}
                <span className="text-sm font-normal dark:text-[#94A3B8] text-slate-500 ml-2">({summary.percentage}%)</span>
              </p>
            </CardContent>
          </Card>
          <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm dark:text-[#CBD5E1] text-slate-600 mb-1">Remaining</p>
              <p className="text-2xl font-bold text-[#14b8a6]">{formatUgx(summary.remaining)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-sm dark:text-[#CBD5E1] text-slate-600 mb-2">
            <span>Budget used</span>
            <span>{summary.percentage}%</span>
          </div>
          <Progress
            value={summary.percentage}
            className={`h-2 ${summary.percentage > 80 ? "bg-red-500/20 [&>div]:bg-red-500" : ""}`}
          />
          <div className="flex gap-6 mt-2 text-xs dark:text-zinc-500 text-slate-500">
            {summary.weeklyBurnRate != null && summary.weeklyBurnRate > 0 && (
              <span>Weekly burn: {formatUgx(summary.weeklyBurnRate)}</span>
            )}
            {summary.weeksRemaining != null && (
              <span>Weeks remaining: ~{summary.weeksRemaining}</span>
            )}
          </div>
        </div>

        {/* Budget breakdown */}
        <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white mb-6">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 font-bold">Budget Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={byCategory.map((c, i) => ({ ...c, colorHex: COLORS[i % COLORS.length] }))}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry: { category: string; percentage: number }) => `${entry.category}: ${entry.percentage}%`}
                    >
                      {byCategory.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatUgx(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-4">
                  {byCategory.map((c, i) => (
                    <div key={c.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-sm dark:text-[#E2E8F0] text-slate-600">{c.category}</span>
                      </div>
                      <span className="font-medium dark:text-white text-slate-800">
                        {formatUgx(c.total)} ({c.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                message="No expenses logged yet."
                hint="Send 'Bought cement for 200,000' via WhatsApp to start tracking."
              />
            )}
          </CardContent>
        </Card>

        {/* Budget vs actual (by month) */}
        <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white mb-6">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 font-bold">Spending by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {byMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94A3B8" />
                  <YAxis stroke="#94A3B8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatUgx(v)} />
                  <Bar dataKey="amount" fill="#22c55e" name="Amount" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No spending history yet." hint="Log expenses via WhatsApp to see monthly trends." />
            )}
          </CardContent>
        </Card>

        {/* Cumulative costs */}
        <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white mb-6">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 font-bold">Cumulative Costs Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {cumulativeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94A3B8" />
                  <YAxis stroke="#94A3B8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatUgx(v)} />
                  <Line type="monotone" dataKey="amount" stroke="#14b8a6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                message="Spending trend will appear here after first expense."
                hint="Send an expense via WhatsApp to see your cumulative spend."
              />
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white mb-6">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 font-bold">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left dark:text-[#94A3B8] text-slate-500">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Description</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Source</th>
                      <th className="py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="py-2 pr-4 dark:text-[#E2E8F0] text-slate-600">
                          {r.expense_date ? new Date(r.expense_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2 pr-4 dark:text-white text-slate-800">{r.description}</td>
                        <td className="py-2 pr-4 text-right font-medium dark:text-white text-slate-800">{formatUgx(r.amount)}</td>
                        <td className="py-2 pr-4 dark:text-[#94A3B8] text-slate-500">{r.category}</td>
                        <td className="py-2 pr-4">
                          {r.source === "whatsapp" ? (
                            <span className="text-[#22c55e]" title="WhatsApp">
                              <MessageCircle className="w-4 h-4 inline" />
                            </span>
                          ) : (
                            <span className="dark:text-zinc-500 text-slate-500">Manual</span>
                          )}
                        </td>
                        <td className="py-2">
                          {r.disputed ? (
                            <span className="text-red-500" title="Disputed">
                              <Flag className="w-4 h-4" />
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                message="No transactions yet."
                hint="Log an expense via WhatsApp or the dashboard to see it here."
              />
            )}
          </CardContent>
        </Card>

        {/* Vendor breakdown */}
        <Card className="dark:border-zinc-700 dark:bg-[#1e2235] border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="dark:text-white text-slate-800 font-bold">Vendor Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {vendors.length > 0 ? (
              <ul className="space-y-3">
                {vendors.map((v) => (
                  <li key={v.name} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="dark:text-white text-slate-800 font-medium">{v.name}</span>
                    <span className="dark:text-[#94A3B8] text-slate-500">
                      {formatUgx(v.total)}
                      {v.count > 0 && <span className="dark:text-zinc-500 text-slate-400 text-xs ml-2">({v.count} txns)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No vendor data yet." hint="Expenses logged with a vendor name will appear here." />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
