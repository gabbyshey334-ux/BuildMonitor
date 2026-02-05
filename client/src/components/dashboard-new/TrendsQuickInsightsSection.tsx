import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, AlertCircle, Package, CheckCircle } from 'lucide-react';

interface TrendsQuickInsightsSectionProps {
  // TODO: Define props for data
}

const progressTrend = [
  { name: 'Day 1', value: 60 },
  { name: 'Day 7', value: 62 },
  { name: 'Day 14', value: 65 },
  { name: 'Day 21', value: 67 },
  { name: 'Day 30', value: 68 },
];

const costBurnTrend = [
  { name: 'Day 1', value: 100000 },
  { name: 'Day 7', value: 120000 },
  { name: 'Day 14', value: 110000 },
  { name: 'Day 21', value: 130000 },
  { name: 'Day 30', value: 125000 },
];

const dailyBurnRate = 125000;

export function TrendsQuickInsightsSection(/* { data }: TrendsQuickInsightsSectionProps */) {
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
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={progressTrend}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#93C54E" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Cost burn rate */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium font-body">Daily Cost Burn</span>
            <span className="text-sm text-muted-foreground font-body">
              UGX {dailyBurnRate.toLocaleString()}/day
            </span>
          </div>
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={costBurnTrend}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#218598" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Key insights bullets */}
        <div className="space-y-2 pt-4 border-t">
          <h5 className="font-semibold text-sm font-heading">This Week's Highlights</h5>
          
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-alert-red mt-0.5 flex-shrink-0" />
              <p className="text-sm font-body">
                Top delay cause: <span className="font-medium">Weather (3 days lost)</span>
              </p>
            </div>
            
            <div className="flex items-start gap-2">
              <Package className="w-4 h-4 text-ocean-pine mt-0.5 flex-shrink-0" />
              <p className="text-sm font-body">
                Most used material: <span className="font-medium">Cement (450 bags)</span>
              </p>
            </div>
            
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-success-green mt-0.5 flex-shrink-0" />
              <p className="text-sm font-body">
                <span className="font-medium">Foundation phase</span> completed ahead of schedule
              </p>
            </div>
            
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-success-green mt-0.5 flex-shrink-0" />
              <p className="text-sm font-body">
                Resolution rate: <span className="font-medium">85% of issues closed</span>
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

