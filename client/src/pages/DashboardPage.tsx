import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Building2, 
  TrendingUp, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getToken } from '@/lib/authToken';
// Import the full dashboard component
import FullDashboard from '@/components/dashboard-new/DashboardPage';

interface Project {
  id: string;
  name: string;
  description?: string;
  budgetAmount: number;
  spent?: number;
  currency?: string;
  status: 'active' | 'completed' | 'on_hold';
  createdAt: string;
  updatedAt: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    budget: '',
  });
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extract project ID from URL query parameter - reactive to URL changes
  // Must be declared after all hooks to follow Rules of Hooks
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Update selectedProjectId when URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('project');
    setSelectedProjectId(projectId);
  }, [location]); // React to location changes

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/projects', {
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      console.log('[Dashboard] Fetched projects:', data.projects?.length || 0);
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; budget: string }) => {
      const projectData = {
        name: data.name.trim(),
        description: data.description.trim() || '',
        budgetAmount: data.budget || '0',
        status: 'active',
      };

      const response = await apiRequest('POST', '/api/projects', projectData);
      const result = await response.json();
      return result;
    },
    onSuccess: async (result: any) => {
      console.log('[Dashboard] Project created successfully:', result);
      
      // Reset form and close dialog first
      setFormData({ name: '', description: '', budget: '' });
      setShowDialog(false);
      
      // Show success toast
      toast({
        title: "Success!",
        description: "Project created successfully",
      });
      
      // Immediately refresh the projects list
      // The server should have the new project by now
      try {
        await fetchProjects();
        console.log('[Dashboard] Projects list refreshed after creation');
      } catch (err) {
        console.error('[Dashboard] Error refreshing projects:', err);
        // If immediate refresh fails, try again after a short delay
        setTimeout(async () => {
          await fetchProjects();
        }, 500);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Unable to Create Project",
        description: error.message || "Failed to create project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.budget) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createProjectMutation.mutate(formData);
  };

  const getProgressPercentage = (spent: number, budget: number) => {
    if (budget === 0) return 0;
    return Math.min((spent / budget) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'text-alert-red';
    if (percentage >= 70) return 'text-warning-yellow';
    return 'text-success-green';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success-green" />;
      case 'on_hold':
        return <Clock className="w-4 h-4 text-warning-yellow" />;
      default:
        return <TrendingUp className="w-4 h-4 text-ocean-pine" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      active: { label: 'Active', className: 'bg-success-green/10 text-success-green border-success-green/20' },
      completed: { label: 'Completed', className: 'bg-ocean-pine/10 text-ocean-pine border-ocean-pine/20' },
      on_hold: { label: 'On Hold', className: 'bg-warning-yellow/10 text-warning-yellow border-warning-yellow/20' }
    };

    const variant = variants[status] || variants.active;
    return (
      <Badge variant="outline" className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string = 'UGX') => {
    return new Intl.NumberFormat('en-UG', {
      style: 'decimal',
      minimumFractionDigits: 0
    }).format(amount) + ' ' + currency;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // If a project is selected in URL, show the full dashboard
  // This check must come AFTER all hooks are declared (Rules of Hooks)
  if (selectedProjectId) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => setLocation('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>
        {/* Full Dashboard */}
        <FullDashboard projectId={selectedProjectId} />
      </div>
    );
  }

  // Loading State
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-fresh-fern mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your projects...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Card className="max-w-md border-red-200 bg-red-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="w-6 h-6" />
              <p className="font-semibold">Error Loading Projects</p>
            </div>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button 
              onClick={fetchProjects} 
              variant="outline"
              className="w-full"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty State
  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-heading font-bold mb-2">No Projects Yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first construction project to get started
            </p>
            <Button 
              onClick={() => setShowDialog(true)}
              className="bg-fresh-fern hover:bg-fresh-fern/90 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Project
            </Button>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl">Create New Project</DialogTitle>
                  <DialogDescription>
                    Get started by setting up your construction project details
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="name">Project Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Residential Building - Kampala"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of your project..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="budget">Total Budget (UGX)</Label>
                    <Input
                      id="budget"
                      type="number"
                      placeholder="e.g., 50000000"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowDialog(false)}
                      className="flex-1"
                      disabled={createProjectMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-fresh-fern hover:bg-fresh-fern/90 text-white"
                      disabled={createProjectMutation.isPending}
                    >
                      {createProjectMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Project'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Projects List
  return (
    <div className="p-6 space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-graphite">Projects</h1>
          <p className="text-muted-foreground mt-1">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'} in total
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button 
              className="bg-fresh-fern hover:bg-fresh-fern/90 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create New Project</DialogTitle>
              <DialogDescription>
                Get started by setting up your construction project details
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Residential Building - Kampala"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of your project..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="budget">Total Budget (UGX)</Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="e.g., 50000000"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  required
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  className="flex-1"
                  disabled={createProjectMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-fresh-fern hover:bg-fresh-fern/90 text-white"
                  disabled={createProjectMutation.isPending}
                >
                  {createProjectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const spent = project.spent || 0;
          const budget = project.budgetAmount || 0;
          const progressPercentage = getProgressPercentage(spent, budget);
          const remaining = budget - spent;

          return (
            <Card 
              key={project.id}
              className="hover:shadow-lg transition-all cursor-pointer border-ash-gray/30 hover:border-ocean-pine/50"
              onClick={() => setLocation(`/dashboard?project=${project.id}`)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-ocean-pine/10 rounded-lg">
                      <Building2 className="w-5 h-5 text-ocean-pine" />
                    </div>
                    {getStatusIcon(project.status)}
                  </div>
                  {getStatusBadge(project.status)}
                </div>
                <CardTitle className="text-lg font-heading text-graphite">
                  {project.name}
                </CardTitle>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {project.description}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Budget Overview */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Budget</span>
                    <span className="font-semibold text-graphite">
                      {formatCurrency(budget, project.currency || 'UGX')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Spent</span>
                    <span className={`font-semibold ${getProgressColor(progressPercentage)}`}>
                      {formatCurrency(spent, project.currency || 'UGX')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-semibold text-graphite">
                      {formatCurrency(remaining, project.currency || 'UGX')}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                {budget > 0 && (
                  <div className="space-y-2">
                    <Progress 
                      value={progressPercentage} 
                      className="h-2"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">
                        {progressPercentage.toFixed(1)}% used
                      </p>
                      {progressPercentage >= 90 && (
                        <Badge variant="destructive" className="text-xs">
                          Over Budget!
                        </Badge>
                      )}
                      {progressPercentage >= 70 && progressPercentage < 90 && (
                        <Badge variant="outline" className="text-xs bg-warning-yellow/10 text-warning-yellow border-warning-yellow/20">
                          Near Limit
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer with Date */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-3 border-t border-ash-gray/30">
                  <Calendar className="w-3 h-3" />
                  <span>Created {formatDate(project.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
