import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Update } from "@shared/schema";
import type { ProjectAnalytics } from "@/types";

interface FinancialDashboardProps {
  projectId: string;
  userRole?: 'owner' | 'manager';
}

export default function FinancialDashboard({ projectId, userRole = 'owner' }: FinancialDashboardProps) {
  const { data: analytics } = useQuery<ProjectAnalytics>({
    queryKey: ['/api/projects', projectId, 'analytics'],
    enabled: !!projectId,
  });

  const { data: recentUpdates = [] } = useQuery<Update[]>({
    queryKey: ['/api/projects', projectId, 'updates'],
    enabled: !!projectId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'materials':
        return 'bg-brand';
      case 'labor':
        return 'bg-blue-500';
      case 'transport':
        return 'bg-green-500';
      case 'food':
        return 'bg-yellow-500';
      default:
        return 'bg-purple-500';
    }
  };

  const getTransactionIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'materials':
        return 'fas fa-hammer';
      case 'labor':
        return 'fas fa-users';
      case 'transport':
        return 'fas fa-truck';
      case 'food':
        return 'fas fa-utensils';
      default:
        return 'fas fa-receipt';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Financial Management</h2>
          <p className="text-sm text-muted-foreground">
            {userRole === 'owner' ? 'Monitor project finances and review expense reports' : 'Log daily expenses and track site spending'}
          </p>
        </div>
        {userRole === 'manager' && (
          <Button className="btn-brand">
            <Plus className="w-4 h-4 mr-2" />
            Log Expense
          </Button>
        )}
        {userRole === 'owner' && (
          <Button variant="outline" className="bg-blue-600/20 hover:bg-blue-600/30 border-blue-600/40 text-blue-300">
            <Plus className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        )}
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {analytics ? formatCurrency(analytics.totalBudget) : 'Loading...'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Allocated across all categories</p>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Cash Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {analytics ? formatCurrency(analytics.totalCashSpent) : 'Loading...'}
            </div>
            <p className="text-sm text-green-400 mt-1">
              <i className="fas fa-arrow-down mr-1"></i>
              {analytics ? Math.round((analytics.totalCashSpent / analytics.totalBudget) * 100) : 0}% of budget
            </p>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Supplier Credit Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {analytics ? formatCurrency(analytics.totalSupplierSpent) : 'Loading...'}
            </div>
            <p className="text-sm text-blue-400 mt-1">
              <i className="fas fa-handshake mr-1"></i>Via suppliers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expense Breakdown & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Categories */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-white">Expense Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics && Object.entries(analytics.categoryBreakdown).map(([category, amount]) => {
                const percentage = analytics.totalSpent > 0 ? (amount / analytics.totalSpent) * 100 : 0;
                
                return (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded ${getCategoryColor(category)}`}></div>
                      <span className="text-white">{category}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">{formatCurrency(amount)}</div>
                      <div className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
              
              {(!analytics || Object.keys(analytics.categoryBreakdown).length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No expense data available yet. Log your first expense to see the breakdown.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-white">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentUpdates.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${transaction.paymentMethod === 'cash' ? 'bg-red-600/20' : 'bg-green-500/20'} rounded-full flex items-center justify-center`}>
                      <i className={`${getTransactionIcon(transaction.category)} ${transaction.paymentMethod === 'cash' ? 'text-red-400' : 'text-green-400'} text-sm`}></i>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{transaction.taskTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.category} • {transaction.paymentMethod === 'cash' ? 'Cash' : 'Supplier Credit'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">
                      {formatCurrency(parseFloat(transaction.amount))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
              
              {recentUpdates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions yet. Log your first expense to see transaction history.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
