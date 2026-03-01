"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PlaceholderView } from "@/components/layout/PlaceholderView";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DashboardPage() {
  const { t } = useLanguage();
  return (
    <AppLayout>
      <PlaceholderView title={t("dashboard.title")} />
    </AppLayout>
  );
}
