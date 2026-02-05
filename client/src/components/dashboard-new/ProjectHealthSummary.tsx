import React from 'react';
import { KpiCard } from './ui/KpiCard';
import { CircularProgress } from './ui/circular-progress';
import { AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

interface ProjectHealthSummaryProps {
  overallProgress?: number;
  onTimeStatus?: { isDelayed: boolean; daysDelayed: number; };
  budgetHealth?: { percent: number; remaining: number; };
  activeIssues?: { total: number; critical: number; };
}

export function ProjectHealthSummary({ data }: { data?: ProjectHealthSummaryProps }) {
  const { overallProgress = 0, onTimeStatus, budgetHealth, activeIssues } = data || {};

  const daysDelayed = onTimeStatus?.daysDelayed || 0;
  const budgetUsedPercent = budgetHealth?.percent || 0;
  const remaining = budgetHealth?.remaining || 0;
  const openIssues = activeIssues?.total || 0;
  const criticalIssues = activeIssues?.critical || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Overall Progress */}
      <KpiCard
        title="Overall Progress"
        value={overallProgress}
        unit="%"
        description="Complete"
        statusIndicator="success"
        progressValue={overallProgress}
        progressBarColor="bg-white/20"
        className="bg-gradient-to-br from-fresh-fern to-ocean-pine text-white"
        children={<CircularProgress value={overallProgress} color="white" size={96} strokeWidth={8} />}
      />

      {/* Card 2: On-Time Status */}
      <KpiCard
        title="Schedule Status"
        value={daysDelayed > 0 ? "Delayed" : "On Track"}
        statusIndicator={daysDelayed > 0 ? "error" : "success"}
        description={daysDelayed > 0 ? `by ${daysDelayed} days` : undefined}
        icon={daysDelayed > 0 ? AlertCircle : CheckCircle}
      />

      {/* Card 3: Budget Health */}
      <KpiCard
        title="Budget Health"
        value={budgetUsedPercent}
        unit="%"
        description={`UGX ${remaining.toLocaleString()} remaining`}
        statusIndicator={budgetUsedPercent > 90 ? "error" : "success"}
        alertMessage={budgetUsedPercent > 100 ? `Over Budget by ${budgetUsedPercent - 100}%` : undefined}
        alertVariant="destructive"
      />

      {/* Card 4: Active Issues */}
      <KpiCard
        title="Active Issues"
        value={openIssues}
        description={<span className="text-alert-red font-medium font-body">{criticalIssues} critical</span>}
        icon={ArrowRight}
        onClick={() => console.log('View all issues')}
      />
    </div>
  );
}

