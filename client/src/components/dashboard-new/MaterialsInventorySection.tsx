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

