import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, 
  TrendingUp, 
  CheckSquare, 
  PieChart, 
  Camera,
  Plus,
  Receipt,
  Book,
  Truck,
  Flag
} from "lucide-react";
import type { Project, Task, Update } from "@shared/schema";
import type { ProjectAnalytics } from "@/types";

interface OverviewDashboardProps {
  project: Project;
  onTabChange?: (tab: string) => void;
  userRole?: 'owner' | 'manager';
}

export default function OverviewDashboard({ project, onTabChange, userRole = 'owner' }: OverviewDashboardProps) {
  const { data: analytics } = useQuery<ProjectAnalytics>({
    queryKey: ['/api/projects', project.id, 'analytics'],
    enabled: !!project.id,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/projects', project.id, 'tasks'],
    enabled: !!project.id,
  });

  const { data: recentUpdates = [] } = useQuery<Update[]>({
    queryKey: ['/api/projects', project.id, 'updates'],
    enabled: !!project.id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getProgressPercentage = () => {
    if (!analytics) return 0;
    return Math.min(100, Math.round((analytics.totalSpent / analytics.totalBudget) * 100));
  };

  const activeTasks = tasks.filter(t => !t.completed);
  const overdueTasks = tasks.filter(t => 
    !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
  );

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Project Budget
            </CardTitle>
            <DollarSign className="h-4 w-4 text-brand" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {analytics ? formatCurrency(analytics.totalBudget) : 'Loading...'}
            </div>
            <p className="text-xs text-green-400 mt-1">
              <TrendingUp className="inline w-3 h-3 mr-1" />
              On track
            </p>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spent
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-brand-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {analytics ? formatCurrency(analytics.totalSpent) : 'Loading...'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {getProgressPercentage()}% of budget
            </p>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Tasks
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {activeTasks.length}
            </div>
            {overdueTasks.length > 0 && (
              <p className="text-xs text-yellow-400 mt-1">
                ⚠️ {overdueTasks.length} overdue
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Progress
            </CardTitle>
            <PieChart className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {getProgressPercentage()}%
            </div>
            <Progress value={getProgressPercentage()} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card className="card-glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-white">Recent Activity</CardTitle>
                <Button variant="link" className="text-brand hover:text-brand/80 p-0">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentUpdates.slice(0, 3).map((update) => (
                  <div key={update.id} className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="w-8 h-8 bg-brand/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-hammer text-brand text-sm"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{update.taskTitle}</p>
                      <p className="text-xs text-muted-foreground mt-1">{update.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {update.createdAt ? new Date(update.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                        <span className={`status-pill status-${update.category.toLowerCase() === 'materials' ? 'low' : update.category.toLowerCase() === 'labor' ? 'medium' : 'high'}`}>
                          {update.category}: {formatCurrency(parseFloat(update.amount))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {recentUpdates.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent activity. Start by logging an expense or updating a task.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-white">
                {userRole === 'manager' ? 'Manager Quick Actions' : 'Owner Dashboard Actions'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userRole === 'owner' && (
                  <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-300">
                      <strong>Owner Mode:</strong> Create tasks, set budgets, delegate work, and monitor overall project progress.
                    </p>
                  </div>
                )}
                {userRole === 'manager' && (
                  <div className="bg-green-600/10 border border-green-600/20 rounded-lg p-3 mb-4">
                    <p className="text-sm text-green-300">
                      <strong>Manager Mode:</strong> View assigned tasks, update progress, log daily expenses, and record site activities.
                    </p>
                  </div>
                )}
                {userRole === 'owner' && (
                  <Button 
                    onClick={() => onTabChange?.('tasks')}
                    className="w-full justify-start bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300 min-h-[44px]"
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-3" />
                    Create & Delegate Task
                  </Button>
                )}
                
                <Button 
                  onClick={() => onTabChange?.('financials')}
                  className="w-full justify-start bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 text-blue-300 min-h-[44px]"
                  variant="outline"
                >
                  <Receipt className="w-4 h-4 mr-3" />
                  {userRole === 'owner' ? 'View Financial Reports' : 'Log Daily Expenses'}
                </Button>
                
                <Button 
                  onClick={() => onTabChange?.('ledgers')}
                  className="w-full justify-start bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/40 text-purple-300 min-h-[44px]"
                  variant="outline"
                >
                  <Book className="w-4 h-4 mr-3" />
                  {userRole === 'owner' ? 'Review Daily Reports' : 'Submit Daily Report'}
                </Button>
                
                <Button 
                  onClick={() => onTabChange?.('suppliers')}
                  className="w-full justify-start bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/40 text-yellow-300 min-h-[44px]"
                  variant="outline"
                >
                  <Truck className="w-4 h-4 mr-3" />
                  Supplier Purchase
                </Button>

                <Button 
                  onClick={() => onTabChange?.('milestones')}
                  className="w-full justify-start bg-red-600/20 hover:bg-red-600/30 border border-red-600/40 text-red-300 min-h-[44px]"
                  variant="outline"
                >
                  <Flag className="w-4 h-4 mr-3" />
                  Mark Milestone
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Photos Section */}
      <Card className="card-glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-white">Recent Site Photos</CardTitle>
            <Button 
              onClick={() => alert('Photo upload feature coming soon! Please use your camera to take photos and upload them manually for now.')}
              className="bg-brand/20 hover:bg-brand/30 border border-brand/40 text-brand min-h-[44px]"
            >
              <Camera className="w-4 h-4 mr-2" />
              Add Photos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Placeholder for photos - will be populated when photo upload is implemented */}
            <div className="text-center p-8 border-2 border-dashed border-white/20 rounded-xl col-span-full">
              <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No photos uploaded yet</p>
              <p className="text-sm text-muted-foreground">Upload site photos to track visual progress</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
