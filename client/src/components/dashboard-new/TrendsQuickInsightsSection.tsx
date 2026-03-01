import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, AlertCircle, Package, CheckCircle } from 'lucide-react';

interface DataPoint {
  date: string;
  value: number;
}

interface Insight {
  id: string;
  text: string;
}

interface TrendsQuickInsightsSectionData {
  progressTrend: DataPoint[];
  costBurnTrend: DataPoint[];
  dailyBurnRate: number;
  insights: Insight[];
  topDelayCause?: string | null;
  mostUsedMaterial?: string | null;
  recentHighlight?: string | null;
}

export function TrendsQuickInsightsSection({ data }: { data?: TrendsQuickInsightsSectionData }) {
  const {
    progressTrend = [],
    costBurnTrend = [],
    dailyBurnRate = 0,
    insights = [],
    topDelayCause,
    mostUsedMaterial,
    recentHighlight,
  } = data || {};

  // Build display insights from API or fallback empty-state messages
  const displayInsights: Insight[] =
    insights.length > 0
      ? insights
      : [
          { id: '1', text: topDelayCause ? `Top delay cause: ${topDelayCause}` : 'No delays recorded' },
          { id: '2', text: mostUsedMaterial ? `Most used material: ${mostUsedMaterial}` : 'No materials logged yet' },
          { id: '3', text: recentHighlight || 'No updates yet' },
        ].filter((i) => i.text);
  const hasAnyHighlight = Boolean(topDelayCause || mostUsedMaterial || recentHighlight || insights.length > 0);
  const emptyInsight: Insight[] = [{ id: '0', text: "Insights will appear after a few days of updates." }];
  const finalInsights = hasAnyHighlight ? displayInsights : emptyInsight;

  const progressChartData = progressTrend.map((point, index) => ({
    name: `Day ${index + 1}`,
    value: point.value,
  }));
  const costChartData = costBurnTrend.map((point, index) => ({
    name: `Day ${index + 1}`,
    value: point.value,
  }));

  return (
    <Card className="dark:bg-zinc-800/50 dark:border-zinc-700 bg-white border-slate-200">
      <CardHeader>
        <CardTitle className="text-lg font-heading dark:text-white text-slate-800 font-bold">Quick Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress trend sparkline */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium font-body dark:text-[#E2E8F0] text-slate-700">Progress Trend (30 days)</span>
            <TrendingUp className="w-4 h-4 text-success-green" />
          </div>
          {progressChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={60}>
              <LineChart data={progressChartData}>
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#93C54E" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs dark:text-[#94A3B8] text-slate-500">No progress data available</p>
          )}
        </div>

        {/* Cost burn rate */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium font-body dark:text-[#E2E8F0] text-slate-700">Daily Cost Burn</span>
            <span className="text-sm dark:text-[#CBD5E1] text-slate-600 font-body">
              {dailyBurnRate > 0 ? `UGX ${dailyBurnRate.toLocaleString()}/day` : 'N/A'}
            </span>
          </div>
          {costChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={60}>
              <LineChart data={costChartData}>
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#218598" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs dark:text-[#94A3B8] text-slate-500">No cost data available</p>
          )}
        </div>

        {/* Key insights bullets */}
        <div className="space-y-2 pt-4 dark:border-zinc-700 border-slate-200 border-t">
          <h5 className="font-semibold text-sm font-heading dark:text-white text-slate-800">This Week's Highlights</h5>
          
          <div className="space-y-2">
            {finalInsights.map((insight, index) => {
              const icons = [AlertCircle, Package, TrendingUp, CheckCircle];
              const colors = ['text-alert-red', 'text-ocean-pine', 'text-success-green', 'text-success-green'];
              const Icon = icons[index % icons.length];
              const color = colors[index % colors.length];
              
              return (
                <div key={insight.id} className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 ${color} mt-0.5 flex-shrink-0`} />
                  <p className="text-sm font-body dark:text-[#CBD5E1] text-slate-700">{insight.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

