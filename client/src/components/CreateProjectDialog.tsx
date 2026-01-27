import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertProjectSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: (projectId: string) => void;
}

const projectFormSchema = insertProjectSchema.extend({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).omit({
  ownerId: true,
});

export default function CreateProjectDialog({ 
  open, 
  onOpenChange, 
  onProjectCreated 
}: CreateProjectDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof projectFormSchema>>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      description: '',
      budget: '0',
      status: 'Active',
      startDate: '',
      endDate: '',
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: z.infer<typeof projectFormSchema>) => {
      const projectData = {
        name: data.name,
        description: data.description || '',
        budget: data.budget.toString(),
        status: data.status || 'Active',
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
      };
      const response: any = await apiRequest('POST', '/api/projects', projectData);
      return response;
    },
    onSuccess: (newProject: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Success",
        description: "Project created successfully",
      });
      form.reset();
      onOpenChange(false);
      if (onProjectCreated && newProject?.id) {
        onProjectCreated(newProject.id);
      }
    },
    onError: (error: any) => {
      console.error('Project creation error:', error);
      
      // Extract user-friendly error message
      let errorMessage = "Failed to create project";
      if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Unable to Create Project",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof projectFormSchema>) => {
    createProjectMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="bg-card-bg border border-white/10 max-w-2xl w-[95vw] max-h-[85vh] overflow-y-auto mx-auto my-4 sm:my-8" 
        aria-describedby="dialog-description"
        data-testid="dialog-create-project"
        role="dialog"
        aria-modal="true"
      >
        <DialogHeader>
          <DialogTitle className="text-white text-xl" id="dialog-title">Create New Project</DialogTitle>
          <DialogDescription id="dialog-description" className="text-sm text-muted-foreground">
            Fill in the details below to create a new construction project. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white" htmlFor="project-name">Project Name *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        id="project-name"
                        className="bg-dark-bg border-white/20 text-white form-input"
                        placeholder="e.g., Residential Building Construction"
                        aria-describedby="project-name-error"
                        aria-required="true"
                        data-testid="input-project-name"
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
                        className="bg-dark-bg border-white/20 text-white form-textarea"
                        placeholder="Brief description of the project"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Budget (UGX) *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        min="0"
                        step="0.01"
                        className="bg-dark-bg border-white/20 text-white form-input"
                        placeholder="0.00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Start Date</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="date"
                          className="bg-dark-bg border-white/20 text-white form-input"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Expected End Date</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="date"
                          className="bg-dark-bg border-white/20 text-white form-input"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="btn-secondary min-h-[44px] w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="btn-brand min-h-[44px] w-full sm:w-auto"
                disabled={createProjectMutation.isPending}
              >
                {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}