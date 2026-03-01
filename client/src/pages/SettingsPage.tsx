"use client";

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProject } from "@/contexts/ProjectContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProjects, useInvalidateProjects } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Loader2, FolderOpen } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

interface SettingsData {
  project: {
    id: string;
    name: string;
    description: string;
    budget: number;
    status: string;
    channel_type: string;
    created_at: string;
  };
  profile: {
    full_name: string;
    whatsapp_number: string;
    default_currency: string;
    preferred_language: string;
  };
}

export default function SettingsPage() {
  const { currentProject } = useProject();
  const { t } = useLanguage();
  const projectIdFromUrl =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("project")
      : null;
  const projectId = projectIdFromUrl || currentProject?.id || null;

  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    budget: "",
    status: "active",
    channel_type: "direct",
    whatsapp_number: "",
    full_name: "",
  });

  const invalidateProjects = useInvalidateProjects();
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? projectsData : [];
  const hasProjects = projects.length > 0;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [confirmCompletedOpen, setConfirmCompletedOpen] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiRequest("GET", `/api/projects/${projectId}/settings`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success || !json.project) throw new Error(json.error || "Failed to load");
        setData(json);
        setForm({
          name: json.project.name || "",
          description: json.project.description || "",
          budget: String(json.project.budget ?? ""),
          status: json.project.status || "active",
          channel_type: json.project.channel_type || "direct",
          whatsapp_number: json.profile?.whatsapp_number || "",
          full_name: json.profile?.full_name || "",
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Failed to load settings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {};
      if (form.name !== undefined) payload.name = form.name;
      if (form.description !== undefined) payload.description = form.description;
      if (form.budget !== undefined && form.budget !== "") payload.budget = parseFloat(form.budget);
      if (form.status !== undefined) payload.status = form.status;
      if (form.channel_type !== undefined) payload.channel_type = form.channel_type;
      if (form.whatsapp_number !== undefined) payload.whatsapp_number = form.whatsapp_number;
      if (form.full_name !== undefined) payload.full_name = form.full_name;

      const res = await apiRequest("PATCH", `/api/projects/${projectId}/settings`, payload);
      const json = await res.json();

      if (!json.success) throw new Error(json.error || "Save failed");

      setData((prev) =>
        prev && json.project
          ? { ...prev, project: { ...prev.project, ...json.project } }
          : prev
      );
      await invalidateProjects();
      toast({
        title: t("settings.saved"),
        description: "Your project and profile settings have been updated.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!projectId) return;

    setSaving(true);
    setError(null);

    try {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/settings`, {
        status: "completed",
      });
      const json = await res.json();

      if (!json.success) throw new Error(json.error || "Update failed");

      await invalidateProjects();
      toast({
        title: "Project completed",
        description: "The project has been marked as completed.",
      });
      setLocation("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to mark as completed",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="rounded-full dark:bg-zinc-800 bg-slate-200 p-6 mb-4">
            <FolderOpen className="h-12 w-12 dark:text-zinc-500 text-slate-500" />
          </div>
          <h2 className="font-heading text-xl font-semibold dark:text-white text-slate-800 mb-2">
            {hasProjects ? "No project selected" : "Create your first project"}
          </h2>
          <p className="dark:text-zinc-400 text-slate-600 max-w-md mb-6">
            {hasProjects
              ? "Select a project from the list or create your first project to manage settings."
              : "Get started by creating your first project."}
          </p>
          <Button asChild className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] text-white hover:opacity-90">
            <Link href="/projects">
              <a>Create your first project</a>
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 dark:bg-zinc-800 bg-slate-200 rounded w-48" />
          <div className="grid gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-12 dark:bg-zinc-800/50 bg-slate-200 rounded-lg" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="font-heading text-2xl font-bold dark:text-white text-slate-800 mb-6">{t("settings.title")}</h1>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-6">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <Card className="dark:bg-zinc-900/80 dark:border-zinc-800/50 bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="dark:text-white text-slate-800 text-lg">{t("settings.project")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name" className="dark:text-zinc-400 text-slate-600 text-sm">
                  {t("settings.projectname")}
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-white bg-white border-slate-300 text-slate-800"
                  placeholder="My Project"
                />
              </div>
              <div>
                <Label htmlFor="description" className="dark:text-zinc-400 text-slate-600 text-sm">
                  {t("settings.location")}
                </Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-white bg-white border-slate-300 text-slate-800"
                  placeholder="Site location or description"
                />
              </div>
              <div>
                <Label htmlFor="budget" className="dark:text-zinc-400 text-slate-600 text-sm">
                  {t("settings.budget")}
                </Label>
                <Input
                  id="budget"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                  className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-white bg-white border-slate-300 text-slate-800"
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="dark:text-zinc-400 text-slate-600 text-sm">{t("settings.status")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-white bg-white border-slate-300 text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-zinc-900 dark:border-zinc-700 bg-white border-slate-200">
                    <SelectItem value="active" className="dark:text-zinc-200 text-slate-800">
                      {t("projects.active")}
                    </SelectItem>
                    <SelectItem value="completed" className="dark:text-zinc-200 text-slate-800">
                      {t("projects.completed")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="dark:text-zinc-400 text-slate-600 text-sm">Channel Type</Label>
                <Select
                  value={form.channel_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, channel_type: v }))}
                >
                  <SelectTrigger className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-white bg-white border-slate-300 text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-zinc-900 dark:border-zinc-700 bg-white border-slate-200">
                    <SelectItem value="direct" className="dark:text-zinc-200 text-slate-800">
                      Direct
                    </SelectItem>
                    <SelectItem value="group" className="dark:text-zinc-200 text-slate-800">
                      Group
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-zinc-900/80 dark:border-zinc-800/50 bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="dark:text-white text-slate-800 text-lg">{t("settings.profile")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="whatsapp_number" className="dark:text-zinc-400 text-slate-600 text-sm">
                  {t("settings.whatsapp")}
                </Label>
                <Input
                  id="whatsapp_number"
                  value={form.whatsapp_number}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))}
                  className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-white bg-white border-slate-300 text-slate-800"
                  placeholder="+256700000000"
                />
              </div>
              <div>
                <Label htmlFor="full_name" className="dark:text-zinc-400 text-slate-600 text-sm">
                  {t("settings.displayname")}
                </Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="mt-1.5 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-white bg-white border-slate-300 text-slate-800"
                  placeholder="Your name"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-zinc-900/80 dark:border-zinc-800/50 bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="dark:text-white text-slate-800 text-lg">{t("settings.language")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="dark:text-zinc-300 text-slate-700 text-sm">
                    {t("settings.languageHint")}
                  </p>
                  <p className="dark:text-zinc-500 text-slate-400 text-xs mt-1">
                    {t("settings.languageHintExtra")}
                  </p>
                </div>
                <LanguageSwitcher variant="full" />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={saving}
            className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] text-white hover:opacity-90 w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              t("settings.save")
            )}
          </Button>
        </form>

        <Card className="mt-8 border-red-500/50 bg-red-500/5">
          <CardHeader>
            <CardTitle className="text-red-400 text-lg">{t("settings.danger")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="dark:text-zinc-400 text-slate-600 text-sm mb-4">
              {t("settings.complete")}. You won&apos;t be able to log new expenses or updates.
            </p>
            <AlertDialog open={confirmCompletedOpen} onOpenChange={setConfirmCompletedOpen}>
              <Button
                type="button"
                variant="outline"
                disabled={saving || form.status === "completed"}
                onClick={() => setConfirmCompletedOpen(true)}
                className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                {t("settings.complete")}
              </Button>
              <AlertDialogContent className="dark:bg-zinc-900 dark:border-zinc-700 bg-white border-slate-200">
                <AlertDialogHeader>
                  <AlertDialogTitle className="dark:text-white text-slate-800">{t("settings.completeConfirm")}</AlertDialogTitle>
                  <AlertDialogDescription className="dark:text-zinc-400 text-slate-600">
                    {t("settings.completeDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="dark:border-zinc-600 dark:text-zinc-300">{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      setConfirmCompletedOpen(false);
                      handleMarkCompleted();
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    >
                    {t("settings.completeConfirmButton")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
