import React from 'react';
import { KpiCard } from './ui/KpiCard';
import { CircularProgress } from './ui/circular-progress';
import { AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

interface ProjectHealthSummaryProps {
  overallProgress?: number;
  onTimeStatus?: { isDelayed: boolean; daysDelayed: number; scheduleStatus?: 'On Track' | 'At Risk' | 'Delayed' | 'Slight Delay' | 'Behind Schedule'; daysAhead?: number };
  budgetHealth?: { percent: number; remaining: number; };
  activeIssues?: { total: number; critical: number; };
  schedule?: { status: 'On Track' | 'At Risk' | 'Delayed' | 'Slight Delay' | 'Behind Schedule'; daysAhead?: number; daysBehind?: number };
  onActiveIssuesClick?: () => void;
  progressDescription?: string;
}

export function ProjectHealthSummary({ data }: { data?: ProjectHealthSummaryProps }) {
  const { overallProgress = 0, onTimeStatus, schedule, budgetHealth, activeIssues, onActiveIssuesClick, progressDescription: progressDescriptionProp } = data || {};

  const scheduleStatus = schedule?.status ?? onTimeStatus?.scheduleStatus ?? (onTimeStatus?.isDelayed ? 'Delayed' : 'On Track');
  const daysDelayed = schedule?.daysBehind ?? onTimeStatus?.daysDelayed ?? 0;
  const daysAhead = schedule?.daysAhead ?? onTimeStatus?.daysAhead ?? 0;
  const budgetUsedPercent = budgetHealth?.percent ?? 0;
  const remaining = budgetHealth?.remaining ?? 0;
  const openIssues = activeIssues?.total ?? 0;
  const criticalIssues = activeIssues?.critical ?? 0;

  const progressDescription = progressDescriptionProp ?? (overallProgress === 0 ? 'Just getting started! 🏗️' : 'Complete');
  const scheduleDescription = scheduleStatus === 'On Track' && daysAhead > 0
    ? `${daysAhead} days ahead`
    : scheduleStatus === 'On Track'
      ? undefined
      : daysDelayed > 0
        ? `by ${daysDelayed} days`
        : undefined;
  const scheduleIndicator = scheduleStatus === 'On Track' ? 'success' : scheduleStatus === 'At Risk' || scheduleStatus === 'Slight Delay' ? 'warning' : 'error';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Overall Progress */}
      <KpiCard
        title="Overall Progress"
        value={overallProgress}
        unit="%"
        description={progressDescription}
        statusIndicator="success"
        progressValue={overallProgress}
        progressBarColor="bg-white/20"
        className="bg-gradient-to-br from-fresh-fern to-ocean-pine text-white"
        children={<CircularProgress value={overallProgress} color="white" size={96} strokeWidth={8} />}
      />

      {/* Card 2: On-Time Status */}
      <KpiCard
        title="Schedule Status"
        value={scheduleStatus}
        statusIndicator={scheduleIndicator}
        description={scheduleDescription}
        icon={scheduleStatus === 'On Track' ? CheckCircle : AlertCircle}
      />

      {/* Card 3: Budget Health */}
      <KpiCard
        title="Budget Health"
        value={budgetUsedPercent}
        unit="%"
        description={
          budgetUsedPercent === 0 ? (
            <>
              <span className="block">UGX {remaining.toLocaleString()} remaining</span>
              <span className="block text-xs mt-1 opacity-90">No expenses logged yet. Send &quot;Bought cement for 200,000&quot; via WhatsApp to start tracking.</span>
            </>
          ) : (
            `UGX ${remaining.toLocaleString()} remaining`
          )
        }
        statusIndicator={budgetUsedPercent > 100 ? 'error' : budgetUsedPercent > 80 ? 'error' : budgetUsedPercent > 60 ? 'warning' : 'success'}
        alertMessage={budgetUsedPercent > 100 ? 'Over budget!' : undefined}
        alertVariant="destructive"
      />

      {/* Card 4: Active Issues */}
      <KpiCard
        title="Active Issues"
        value={openIssues}
        description={
          openIssues === 0 ? (
            <span className="text-success-green font-medium font-body">All clear ✅</span>
          ) : (
            <span className="text-alert-red font-medium font-body">{criticalIssues} critical</span>
          )
        }
        icon={ArrowRight}
        onClick={onActiveIssuesClick ?? (() => document.getElementById('issues-section')?.scrollIntoView({ behavior: 'smooth' }))}
      />
    </div>
  );
}

