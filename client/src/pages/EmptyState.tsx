import React, { useState } from 'react';
import {
  Building2,
  Wallet,
  ClipboardList,
  Package,
  AlertCircle,
  Image,
  TrendingUp,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

const features = [
  {
    icon: Wallet,
    title: 'Budget Tracking',
    description: 'Monitor expenses and stay within budget',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: ClipboardList,
    title: 'Task Management',
    description: 'Track progress and manage milestones',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Package,
    title: 'Materials Inventory',
    description: 'Keep track of materials and supplies',
    color: 'from-orange-500 to-amber-500',
  },
  {
    icon: AlertCircle,
    title: 'Issue Tracking',
    description: 'Log and resolve project issues quickly',
    color: 'from-red-500 to-rose-500',
  },
  {
    icon: Image,
    title: 'Site Documentation',
    description: 'Capture progress with photos and reports',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: TrendingUp,
    title: 'Real-time Insights',
    description: 'Get instant analytics and reports',
    color: 'from-indigo-500 to-blue-500',
  },
];

export default function EmptyState() {
  const [showDialog, setShowDialog] = useState(false);
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    budget: '',
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Success!",
        description: "Project created successfully",
      });
      setFormData({ name: '', description: '', budget: '' });
      setShowDialog(false);
      // Redirect to dashboard - will now show full dashboard instead of empty state
      setTimeout(() => {
        setLocation('/dashboard');
      }, 500);
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

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#93C54E] to-[#218598] mb-6 shadow-lg">
          <Building2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to JengaTrack
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Your all-in-one construction project management platform. Track budgets, manage tasks, and monitor progress in real-time.
        </p>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#93C54E] to-[#218598] text-white hover:shadow-lg transition-all text-lg px-8 py-6"
              onClick={(e) => {
                e.preventDefault();
                setShowDialog(true);
              }}
            >
              Create Your First Project
              <ArrowRight className="ml-2 h-5 w-5" />
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
                  className="flex-1 bg-gradient-to-r from-[#93C54E] to-[#218598]"
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

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {features.map((feature) => (
          <Card key={feature.title} className="border-2 hover:shadow-xl transition-all cursor-pointer group">
            <CardContent className="p-6">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats Preview */}
      <Card className="bg-gradient-to-br from-gray-50 to-white border-2">
        <CardContent className="p-8">
          <h2 className="text-2xl font-bold text-center mb-8">
            Everything You Need to Manage Your Construction Project
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#218598] mb-2">100%</div>
              <div className="text-sm text-gray-600">Budget Control</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#93C54E] mb-2">24/7</div>
              <div className="text-sm text-gray-600">Access Anywhere</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#218598] mb-2">Real-time</div>
              <div className="text-sm text-gray-600">Updates</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#93C54E] mb-2">Simple</div>
              <div className="text-sm text-gray-600">WhatsApp Logs</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Integration Highlight */}
      <div className="mt-12 text-center bg-gradient-to-r from-[#93C54E]/10 to-[#218598]/10 rounded-2xl p-8 border-2 border-[#93C54E]/20">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold mb-4">📱 WhatsApp Integration</h3>
          <p className="text-gray-700 mb-6">
            Log expenses and tasks directly from WhatsApp! Simply send a message like:
          </p>
          <div className="bg-white rounded-lg p-4 shadow-sm border-2 inline-block">
            <p className="font-mono text-sm text-gray-800">
              "Spent 500,000 UGX on cement bags"
            </p>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            No app switching required - manage your project from WhatsApp!
          </p>
        </div>
      </div>
    </div>
  );
}

