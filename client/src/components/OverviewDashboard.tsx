import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  CheckSquare, 
  AlertCircle,
  MessageSquare,
  Plus,
  CalendarClock,
  Tag,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AddExpenseDialog from "@/components/AddExpenseDialog";
import type { Project, Task, Expense } from "@shared/schema";

interface OverviewDashboardProps {
  project: Project;
  onTabChange?: (tab: string) => void;
  userRole?: 'owner' | 'manager';
}

interface DashboardSummary {
  budget: number;
  totalSpent: number;
  remaining: number;
  percentUsed: number;
  expenseCount: number;
  taskCount: number;
  projectName: string;
  projectId: string;
}

interface ExpenseWithCategory extends Expense {
  categoryName: string | null;
  categoryColor: string | null;
}

export default function OverviewDashboard({ project, onTabChange, userRole = 'owner' }: OverviewDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // Fetch dashboard summary
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<{ success: boolean; summary: DashboardSummary }>({
    queryKey: ['/api/dashboard/summary'],
  });

  // Fetch recent expenses
  const { data: expensesData, isLoading: expensesLoading } = useQuery<{ 
    success: boolean; 
    expenses: ExpenseWithCategory[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  }>({
    queryKey: ['/api/expenses', { limit: 10, offset: 0 }],
  });

  // Fetch active tasks
  const { data: tasksData, isLoading: tasksLoading } = useQuery<{
    success: boolean;
    tasks: Task[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  }>({
    queryKey: ['/api/tasks', { status: 'pending,in_progress', limit: 5 }],
  });

  // Show error toast if summary fetch fails
  if (summaryError) {
    toast({
      title: "Error loading dashboard",
      description: "Failed to fetch dashboard summary. Please try again.",
      variant: "destructive",
    });
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-UG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const getBudgetColor = (percentUsed: number) => {
    if (percentUsed >= 80) return 'text-red-400';
    if (percentUsed >= 50) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getRemainingColor = (percentUsed: number) => {
    if (percentUsed >= 80) return 'bg-red-600/20 border-red-600/40 text-red-300';
    if (percentUsed >= 50) return 'bg-yellow-600/20 border-yellow-600/40 text-yellow-300';
    return 'bg-green-600/20 border-green-600/40 text-green-300';
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'bg-blue-600/20 text-blue-300 border-blue-600/40',
      medium: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/40',
      high: 'bg-red-600/20 text-red-300 border-red-600/40',
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const activeTasks = tasksData?.tasks || [];
  const recentExpenses = expensesData?.expenses || [];
  const dashboardSummary = summary?.summary;

  return (
    <div className="space-y-6">
      {/* Budget Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Budget Card */}
        <Card className="card-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Budget
            </CardTitle>
            <DollarSign className="h-4 w-4 text-brand" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : dashboardSummary ? (
              <>
            <div className="text-2xl font-bold text-white">
                  {formatCurrency(dashboardSummary.budget)}
            </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboardSummary.projectName}
            </p>
              </>
            ) : (
              <div className="text-sm text-red-400">Error loading</div>
            )}
          </CardContent>
        </Card>

        {/* Total Spent Card */}
        <Card className="card-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spent
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : dashboardSummary ? (
              <>
            <div className="text-2xl font-bold text-white">
                  {formatCurrency(dashboardSummary.totalSpent)}
            </div>
                <p className={`text-xs mt-1 ${getBudgetColor(dashboardSummary.percentUsed)}`}>
                  {dashboardSummary.percentUsed.toFixed(1)}% of budget used
            </p>
              </>
            ) : (
              <div className="text-sm text-red-400">Error loading</div>
            )}
          </CardContent>
        </Card>

        {/* Remaining Balance Card */}
        <Card className="card-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Remaining Balance
            </CardTitle>
            {dashboardSummary && dashboardSummary.percentUsed >= 80 ? (
              <TrendingDown className="h-4 w-4 text-red-400" />
            ) : (
              <DollarSign className="h-4 w-4 text-green-400" />
            )}
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : dashboardSummary ? (
              <>
                <div className={`text-2xl font-bold ${getBudgetColor(dashboardSummary.percentUsed)}`}>
                  {formatCurrency(dashboardSummary.remaining)}
            </div>
                {dashboardSummary.percentUsed >= 90 ? (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Critical: Over budget!
                  </p>
                ) : dashboardSummary.percentUsed >= 80 ? (
                  <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Warning: Near limit
                  </p>
                ) : (
                  <p className="text-xs text-green-400 mt-1">
                    Budget on track
                  </p>
                )}
              </>
            ) : (
              <div className="text-sm text-red-400">Error loading</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress Bar */}
      {!summaryLoading && dashboardSummary && (
        <Card className="card-glass">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Budget Progress</span>
                <span className={`font-medium ${getBudgetColor(dashboardSummary.percentUsed)}`}>
                  {dashboardSummary.percentUsed.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={Math.min(100, dashboardSummary.percentUsed)} 
                className="h-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{dashboardSummary.expenseCount} expenses recorded</span>
                <span>{dashboardSummary.taskCount} active tasks</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Expenses - 2 columns on large screens */}
        <div className="lg:col-span-2">
          <Card className="card-glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-white">Recent Expenses</CardTitle>
                <Button 
                  variant="link" 
                  className="text-brand hover:text-brand/80 p-0"
                  onClick={() => onTabChange?.('financials')}
                >
                  View All <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {expensesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : recentExpenses.length > 0 ? (
                <div className="space-y-3">
                  {recentExpenses.map((expense) => (
                    <div 
                      key={expense.id} 
                      className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white truncate">
                            {expense.description}
                          </p>
                          {expense.categoryName && (
                            <Badge 
                              className="text-xs px-2 py-0" 
                              style={{ 
                                backgroundColor: `${expense.categoryColor || '#3B82F6'}20`,
                                color: expense.categoryColor || '#3B82F6',
                                borderColor: `${expense.categoryColor || '#3B82F6'}40`
                              }}
                            >
                              <Tag className="w-3 h-3 mr-1" />
                              {expense.categoryName}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(expense.expenseDate)}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-bold text-white">
                          {formatCurrency(Number(expense.amount))}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {expense.source}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="mb-2">No expenses recorded yet</p>
                  <p className="text-sm">
                    Start tracking by sending a WhatsApp message or adding manually
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Active Tasks & Quick Actions */}
        <div className="space-y-6">
          
          {/* Active Tasks */}
          <Card className="card-glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-white">Active Tasks</CardTitle>
                <Button 
                  variant="link" 
                  className="text-brand hover:text-brand/80 p-0"
                  onClick={() => onTabChange?.('tasks')}
                >
                  View All <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : activeTasks.length > 0 ? (
                <div className="space-y-3">
                  {activeTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium text-white line-clamp-1">
                          {task.title}
                        </p>
                        <Badge className={`text-xs ${getPriorityBadge(task.priority || 'medium')}`}>
                          {task.priority || 'medium'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {task.dueDate && (
                          <span className="flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active tasks</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions - WhatsApp Info */}
          <Card className="card-glass bg-gradient-to-br from-green-600/10 to-blue-600/10 border-green-600/30">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-green-400" />
                WhatsApp Quick Log
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-sm text-green-300 mb-2 font-medium">
                  📱 Your WhatsApp Number:
                </p>
                <p className="text-base font-mono text-white">
                  {user?.whatsappNumber || 'Not set'}
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Send a message like:</p>
                <div className="bg-white/5 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs text-green-300">💬 "spent 50000 on cement"</p>
                  <p className="text-xs text-blue-300">💬 "task: inspect foundation"</p>
                  <p className="text-xs text-yellow-300">💬 "set budget 2000000"</p>
                </div>
              </div>

              <Button 
                onClick={() => setIsAddExpenseOpen(true)}
                className="w-full bg-brand/20 hover:bg-brand/30 border border-brand/40 text-brand"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Expense Manually
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Expense Dialog */}
      <AddExpenseDialog 
        open={isAddExpenseOpen} 
        onOpenChange={setIsAddExpenseOpen} 
      />
    </div>
  );
}
