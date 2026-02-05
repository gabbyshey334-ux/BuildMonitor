import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from 'recharts';

interface CategoryBudget {
  category: string;
  amount: number;
  percentage: number;
  colorHex: string;
}

interface CategoryComparison {
  category: string;
  budgeted: number;
  actual: number;
  variance: number; // Percentage variance
  colorHex: string;
}

interface DailyCost {
  date: string; // YYYY-MM-DD
  amount: number;
}

interface BudgetCostsSectionData {
  breakdown: CategoryBudget[];
  vsActual: CategoryComparison[];
  cumulativeCosts: DailyCost[];
  totalBudget: number;
  spent: number;
  remaining: number;
  spentPercent: number;
}

export function BudgetCostsSection({ data }: { data?: BudgetCostsSectionData }) {
  const { breakdown = [], vsActual = [], cumulativeCosts = [], totalBudget = 0, spent = 0, remaining = 0, spentPercent = 0 } = data || {};

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Budget & Costs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Key Budget Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-ash-gray rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Total Budget</p>
              <p className="text-2xl font-bold">UGX {totalBudget.toLocaleString()}</p>
            </div>
            <div className="text-center p-4 bg-ash-gray rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Spent</p>
              <p className="text-2xl font-bold">
                UGX {spent.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({spentPercent}%)
                </span>
              </p>
            </div>
            <div className="text-center p-4 bg-ash-gray rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Remaining</p>
              <p className="text-2xl font-bold text-success-green">
                UGX {remaining.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Budget Breakdown and Comparison Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget Breakdown - Pie Chart */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Budget Breakdown</h3>
              {breakdown.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={breakdown}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry: any) => `${entry.category}: ${entry.percentage}%`}
                      >
                        {breakdown.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.colorHex || '#A0AEC0'}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Category legend with amounts */}
                  <div className="space-y-2 mt-4">
                    {breakdown.map((category) => (
                      <div key={category.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: category.colorHex || '#A0AEC0'
                            }}
                          />
                          <span className="text-sm">{category.category}</span>
                        </div>
                        <span className="font-medium">
                          UGX {category.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">No budget data available</p>
              )}
            </div>

            {/* Budget vs Actual - Bar Chart */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Budget vs. Actual Spend</h3>
              {vsActual.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={vsActual}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="budgeted" fill="#218598" name="Budgeted" />
                      <Bar dataKey="actual" fill="#93C54E" name="Actual" />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Over/Under alerts */}
                  <div className="space-y-2 mt-4">
                    {vsActual
                      .filter((cat) => cat.variance > 10)
                      .map((cat) => (
                        <Alert key={cat.category} className="bg-alert-red/10 border-alert-red/20">
                          <AlertCircle className="h-4 w-4 text-alert-red" />
                          <div>
                            <p className="text-sm font-medium text-alert-red">
                              {cat.category} over by {cat.variance}%
                            </p>
                          </div>
                        </Alert>
                      ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">No comparison data available</p>
              )}
            </div>
          </div>

          {/* Cumulative costs trend line */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Cumulative Costs Over Time</h3>
            {cumulativeCosts.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={cumulativeCosts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#218598"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No cost trend data available</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

