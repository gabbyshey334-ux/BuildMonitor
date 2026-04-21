import React from "react";
import DashboardPage from "@/components/dashboard-new/DashboardPage";
import { JengaTrackLogo } from "@/components/ui/Logo";
import { usePageTitle } from "@/hooks/usePageTitle";

const DemoPage = () => {
  usePageTitle("Demo");

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      {/* Demo-mode brand header */}
      <div className="w-full border-b border-border/60 bg-jenga-surface/70 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <JengaTrackLogo variant="full" size="lg" linkTo="/dashboard" />
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-jenga-gold/40 bg-jenga-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-jenga-gold shrink-0"
            role="status"
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-jenga-gold animate-pulse"
              aria-hidden
            />
            Demo Mode
          </span>
        </div>
      </div>

      <DashboardPage />
    </div>
  );
};

export default DemoPage;
