import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Flag, Calendar, TrendingUp } from "lucide-react";
import { insertMilestoneSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Milestone } from "@shared/schema";
import { z } from "zod";

interface MilestoneManagementProps {
  projectId: string;
}

const milestoneFormSchema = insertMilestoneSchema.extend({
  targetDate: z.string().min(1, "Target date is required"),
}).omit({ progress: true });

const progressFormSchema = z.object({
  milestoneId: z.string().min(1, "Please select a milestone"),
  progress: z.string().min(1, "Progress is required"),
  completed: z.enum(['yes', 'no']),
});

export default function MilestoneManagement({ projectId }: MilestoneManagementProps) {
  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: milestones = [], isLoading } = useQuery<Milestone[]>({
    queryKey: ['/api/projects', projectId, 'milestones'],
    enabled: !!projectId,
  });

  const createMilestoneMutation = useMutation({
    mutationFn: async (data: z.infer<typeof milestoneFormSchema>) => {
      const milestoneData = {
        ...data,
        projectId,
        targetDate: new Date(data.targetDate),
        progress: 0,
      };
      await apiRequest('POST', '/api/milestones', milestoneData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'milestones'] });
      toast({
        title: "Success",
        description: "Milestone created successfully",
      });
      setIsMilestoneDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create milestone",
        variant: "destructive",
      });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (data: z.infer<typeof progressFormSchema>) => {
      const updates = {
        progress: parseInt(data.progress),
        completed: data.completed === 'yes',
      };
      await apiRequest('PUT', `/api/milestones/${data.milestoneId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'milestones'] });
      toast({
        title: "Success",
        description: "Progress updated successfully",
      });
      setIsProgressDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update progress",
        variant: "destructive",
      });
    },
  });

  const milestoneForm = useForm<z.infer<typeof milestoneFormSchema>>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: {
      projectId,
      title: '',
      targetDate: '',
    },
  });

  const progressForm = useForm<z.infer<typeof progressFormSchema>>({
    resolver: zodResolver(progressFormSchema),
    defaultValues: {
      milestoneId: '',
      progress: '',
      completed: 'no',
    },
  });

  const onMilestoneSubmit = (data: z.infer<typeof milestoneFormSchema>) => {
    createMilestoneMutation.mutate(data);
  };

  const onProgressSubmit = (data: z.infer<typeof progressFormSchema>) => {
    updateProgressMutation.mutate(data);
  };

  const getDaysRemaining = (targetDate: string) => {
    const target = new Date(targetDate);
    const now = new Date();
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (milestone: Milestone) => {
    if (milestone.completed) return 'text-green-400';
    
    const daysRemaining = getDaysRemaining(milestone.targetDate.toString());
    if (daysRemaining < 0) return 'text-red-400';
    if (daysRemaining <= 7) return 'text-yellow-400';
    return 'text-blue-400';
  };

  const getStatusText = (milestone: Milestone) => {
    if (milestone.completed) return '✅ Completed';
    
    const daysRemaining = getDaysRemaining(milestone.targetDate.toString());
    if (daysRemaining < 0) return `Overdue by ${Math.abs(daysRemaining)} days`;
    if (daysRemaining === 0) return 'Due today';
    return `${daysRemaining} days left`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Project Milestones</h2>
        <div className="flex gap-3">
          <Dialog open={isMilestoneDialogOpen} onOpenChange={setIsMilestoneDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300">
                <Plus className="w-4 h-4 mr-2" />
                Add Milestone
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card-bg border border-white/10 max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Milestone</DialogTitle>
              </DialogHeader>
              <Form {...milestoneForm}>
                <form onSubmit={milestoneForm.handleSubmit(onMilestoneSubmit)} className="space-y-4">
                  <FormField
                    control={milestoneForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Milestone Title</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="bg-dark-bg border-white/20 text-white h-12"
                            placeholder="e.g., Foundation Complete"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={milestoneForm.control}
                      name="targetDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Target Date</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="date"
                              className="bg-dark-bg border-white/20 text-white h-12"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    

                  </div>

                  <div className="flex justify-end gap-3">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setIsMilestoneDialogOpen(false)}
                      className="btn-secondary h-12"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="btn-brand h-12"
                      disabled={createMilestoneMutation.isPending}
                    >
                      {createMilestoneMutation.isPending ? 'Adding...' : 'Add Milestone'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isProgressDialogOpen} onOpenChange={setIsProgressDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 text-blue-300">
                <TrendingUp className="w-4 h-4 mr-2" />
                Update Progress
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card-bg border border-white/10 max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">Update Milestone Progress</DialogTitle>
              </DialogHeader>
              <Form {...progressForm}>
                <form onSubmit={progressForm.handleSubmit(onProgressSubmit)} className="space-y-4">
                  <FormField
                    control={progressForm.control}
                    name="milestoneId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Milestone</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-dark-bg border-white/20 text-white h-12">
                              <SelectValue placeholder="Select milestone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card-bg border-white/20">
                            {milestones.filter(m => !m.completed).map((milestone) => (
                              <SelectItem key={milestone.id} value={milestone.id}>
                                {milestone.title} ({milestone.progress}%)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={progressForm.control}
                      name="progress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Progress (%)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number"
                              min="0"
                              max="100"
                              className="bg-dark-bg border-white/20 text-white h-12"
                              placeholder="0"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={progressForm.control}
                      name="completed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Completed?</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-dark-bg border-white/20 text-white h-12">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-card-bg border-white/20">
                              <SelectItem value="no">No</SelectItem>
                              <SelectItem value="yes">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setIsProgressDialogOpen(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="btn-brand"
                      disabled={updateProgressMutation.isPending}
                    >
                      {updateProgressMutation.isPending ? 'Updating...' : 'Update Progress'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Milestone Timeline */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <div className="text-center py-12">
              <Flag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No milestones created yet. Add your first milestone to track project progress.
              </p>
              <Button 
                onClick={() => setIsMilestoneDialogOpen(true)}
                className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Milestone
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {milestones
                .slice()
                .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())
                .map((milestone, index) => (
                  <div key={milestone.id} className="flex items-start gap-4">
                    {/* Timeline indicator */}
                    <div className="flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full ${milestone.completed ? 'bg-green-400' : milestone.progress > 0 ? 'bg-brand' : 'bg-white/30'}`}></div>
                      {index < milestones.length - 1 && (
                        <div className="w-0.5 h-16 bg-white/20 mt-2"></div>
                      )}
                    </div>
                    
                    {/* Milestone content */}
                    <div className="flex-1 pb-8">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-white">{milestone.title}</h3>
                        <span className={`text-sm font-medium ${getStatusColor(milestone)}`}>
                          {getStatusText(milestone)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>Target: {new Date(milestone.targetDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Progress value={milestone.progress} className="h-2" />
                        </div>
                        <span className="text-sm text-muted-foreground min-w-12">
                          {milestone.progress}%
                        </span>
                        {!milestone.completed && (
                          <Button
                            onClick={() => {
                              progressForm.setValue('milestoneId', milestone.id);
                              progressForm.setValue('progress', milestone.progress.toString());
                              setIsProgressDialogOpen(true);
                            }}
                            size="sm"
                            className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 text-blue-300 text-xs px-3 py-1"
                          >
                            Update
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestone Summary Table */}
      {milestones.length > 0 && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-white">Milestone Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Milestone</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Target Date</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Progress</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {milestones.map((milestone) => {
                    const daysRemaining = getDaysRemaining(milestone.targetDate.toString());
                    const isOverdue = !milestone.completed && daysRemaining < 0;
                    
                    return (
                      <tr key={milestone.id}>
                        <td className="py-4 px-2 text-sm text-white font-medium">
                          {milestone.title}
                        </td>
                        <td className="py-4 px-2 text-sm text-white">
                          {new Date(milestone.targetDate).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-white/10 rounded-full h-1.5">
                              <div 
                                className="bg-gradient-to-r from-brand to-brand-2 h-1.5 rounded-full transition-all"
                                style={{ width: `${milestone.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-white">{milestone.progress}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          {isOverdue ? (
                            <span className="status-pill bg-red-600/20 border-red-600/40 text-red-300">
                              Overdue {Math.abs(daysRemaining)}d
                            </span>
                          ) : milestone.completed ? (
                            <span className="status-pill bg-green-600/20 border-green-600/40 text-green-300">
                              Completed
                            </span>
                          ) : (
                            <span className="status-pill bg-blue-600/20 border-blue-600/40 text-blue-300">
                              {daysRemaining >= 0 ? `${daysRemaining}d left` : 'On track'}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-2 text-center">
                          {milestone.completed && <span className="text-green-400 text-lg">✅</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
