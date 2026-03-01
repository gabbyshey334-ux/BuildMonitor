"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export interface NewProjectFormData {
  name: string;
  type: "residential" | "commercial" | "other";
  location: string;
  startDate: string;
  totalBudget: string;
  whatsappNumber: string;
}

const DEFAULT_FORM: NewProjectFormData = {
  name: "",
  type: "residential",
  location: "",
  startDate: "",
  totalBudget: "",
  whatsappNumber: "",
};

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewProjectFormData) => void | Promise<void>;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export function NewProjectModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  errorMessage = null,
}: NewProjectModalProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<NewProjectFormData>(DEFAULT_FORM);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    setForm(DEFAULT_FORM);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setForm(DEFAULT_FORM);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{t("projects.modalTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-zinc-300">{t("projects.projectName")}</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Sunset Villa"
              className="mt-1 bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
              required
            />
          </div>
          <div>
            <Label htmlFor="type" className="text-zinc-300">{t("projects.projectType")}</Label>
            <Select
              value={form.type}
              onValueChange={(v: NewProjectFormData["type"]) => setForm((p) => ({ ...p, type: v }))}
            >
              <SelectTrigger className="mt-1 bg-zinc-800 border-zinc-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-600">
                <SelectItem value="residential">{t("projects.residential")}</SelectItem>
                <SelectItem value="commercial">{t("projects.commercial")}</SelectItem>
                <SelectItem value="other">{t("projects.other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="location" className="text-zinc-300">{t("settings.location")}</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              placeholder={t("projects.locationPlaceholder")}
              className="mt-1 bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
            />
          </div>
          <div>
            <Label htmlFor="startDate" className="text-zinc-300">{t("projects.startDate")}</Label>
            <Input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              className="mt-1 bg-zinc-800 border-zinc-600 text-white"
            />
          </div>
          <div>
            <Label htmlFor="totalBudget" className="text-zinc-300">{t("projects.totalBudgetUgx")}</Label>
            <Input
              id="totalBudget"
              type="text"
              inputMode="numeric"
              value={form.totalBudget}
              onChange={(e) => setForm((p) => ({ ...p, totalBudget: e.target.value }))}
              placeholder="e.g. 30,000,000 or 30M"
              className="mt-1 bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
            />
            <p className="text-xs text-zinc-500 mt-1">
              e.g. 30,000,000 or 30M for 30 million UGX
            </p>
          </div>
          <div>
            <Label htmlFor="whatsapp" className="text-zinc-300">{t("projects.whatsappLink")}</Label>
            <Input
              id="whatsapp"
              value={form.whatsappNumber}
              onChange={(e) => setForm((p) => ({ ...p, whatsappNumber: e.target.value }))}
              placeholder="+256 ..."
              className="mt-1 bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
            />
          </div>
          {errorMessage && (
            <p className="text-sm text-red-400">{errorMessage}</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] text-white hover:opacity-90"
            >
              {isLoading ? t("projects.creating") : t("projects.createProject")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
