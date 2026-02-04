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
  budget: z.string().optional(), // Form uses 'budget' instead of 'budgetAmount'
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).omit({
  userId: true, // userId is set by the server from session, not the form
  budgetAmount: true, // Remove budgetAmount since we're using 'budget' instead
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
      status: 'active', // Use lowercase to match database
      startDate: '',
      endDate: '',
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: z.infer<typeof projectFormSchema>) => {
      console.log('[CreateProjectDialog] Submitting project data:', data);
      
      const projectData = {
        name: data.name?.trim(),
        description: data.description?.trim() || '',
        budgetAmount: data.budget?.toString() || '0',
        status: (data.status || 'active').toLowerCase().trim(), // Ensure lowercase to match DB
        // Note: startDate and endDate are not in the database schema, so we don't send them
      };

      console.log('[CreateProjectDialog] Sending to API:', projectData);

      try {
        const response = await apiRequest('POST', '/api/projects', projectData);
        const result = await response.json();
        console.log('[CreateProjectDialog] API response:', result);
        return result;
      } catch (error: any) {
        console.error('[CreateProjectDialog] API request failed:', error);
        throw error;
      }
    },
    onSuccess: (result: any) => {
      console.log('[CreateProjectDialog] Mutation success:', result);
      
      // Invalidate and refetch projects list
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      
      toast({
        title: "Success",
        description: "Project created successfully",
      });
      
      form.reset();
      onOpenChange(false);
      
      // Call callback if project ID is available
      if (onProjectCreated && result?.project?.id) {
        onProjectCreated(result.project.id);
      }
    },
    onError: (error: any) => {
      console.error('[CreateProjectDialog] Mutation error:', error);
      console.error('[CreateProjectDialog] Error details:', {
        message: error.message,
        stack: error.stack,
      });
      
      // Extract user-friendly error message
      let errorMessage = "Failed to create project. Please try again.";
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