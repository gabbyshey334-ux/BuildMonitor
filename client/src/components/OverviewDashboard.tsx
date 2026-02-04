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
  Edit,
  Trash2,
  Wallet,
  PieChart as PieChartIcon,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AddExpenseDialog from "@/components/AddExpenseDialog";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from "recharts";
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

// Brand colors for charts
const BRAND_COLORS = [
  '#93C54E', // Fresh Fern
  '#218598', // Ocean Pine
  '#B4D68C', // Moss Green
  '#6EC1C0', // Aqua Breeze
  '#2F3332', // Graphite
];

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
    queryKey: ['/api/expenses', { limit: 20, offset: 0 }],
  });

  // Fetch active tasks
  const { data: tasksData, isLoading: tasksLoading } = useQuery<{
    success: boolean;
    tasks: Task[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  }>({
    queryKey: ['/api/tasks', { status: 'pending,in_progress,completed', limit: 50 }],
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
    if (percentUsed >= 80) return 'text-red-500';
    if (percentUsed >= 50) return 'text-fresh-fern';
    return 'text-fresh-fern';
  };

  const getRemainingColor = (percentUsed: number) => {
    if (percentUsed >= 80) return 'bg-red-600/20 border-red-600/40 text-red-500';
    if (percentUsed >= 50) return 'bg-fresh-fern/20 border-fresh-fern/40 text-fresh-fern';
    return 'bg-fresh-fern/20 border-fresh-fern/40 text-fresh-fern';
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'bg-ocean-pine/15 text-ocean-pine border-ocean-pine/30',
      medium: 'bg-fresh-fern/20 text-fresh-fern border-fresh-fern/40',
      high: 'bg-red-600/20 text-red-500 border-red-600/40',
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const activeTasks = tasksData?.tasks || [];
  const recentExpenses = expensesData?.expenses || [];
  const dashboardSummary = summary?.summary;

  // Prepare category breakdown data for pie chart
  const categoryBreakdown = recentExpenses.reduce((acc, expense) => {
    const categoryName = expense.categoryName || 'Uncategorized';
    const amount = Number(expense.amount);
    if (acc[categoryName]) {
      acc[categoryName].value += amount;
    } else {
      acc[categoryName] = {
        name: categoryName,
        value: amount,
        color: expense.categoryColor || BRAND_COLORS[Object.keys(acc).length % BRAND_COLORS.length],
      };
    }
    return acc;
  }, {} as Record<string, { name: string; value: number; color: string }>);

  const categoryData = Object.values(categoryBreakdown).slice(0, 5);

  // Prepare spending over time data (last 7 days)
  const spendingOverTime = recentExpenses.reduce((acc, expense) => {
    const date = new Date(expense.expenseDate).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });
    const amount = Number(expense.amount);
    if (acc[date]) {
      acc[date] += amount;
    } else {
      acc[date] = amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const spendingData = Object.entries(spendingOverTime)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);

  // Group tasks by status for Kanban
  const tasksByStatus = {
    pending: activeTasks.filter(t => t.status === 'pending'),
    in_progress: activeTasks.filter(t => t.status === 'in_progress'),
    completed: activeTasks.filter(t => t.status === 'completed'),
  };

  return (
    <div className="space-y-6">
      {/* Budget Overview Section - Enhanced Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Budget Card */}
        <Card className="bg-gradient-to-br from-white to-ash-gray/30 border-l-4 border-fresh-fern shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-heading font-semibold text-graphite">
              Total Budget
            </CardTitle>
            <div className="p-2 bg-fresh-fern/10 rounded-lg">
              <Wallet className="h-5 w-5 text-ocean-pine" />
            </div>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-10 w-40" />
            ) : dashboardSummary ? (
              <>
                <div className="text-3xl font-heading font-bold text-ocean-pine mb-1">
                  {formatCurrency(dashboardSummary.budget)}
            </div>
                <p className="text-xs text-muted-foreground mt-2 font-body">
                  {dashboardSummary.projectName}
            </p>
              </>
            ) : (
              <div className="text-sm text-red-500 font-body">Error loading</div>
            )}
          </CardContent>
        </Card>

        {/* Total Spent Card */}
        <Card className="bg-gradient-to-br from-white to-ash-gray/30 border-l-4 border-ocean-pine shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-heading font-semibold text-graphite">
              Total Spent
            </CardTitle>
            <div className="p-2 bg-ocean-pine/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-fresh-fern" />
            </div>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-10 w-40" />
            ) : dashboardSummary ? (
              <>
                <div className="text-3xl font-heading font-bold text-fresh-fern mb-1">
                  {formatCurrency(dashboardSummary.totalSpent)}
            </div>
                <p className={`text-xs mt-2 font-body font-medium ${getBudgetColor(dashboardSummary.percentUsed)}`}>
                  {dashboardSummary.percentUsed.toFixed(1)}% of budget used
            </p>
              </>
            ) : (
              <div className="text-sm text-red-500 font-body">Error loading</div>
            )}
          </CardContent>
        </Card>

        {/* Remaining Balance Card */}
        <Card className="bg-gradient-to-br from-ash-gray/40 to-white border-l-4 border-graphite shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-heading font-semibold text-graphite">
              Remaining Balance
            </CardTitle>
            <div className="p-2 bg-graphite/10 rounded-lg">
            {dashboardSummary && dashboardSummary.percentUsed >= 80 ? (
                <TrendingDown className="h-5 w-5 text-red-500" />
            ) : (
                <DollarSign className="h-5 w-5 text-fresh-fern" />
            )}
            </div>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-10 w-40" />
            ) : dashboardSummary ? (
              <>
                <div className={`text-3xl font-heading font-bold mb-1 ${getBudgetColor(dashboardSummary.percentUsed)}`}>
                  {formatCurrency(dashboardSummary.remaining)}
            </div>
                {dashboardSummary.percentUsed >= 90 ? (
                  <p className="text-xs text-red-500 mt-2 flex items-center gap-1 font-body">
                    <AlertCircle className="w-3 h-3" />
                    Critical: Over budget!
                  </p>
                ) : dashboardSummary.percentUsed >= 80 ? (
                  <p className="text-xs text-fresh-fern mt-2 flex items-center gap-1 font-body">
                    <AlertCircle className="w-3 h-3" />
                    Warning: Near limit
                  </p>
                ) : (
                  <p className="text-xs text-fresh-fern mt-2 font-body">
                    Budget on track
                  </p>
                )}
              </>
            ) : (
              <div className="text-sm text-red-500 font-body">Error loading</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress Bar */}
      {!summaryLoading && dashboardSummary && (
        <Card className="bg-white shadow-lg border border-border">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-heading font-semibold text-graphite">Budget Progress</span>
                <span className={`text-lg font-heading font-bold ${getBudgetColor(dashboardSummary.percentUsed)}`}>
                  {dashboardSummary.percentUsed.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={Math.min(100, dashboardSummary.percentUsed)} 
                className="h-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-body">
                <span>{dashboardSummary.expenseCount} expenses recorded</span>
                <span>{dashboardSummary.taskCount} active tasks</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Section */}
      {categoryData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown Pie Chart */}
          <Card className="bg-white shadow-lg border border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-ocean-pine" />
                <CardTitle className="text-lg font-heading font-bold text-graphite">Expense by Category</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || BRAND_COLORS[index % BRAND_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Spending Over Time Line Chart */}
          {spendingData.length > 0 && (
            <Card className="bg-white shadow-lg border border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-ocean-pine" />
                  <CardTitle className="text-lg font-heading font-bold text-graphite">Spending Over Time</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={spendingData}>
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => `UGX ${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#218598" 
                      strokeWidth={3}
                      dot={{ fill: '#93C54E', r: 5 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Expenses - Professional Table */}
        <div className="lg:col-span-2">
          <Card className="bg-white shadow-lg border border-border">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-heading font-bold text-graphite">Recent Expenses</CardTitle>
                <Button 
                  variant="link" 
                  className="text-ocean-pine hover:text-ocean-pine/80 p-0 font-heading font-semibold"
                  onClick={() => onTabChange?.('financials')}
                >
                  View All <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {expensesLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentExpenses.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-ash-gray/30 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-graphite uppercase tracking-wider">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-graphite uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-heading font-semibold text-graphite uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-right text-xs font-heading font-semibold text-graphite uppercase tracking-wider">Amount</th>
                        <th className="px-4 py-3 text-center text-xs font-heading font-semibold text-graphite uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {recentExpenses.map((expense, index) => (
                        <tr 
                      key={expense.id} 
                          className={`hover:bg-ash-gray/20 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-ash-gray/5'}`}
                    >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-body font-medium text-graphite">
                            {expense.description}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize mt-1">
                              {expense.source}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {expense.categoryName ? (
                            <Badge 
                                className="text-xs px-2 py-1 font-body" 
                              style={{ 
                                  backgroundColor: `${expense.categoryColor || '#218598'}15`,
                                  color: expense.categoryColor || '#218598',
                                  borderColor: `${expense.categoryColor || '#218598'}40`,
                                  borderWidth: '1px',
                              }}
                            >
                              <Tag className="w-3 h-3 mr-1" />
                              {expense.categoryName}
                            </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Uncategorized</span>
                          )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-body text-graphite">
                          {formatDate(expense.expenseDate)}
                      </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <div className="text-sm font-heading font-bold text-ocean-pine">
                          {formatCurrency(Number(expense.amount))}
                      </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-ocean-pine/10"
                                onClick={() => {
                                  toast({
                                    title: "Edit Expense",
                                    description: "Edit functionality coming soon",
                                  });
                                }}
                              >
                                <Edit className="h-4 w-4 text-ocean-pine" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-red-500/10"
                                onClick={() => {
                                  toast({
                                    title: "Delete Expense",
                                    description: "Delete functionality coming soon",
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                    </div>
                          </td>
                        </tr>
                  ))}
                    </tbody>
                  </table>
                  </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-30 text-ocean-pine" />
                  <p className="text-lg font-heading font-semibold mb-2">No expenses recorded yet</p>
                  <p className="text-sm font-body mb-4">
                    Start tracking by sending a WhatsApp message or adding manually
                  </p>
                  <Button
                    onClick={() => setIsAddExpenseOpen(true)}
                    className="bg-ocean-pine hover:bg-ocean-pine/90 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Expense
                  </Button>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Kanban Tasks & Quick Actions */}
        <div className="space-y-6">
          
          {/* Kanban Task Board */}
          <Card className="bg-white shadow-lg border border-border">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-heading font-bold text-graphite">Tasks</CardTitle>
                <Button 
                  variant="link" 
                  className="text-ocean-pine hover:text-ocean-pine/80 p-0 font-heading font-semibold"
                  onClick={() => onTabChange?.('tasks')}
                >
                  View All <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {tasksLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Pending Column */}
                  <div className="space-y-2">
                    <div className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Pending ({tasksByStatus.pending.length})
                    </div>
                    {tasksByStatus.pending.slice(0, 3).map((task) => (
                    <div 
                      key={task.id} 
                        className="p-3 bg-ash-gray/20 border border-border rounded-lg hover:shadow-md transition-all"
                    >
                        <p className="text-sm font-body font-medium text-graphite mb-2 line-clamp-2">
                          {task.title}
                        </p>
                        <div className="flex items-center justify-between">
                        <Badge className={`text-xs ${getPriorityBadge(task.priority || 'medium')}`}>
                          {task.priority || 'medium'}
                        </Badge>
                          {task.dueDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" />
                              {formatDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {tasksByStatus.pending.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">No pending tasks</div>
                    )}
                  </div>

                  {/* In Progress Column */}
                  <div className="space-y-2">
                    <div className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      In Progress ({tasksByStatus.in_progress.length})
                    </div>
                    {tasksByStatus.in_progress.slice(0, 3).map((task) => (
                      <div 
                        key={task.id}
                        className="p-3 bg-ocean-pine/5 border border-ocean-pine/20 rounded-lg hover:shadow-md transition-all"
                      >
                        <p className="text-sm font-body font-medium text-graphite mb-2 line-clamp-2">
                          {task.title}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge className={`text-xs ${getPriorityBadge(task.priority || 'medium')}`}>
                            {task.priority || 'medium'}
                          </Badge>
                        {task.dueDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                        </div>
                      </div>
                    ))}
                    {tasksByStatus.in_progress.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">No in-progress tasks</div>
                    )}
                  </div>

                  {/* Completed Column */}
                  <div className="space-y-2">
                    <div className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Completed ({tasksByStatus.completed.length})
                    </div>
                    {tasksByStatus.completed.slice(0, 3).map((task) => (
                      <div 
                        key={task.id}
                        className="p-3 bg-fresh-fern/5 border border-fresh-fern/20 rounded-lg hover:shadow-md transition-all opacity-75"
                      >
                        <p className="text-sm font-body font-medium text-graphite mb-2 line-clamp-2 line-through">
                          {task.title}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge className="text-xs bg-fresh-fern/20 text-fresh-fern border-fresh-fern/40">
                            Done
                        </Badge>
                          {task.dueDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" />
                              {formatDate(task.dueDate)}
                            </span>
                          )}
                      </div>
                    </div>
                  ))}
                    {tasksByStatus.completed.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">No completed tasks</div>
                    )}
                </div>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Quick Actions - WhatsApp Info */}
          <Card className="bg-gradient-to-br from-fresh-fern/10 to-ocean-pine/10 border-fresh-fern/30 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-heading font-bold text-graphite flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-ocean-pine" />
                WhatsApp Quick Log
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white/80 border border-ocean-pine/20 rounded-lg p-4 shadow-sm">
                <p className="text-sm text-graphite mb-2 font-body font-medium">
                  📱 Your WhatsApp Number:
                </p>
                <p className="text-base font-mono text-ocean-pine font-semibold">
                  {user?.whatsappNumber || 'Not set'}
                    </p>
                  </div>
              
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-body">Send a message like:</p>
                <div className="bg-white/60 rounded-lg p-3 space-y-1.5 border border-border">
                  <p className="text-xs text-fresh-fern font-body">💬 "spent 50000 on cement"</p>
                  <p className="text-xs text-ocean-pine font-body">💬 "task: inspect foundation"</p>
                  <p className="text-xs text-ocean-pine font-body">💬 "set budget 2000000"</p>
                </div>
              </div>
                
                <Button 
                onClick={() => setIsAddExpenseOpen(true)}
                className="w-full bg-ocean-pine hover:bg-ocean-pine/90 text-white font-heading font-semibold shadow-md hover:shadow-lg transition-all min-h-[44px]"
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
