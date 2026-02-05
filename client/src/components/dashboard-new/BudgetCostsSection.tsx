import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertCircle } from 'lucide-react';
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

