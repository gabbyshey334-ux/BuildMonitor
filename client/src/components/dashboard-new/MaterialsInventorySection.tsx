import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertCircle } from "@/components/ui/alert";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  totalStock: number;
  stockPercent: number;
  consumptionVsEstimate: number; // Percentage
}

interface MaterialUsage {
  material: string;
  used: number;
  remaining: number;
}

interface MaterialsInventorySectionData {
  items: InventoryItem[];
  usage: MaterialUsage[];
}

export function MaterialsInventorySection({ data }: { data?: MaterialsInventorySectionData }) {
  const { items = [], usage = [] } = data || {};

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Materials & Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Inventory Items List */}
          <section>
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Current Inventory</h3>
            <div className="space-y-3">
              {items.length > 0 ? (
                items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {item.currentStock} / {item.totalStock} {item.unit}
                        </span>
                      </div>
                      <Progress value={item.stockPercent} className="h-2 rounded-full" />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.stockPercent}% remaining
                        </span>
                        {item.consumptionVsEstimate > 0 && (
                          <Badge className="bg-alert-red/10 text-alert-red text-xs">
                            +{item.consumptionVsEstimate}% over estimate
                          </Badge>
                        )}
                        {item.consumptionVsEstimate < 0 && (
                          <Badge className="bg-success-green/10 text-success-green text-xs">
                            {item.consumptionVsEstimate}% under estimate
                          </Badge>
                        )}
                        {item.consumptionVsEstimate === 0 && (
                          <Badge className="bg-blue-500/10 text-blue-500 text-xs">
                            On track
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No inventory data available.</p>
              )}
            </div>
          </section>

          {/* Material Usage Chart */}
          <section>
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Material Usage</h3>
            {usage.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={usage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="material" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="used" fill="#218598" name="Used" />
                  <Bar dataKey="remaining" fill="#93C54E" name="Remaining" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No usage data available.</p>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

