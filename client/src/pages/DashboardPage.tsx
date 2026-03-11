"use client";

import React from "react";
import { PlaceholderView } from "@/components/layout/PlaceholderView";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DashboardPage() {
  const { t } = useLanguage();
  return (
    <PlaceholderView title={t("dashboard.title")} />
  );
}
