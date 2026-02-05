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
}

export function TrendsQuickInsightsSection({ data }: { data?: TrendsQuickInsightsSectionData }) {
  const { progressTrend = [], costBurnTrend = [], dailyBurnRate = 0, insights = [] } = data || {};
  
  // Transform data for charts (convert date to name for display)
  const progressChartData = progressTrend.map((point, index) => ({
    name: `Day ${index + 1}`,
    value: point.value,
  }));

  const costChartData = costBurnTrend.map((point, index) => ({
    name: `Day ${index + 1}`,
    value: point.value,
  }));

  // Default insights if none provided
  const defaultInsights: Insight[] = [
    { id: '1', text: 'Top delay cause: Weather (3 days lost)' },
    { id: '2', text: 'Most used material: Cement (450 bags)' },
    { id: '3', text: 'Foundation phase completed ahead of schedule' },
    { id: '4', text: 'Resolution rate: 85% of issues closed' },
  ];

  const displayInsights = insights.length > 0 ? insights : defaultInsights;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-heading">Quick Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress trend sparkline */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium font-body">Progress Trend (30 days)</span>
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
            <p className="text-xs text-muted-foreground">No progress data available</p>
          )}
        </div>

        {/* Cost burn rate */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium font-body">Daily Cost Burn</span>
            <span className="text-sm text-muted-foreground font-body">
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
            <p className="text-xs text-muted-foreground">No cost data available</p>
          )}
        </div>

        {/* Key insights bullets */}
        <div className="space-y-2 pt-4 border-t">
          <h5 className="font-semibold text-sm font-heading">This Week's Highlights</h5>
          
          <div className="space-y-2">
            {displayInsights.map((insight, index) => {
              const icons = [AlertCircle, Package, TrendingUp, CheckCircle];
              const colors = ['text-alert-red', 'text-ocean-pine', 'text-success-green', 'text-success-green'];
              const Icon = icons[index % icons.length];
              const color = colors[index % colors.length];
              
              return (
                <div key={insight.id} className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 ${color} mt-0.5 flex-shrink-0`} />
                  <p className="text-sm font-body">{insight.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

