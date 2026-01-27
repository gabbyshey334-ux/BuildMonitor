import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Calendar, MapPin, Camera, Check, CheckCircle, Clock } from "lucide-react";
import { insertTaskSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task } from "@shared/schema";
import type { Priority } from "@/types";
import { z } from "zod";

interface TaskManagementProps {
  projectId: string;
  userRole?: 'owner' | 'manager';
}

const taskFormSchema = insertTaskSchema.omit({ projectId: true }).extend({
  dueDate: z.string().optional(),
});

export default function TaskManagement({ projectId, userRole = 'owner' }: TaskManagementProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'overdue'>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['/api/projects', projectId, 'tasks'],
    enabled: !!projectId,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: {
      title: string;
      description?: string | null;
      priority?: string;
      location?: string | null;
      dueDate?: Date;
      projectId: string;
    }) => {
      await apiRequest('POST', '/api/tasks', taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      form.reset({
        title: '',
        description: '',
        priority: 'Medium',
        location: '',
        dueDate: '',
      });
      toast({
        title: "Success",
        description: "Task created successfully",
      });
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      console.error('Task creation error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      await apiRequest('PUT', `/api/tasks/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    },
  });

  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'Medium',
      location: '',
      dueDate: '',
    },
  });

  const onSubmit = (data: z.infer<typeof taskFormSchema>) => {
    console.log('Task form submitted with data:', data);
    console.log('Form validation errors:', form.formState.errors);
    console.log('Form is valid:', form.formState.isValid);
    console.log('Form state:', form.formState);
    
    // Check if form has validation errors
    if (Object.keys(form.formState.errors).length > 0) {
      console.error('Form has validation errors, not submitting');
      return;
    }
    
    const taskData = {
      ...data,
      projectId,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    };
    console.log('Sending task data to API:', taskData);
    createTaskMutation.mutate(taskData);
  };

  const toggleTaskComplete = (task: Task) => {
    updateTaskMutation.mutate({
      id: task.id,
      updates: { completed: !task.completed }
    });
  };

  const getFilteredTasks = () => {
    switch (filter) {
      case 'active':
        return tasks.filter(task => !task.completed);
      case 'overdue':
        return tasks.filter(task => 
          !task.completed && 
          task.dueDate && 
          new Date(task.dueDate) < new Date()
        );
      default:
        return tasks;
    }
  };

  const filteredTasks = getFilteredTasks();
  const activeTasks = tasks.filter(t => !t.completed);
  const overdueTasks = tasks.filter(t => 
    !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
  );

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'High':
      case 'Critical':
        return 'status-high';
      case 'Medium':
        return 'status-medium';
      case 'Low':
        return 'status-low';
      default:
        return 'status-medium';
    }
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
        <div>
          <h2 className="text-2xl font-bold text-white">Project Tasks</h2>
          <p className="text-sm text-muted-foreground">
            {userRole === 'owner' ? 'Create tasks and delegate to site managers' : 'View assigned tasks and update progress'}
          </p>
        </div>
        {userRole === 'owner' && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-brand">
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
          <DialogContent className="bg-card-bg border border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white">Create & Delegate Task</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Title</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ''}
                          className="bg-dark-bg border-white/20 text-white"
                          placeholder="Task title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value || ''}
                          className="bg-dark-bg border-white/20 text-white"
                          placeholder="Task description"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-dark-bg border-white/20 text-white">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card-bg border-white/20">
                            <SelectItem value="Low">Low</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Due Date</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={field.value || ''}
                            type="date"
                            className="bg-dark-bg border-white/20 text-white"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Location</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ''}
                          className="bg-dark-bg border-white/20 text-white"
                          placeholder="Task location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="btn-brand"
                    disabled={createTaskMutation.isPending}
                    onClick={(e) => {
                      console.log('Submit button clicked');
                      console.log('Form valid:', form.formState.isValid);
                      console.log('Form errors:', form.formState.errors);
                      // Don't prevent default, let form handle submission
                    }}
                  >
                    {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Task Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`nav-tab ${filter === 'all' ? 'nav-tab-active' : 'nav-tab-inactive'}`}
        >
          All Tasks 
          <span className="ml-2 px-2 py-1 bg-white/20 rounded-full text-xs">
            {tasks.length}
          </span>
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`nav-tab ${filter === 'active' ? 'nav-tab-active' : 'nav-tab-inactive'}`}
        >
          Active 
          <span className="ml-2 px-2 py-1 bg-green-600/20 rounded-full text-xs text-green-300">
            {activeTasks.length}
          </span>
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={`nav-tab ${filter === 'overdue' ? 'nav-tab-active' : 'nav-tab-inactive'}`}
        >
          Overdue 
          <span className="ml-2 px-2 py-1 bg-red-600/20 rounded-full text-xs text-red-300">
            {overdueTasks.length}
          </span>
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <Card className="card-glass">
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {filter === 'all' 
                  ? 'No tasks found. Create your first task to get started.'
                  : `No ${filter} tasks found.`
                }
              </p>
              {filter === 'all' && (
                <Button 
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="btn-brand"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Task
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => {
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
            
            return (
              <Card key={task.id} className="card-glass">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{task.title}</h3>
                        <span className={`status-pill ${getPriorityColor(task.priority as Priority)}`}>
                          {task.priority} Priority
                        </span>
                        {isOverdue && (
                          <span className="status-pill status-overdue">
                            Overdue
                          </span>
                        )}
                        {task.completed && (
                          <span className="status-pill status-complete">
                            Completed
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm mb-3">{task.description}</p>
                      <div className="flex items-center gap-6 text-sm">
                        {task.dueDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {task.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{task.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {userRole === 'manager' && (
                        <>
                          <Button 
                            variant="outline"
                            size="sm"
                            className="bg-brand/20 hover:bg-brand/30 border-brand/40 text-brand"
                          >
                            <Camera className="w-4 h-4 mr-2" />
                            Add Photo
                          </Button>
                          <Button
                            onClick={() => toggleTaskComplete(task)}
                            variant="outline"
                            size="sm"
                            className={task.completed 
                              ? "bg-green-600/20 hover:bg-green-600/30 border-green-600/40 text-green-300"
                              : "bg-blue-600/20 hover:bg-blue-600/30 border-blue-600/40 text-blue-300"
                            }
                            disabled={updateTaskMutation.isPending}
                          >
                            <Check className="w-4 h-4" />
                            {task.completed ? 'Completed' : 'Mark Complete'}
                          </Button>
                        </>
                      )}
                      {userRole === 'owner' && (
                        <div className="flex items-center gap-2 text-sm">
                          {task.completed ? (
                            <span className="text-green-300 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              Completed by Manager
                            </span>
                          ) : (
                            <span className="text-blue-300 flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Assigned to Manager
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
