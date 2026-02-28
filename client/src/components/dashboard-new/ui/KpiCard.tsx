import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CircularProgress } from './circular-progress';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, ArrowRight, TrendingUp, TrendingDown, MinusCircle } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  unit?: string;
  description?: string;
  statusIndicator?: 'success' | 'warning' | 'error' | 'none';
  progressValue?: number; // For progress bars/circles
  progressBarColor?: string; // Tailwind class, e.g., 'bg-fresh-fern/20'
  alertMessage?: string;
  alertVariant?: 'default' | 'destructive';
  icon?: React.ElementType; // Lucide icon component
  trendValue?: number; // For sparkline trends
  trendDirection?: 'up' | 'down' | 'neutral';
  className?: string; // Additional classNames for the card
  children?: React.ReactNode; // For custom content inside the card
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  unit,
  description,
  statusIndicator = 'none',
  progressValue,
  progressBarColor,
  alertMessage,
  alertVariant = 'default',
  icon: Icon,
  trendValue,
  trendDirection = 'neutral',
  className,
  children,
  onClick,
}) => {
  const statusColors = {
    success: '#48BB78',
    warning: '#ECC94B',
    error: '#E53E3E',
    none: 'currentColor',
  };

  const trendIcons = {
    up: <TrendingUp className="w-4 h-4 text-success-green" />,
    down: <TrendingDown className="w-4 h-4 text-alert-red" />,
    neutral: <MinusCircle className="w-4 h-4 text-[#94A3B8]" />,
  };

  return (
    <Card className={`p-6 dark:bg-[#1e2235] dark:border-zinc-700 bg-white border-slate-200 ${className || ''}`} onClick={onClick}>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm dark:text-[#CBD5E1] text-slate-600 font-body">{title}</h3>
          {Icon && <Icon className="w-5 h-5 dark:text-[#94A3B8] text-slate-500" />}
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-4xl font-bold font-heading dark:text-white text-slate-800" style={{ color: statusIndicator !== 'none' ? statusColors[statusIndicator] : undefined }}>
            {value}
            {unit && <span className="text-xl ml-1 dark:text-white/90 text-slate-700">{unit}</span>}
          </p>
          {trendValue !== undefined && (
            <div className="flex items-center gap-1 text-sm font-body">
              {trendIcons[trendDirection]}
              <span style={{ color: trendDirection === 'up' ? statusColors.success : trendDirection === 'down' ? statusColors.error : undefined }}>
                {trendValue > 0 ? '+' : ''}{trendValue}%
              </span>
            </div>
          )}
        </div>
        {description && <p className="text-sm dark:text-[#CBD5E1] text-slate-600 mt-1 font-body">{description}</p>}

        {progressValue !== undefined && progressValue >= 0 && (
          <Progress value={progressValue} className={`mt-4 h-2 ${progressBarColor || 'bg-fresh-fern/20'}`} />
        )}

        {children}

        {alertMessage && (
          <Alert variant={alertVariant} className="mt-3 bg-alert-red/10">
            <AlertCircle className="h-4 w-4 text-alert-red" />
            <AlertTitle className="text-alert-red font-body">{alertMessage}</AlertTitle>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

