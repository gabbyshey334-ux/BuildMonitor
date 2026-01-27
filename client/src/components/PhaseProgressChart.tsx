import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HardHat, Building2 } from "lucide-react";
import type { ConstructionPhase, HistoricalExpense } from "@shared/schema";

interface PhaseProgressChartProps {
  projectId: string;
}

export default function PhaseProgressChart({ projectId }: PhaseProgressChartProps) {
  // Fetch construction phases
  const { data: phases = [] } = useQuery<ConstructionPhase[]>({
    queryKey: ['/api/construction-phases'],
  });

  // Fetch historical expenses for phase analysis
  const { data: historicalExpenses = [] } = useQuery<HistoricalExpense[]>({
    queryKey: ['/api/projects', projectId, 'historical-expenses'],
    enabled: !!projectId,
  });

  // Calculate expenses by phase
  const getPhaseExpenses = () => {
    const phaseExpenses = new Map();
    
    phases.forEach(phase => {
      const expenses = historicalExpenses.filter(expense => expense.phaseId === phase.id);
      const totalAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
      phaseExpenses.set(phase.id, {
        ...phase,
        totalAmount,
        expenseCount: expenses.length,
      });
    });
    
    return Array.from(phaseExpenses.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  };

  const phaseData = getPhaseExpenses();
  const totalExpenses = phaseData.reduce((sum, phase) => sum + phase.totalAmount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getProgressPercentage = (phaseAmount: number) => {
    if (totalExpenses === 0) return 0;
    return Math.round((phaseAmount / totalExpenses) * 100);
  };

  return (
    <Card className="card-glass">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
          <HardHat className="w-5 h-5" />
          Construction Phase Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {phaseData.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No phase data available yet</p>
            <p className="text-sm text-muted-foreground">
              Start adding historical expenses to see construction progress by phase
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {phaseData.map((phase) => (
              <div key={phase.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: phase.color }}
                    />
                    <span className="text-sm font-medium text-white">{phase.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-white">
                      {formatCurrency(phase.totalAmount)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({phase.expenseCount} entries)
                    </span>
                  </div>
                </div>
                <Progress 
                  value={getProgressPercentage(phase.totalAmount)} 
                  className="h-2"
                  style={{
                    '--progress-foreground': phase.color,
                  } as React.CSSProperties}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{phase.description}</span>
                  <span>{getProgressPercentage(phase.totalAmount)}% of total</span>
                </div>
              </div>
            ))}
            
            {totalExpenses > 0 && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-white">Total Phase Expenses</span>
                  <span className="text-lg font-bold text-green-400">
                    {formatCurrency(totalExpenses)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}