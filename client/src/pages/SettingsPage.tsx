"use client";

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProjects, useInvalidateProjects } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getToken } from "@/lib/authToken";
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
import { AlertTriangle, Loader2, Settings, User, Phone, Lock, Globe, Save, Trash2, Smartphone } from "lucide-react";
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

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [linkPhone, setLinkPhone] = useState("");
  const [linkingWhatsApp, setLinkingWhatsApp] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkSuccess, setLinkSuccess] = useState(false);

  const handleLinkWhatsApp = async () => {
    setLinkError("");
    setLinkSuccess(false);
    if (!linkPhone.trim()) {
      setLinkError("Enter your WhatsApp number (e.g. +2349165631240)");
      return;
    }
    setLinkingWhatsApp(true);
    try {
      const token = typeof window !== "undefined" ? getToken() : null;
      const res = await fetch("/api/auth/link-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: linkPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Link failed");
      setLinkSuccess(true);
      setLinkPhone("");
      await invalidateProjects();
      toast({
        title: "WhatsApp linked",
        description: "Projects created via WhatsApp will now appear in My Projects.",
      });
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Failed to link");
    } finally {
      setLinkingWhatsApp(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError("");
    setPasswordSuccess(false);

    if (!passwordForm.currentPassword) {
      setPasswordError("Current password is required");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const token = typeof window !== "undefined" ? getToken() : null;
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);

      setPasswordSuccess(true);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast({ title: "Password changed successfully! 🔒" });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

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
      <div className="min-h-screen bg-[#0a0c12] text-zinc-100 p-6 flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-[#00bcd4]/10 flex items-center justify-center mx-auto ring-1 ring-[#00bcd4]/20">
            <Settings className="w-10 h-10 text-[#00bcd4]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">{t("settings.title")}</h1>
            <p className="text-zinc-400">
              {hasProjects ? t("trends.noProjectSelect") : t("trends.noProjectCreate")}
            </p>
          </div>
          <Button
            onClick={() => setLocation("/projects")}
            className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-semibold"
          >
            {hasProjects ? t("projects.backToProjects") : t("projects.createFirst")}
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0c12] p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-[#1e2230] rounded" />
        <div className="grid gap-6">
          <div className="h-96 bg-[#0f1219] border border-white/5 rounded-xl" />
          <div className="h-64 bg-[#0f1219] border border-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c12] text-zinc-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* 1. Header */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-zinc-400 mt-1">Manage your project configuration and profile details.</p>
        </div>

        {/* WhatsApp Link Utility (Preserved but styled) */}
        <div className="bg-[#0f1219] border border-white/5 rounded-xl p-6 relative overflow-hidden">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                <Smartphone className="w-5 h-5 text-[#22c55e]" />
                Link WhatsApp
              </h3>
              <p className="text-zinc-400 text-sm mb-4">
                Created a project via WhatsApp? Link your number to sync projects.
              </p>
              <div className="flex gap-3 max-w-md">
                <Input
                  value={linkPhone}
                  onChange={(e) => setLinkPhone(e.target.value)}
                  placeholder="+234..."
                  className="bg-[#161b27] border-white/10 text-white focus:ring-[#22c55e] focus:border-[#22c55e]"
                />
                <Button 
                  onClick={handleLinkWhatsApp} 
                  disabled={linkingWhatsApp}
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
                >
                  {linkingWhatsApp ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link"}
                </Button>
              </div>
              {linkSuccess && <p className="text-[#22c55e] text-sm mt-2">✅ Number linked successfully.</p>}
              {linkError && <p className="text-red-500 text-sm mt-2">{linkError}</p>}
            </div>
          </div>
        </div>

        {/* Main Settings Form */}
        <form onSubmit={handleSave} className="space-y-8">
          
          {/* 2. Project Settings Card */}
          <div className="bg-[#0f1219] border border-white/5 rounded-xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
              <div className="p-2 rounded-lg bg-[#00bcd4]/10 text-[#00bcd4]">
                <Settings className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Project Settings</h2>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Project Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="bg-[#161b27] border-white/10 text-white focus:ring-[#00bcd4] focus:border-[#00bcd4]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Budget (UGX)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-zinc-500">UGX</span>
                    <Input
                      type="number"
                      value={form.budget}
                      onChange={(e) => setForm({ ...form, budget: e.target.value })}
                      className="bg-[#161b27] border-white/10 text-white focus:ring-[#00bcd4] focus:border-[#00bcd4] pl-12"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-400">Description</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-md bg-[#161b27] border border-white/10 text-white focus:ring-2 focus:ring-[#00bcd4] focus:border-transparent p-3 text-sm placeholder:text-zinc-600 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="bg-[#161b27] border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161b27] border-white/10 text-white">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Channel Type</Label>
                  <Select value={form.channel_type} onValueChange={(v) => setForm({ ...form, channel_type: v })}>
                    <SelectTrigger className="bg-[#161b27] border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161b27] border-white/10 text-white">
                      <SelectItem value="direct">Direct Message</SelectItem>
                      <SelectItem value="group">Group Chat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold min-w-[120px]"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>

          {/* 3. Profile Settings Card */}
          <div className="bg-[#0f1219] border border-white/5 rounded-xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
              <div className="p-2 rounded-lg bg-[#00bcd4]/10 text-[#00bcd4]">
                <User className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Profile Settings</h2>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Full Name</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="bg-[#161b27] border-white/10 text-white focus:ring-[#00bcd4] focus:border-[#00bcd4]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">WhatsApp Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                    <Input
                      value={form.whatsapp_number}
                      onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                      className="bg-[#161b27] border-white/10 text-white focus:ring-[#00bcd4] focus:border-[#00bcd4] pl-10"
                    />
                  </div>
                </div>
              </div>

               <div className="space-y-2">
                  <Label className="text-zinc-400">Language</Label>
                  <div className="bg-[#161b27] border border-white/10 rounded-md p-2">
                    <LanguageSwitcher variant="full" />
                  </div>
                </div>

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="bg-[#00bcd4] hover:bg-[#00acc1] text-black font-bold min-w-[120px]"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Profile
                </Button>
              </div>
            </div>
          </div>
        </form>

        {/* 4. Danger Zone */}
        <div className="bg-[#0f1219] border border-red-500/20 rounded-xl p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50" />
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
             <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
            <h2 className="text-xl font-bold text-red-500">Danger Zone</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Change Password */}
            <div className="space-y-4">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Lock className="w-4 h-4 text-zinc-400" />
                Change Password
              </h3>
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="Current Password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="bg-[#161b27] border-white/10 text-white focus:ring-red-500 focus:border-red-500"
                />
                <Input
                  type="password"
                  placeholder="New Password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="bg-[#161b27] border-white/10 text-white focus:ring-red-500 focus:border-red-500"
                />
                <Input
                  type="password"
                  placeholder="Confirm New Password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="bg-[#161b27] border-white/10 text-white focus:ring-red-500 focus:border-red-500"
                />
              </div>
              
              {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
              {passwordSuccess && <p className="text-[#22c55e] text-sm">Password updated successfully.</p>}
              
              <Button 
                onClick={handlePasswordChange}
                disabled={changingPassword}
                variant="destructive"
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "Change Password"}
              </Button>
            </div>

            {/* Complete Project */}
             <div className="space-y-4">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-zinc-400" />
                Complete Project
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Marking this project as completed will archive it. You won't be able to make further changes unless reactivated.
              </p>
              
              <AlertDialog open={confirmCompletedOpen} onOpenChange={setConfirmCompletedOpen}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || form.status === "completed"}
                  onClick={() => setConfirmCompletedOpen(true)}
                  className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40"
                >
                  Mark as Completed
                </Button>
                <AlertDialogContent className="bg-[#1e2235] border border-white/10 text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Mark project as completed?</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      This action will archive the project. You can reactivate it later from the project settings if needed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        setConfirmCompletedOpen(false);
                        handleMarkCompleted();
                      }}
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      Mark Completed
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
