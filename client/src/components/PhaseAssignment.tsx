import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Wand2, CheckSquare, Target, ArrowRight, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { HistoricalExpense, ConstructionPhase } from "@shared/schema";

interface PhaseAssignmentProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Smart phase suggestions based on expense descriptions and categories
const getPhasesSuggestion = (expense: HistoricalExpense, phases: ConstructionPhase[]) => {
  const description = expense.description.toLowerCase();
  const category = expense.category.toLowerCase();
  
  // Site Preparation phase (excavation, site setup, initial tools)
  if (description.includes('dig') || 
      description.includes('site') || 
      description.includes('clear') || 
      description.includes('survey') || 
      description.includes('excavat') ||
      (category.includes('tools') && description.includes('site'))) {
    return phases.find(p => p.name === 'Site Preparation');
  }
  
  // Foundation phase (concrete, cement, foundation work)
  if (description.includes('cement') || 
      description.includes('concrete') || 
      description.includes('stone') ||
      description.includes('setting') ||
      description.includes('foundation') ||
      (category.includes('materials') && (description.includes('bags') || description.includes('stone')))) {
    return phases.find(p => p.name === 'Foundation');
  }
  
  // Structure phase (blocks, roofing, walls, mason work)
  if (description.includes('block') || 
      description.includes('wall') || 
      description.includes('roof') || 
      description.includes('iron') ||
      description.includes('sheet') ||
      description.includes('mason') ||
      description.includes('brick') ||
      description.includes('timber')) {
    return phases.find(p => p.name === 'Structure');
  }
  
  // Finishes phase (painting, electrical, plumbing, flooring)
  if (description.includes('paint') || 
      description.includes('electric') || 
      description.includes('plumb') || 
      description.includes('tile') ||
      description.includes('finish') ||
      description.includes('floor')) {
    return phases.find(p => p.name === 'Finishes');
  }
  
  // Landscaping phase (external works, cleanup)
  if (description.includes('garden') || 
      description.includes('landscape') || 
      description.includes('external') || 
      description.includes('cleanup') ||
      description.includes('driveway')) {
    return phases.find(p => p.name === 'Landscaping');
  }
  
  // Default to Site Preparation for early materials and tools
  if (category.includes('tools') || category.includes('transport')) {
    return phases.find(p => p.name === 'Site Preparation');
  }
  
  // Default to Foundation for general materials and labour
  return phases.find(p => p.name === 'Foundation');
};

export default function PhaseAssignment({ projectId, isOpen, onClose }: PhaseAssignmentProps) {
  const [selectedPhaseAssignments, setSelectedPhaseAssignments] = useState<Record<string, string>>({});
  const [applyingSuggestions, setApplyingSuggestions] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch unassigned historical expenses
  const { data: historicalExpenses = [] } = useQuery<HistoricalExpense[]>({
    queryKey: ['/api/projects', projectId, 'historical-expenses'],
    enabled: !!projectId && isOpen,
  });

  // Fetch construction phases
  const { data: phases = [] } = useQuery<ConstructionPhase[]>({
    queryKey: ['/api/construction-phases'],
    enabled: isOpen,
  });

  // Filter unassigned expenses
  const unassignedExpenses = historicalExpenses.filter(expense => !expense.phaseId);

  // Bulk phase assignment mutation
  const assignPhasesMutation = useMutation({
    mutationFn: async (assignments: Record<string, string>) => {
      const promises = Object.entries(assignments).map(([expenseId, phaseId]) =>
        apiRequest('PUT', `/api/historical-expenses/${expenseId}`, { phaseId })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'historical-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'analytics'] });
      toast({
        title: "Success",
        description: `${Object.keys(selectedPhaseAssignments).length} expenses assigned to phases successfully`,
      });
      setSelectedPhaseAssignments({});
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign phases to expenses",
        variant: "destructive",
      });
    },
  });

  const applySuggestions = () => {
    setApplyingSuggestions(true);
    const suggestions: Record<string, string> = {};
    
    unassignedExpenses.forEach(expense => {
      const suggestedPhase = getPhasesSuggestion(expense, phases);
      if (suggestedPhase) {
        suggestions[expense.id] = suggestedPhase.id;
      }
    });
    
    setSelectedPhaseAssignments(suggestions);
    setApplyingSuggestions(false);
    
    toast({
      title: "Smart Suggestions Applied",
      description: `Suggested phases for ${Object.keys(suggestions).length} expenses`,
    });
  };

  const handlePhaseChange = (expenseId: string, phaseId: string) => {
    setSelectedPhaseAssignments(prev => ({
      ...prev,
      [expenseId]: phaseId
    }));
  };

  const handleApplyAssignments = () => {
    if (Object.keys(selectedPhaseAssignments).length === 0) {
      toast({
        title: "No Assignments",
        description: "Please select phases for expenses before applying",
        variant: "destructive",
      });
      return;
    }
    
    assignPhasesMutation.mutate(selectedPhaseAssignments);
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  if (unassignedExpenses.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-card-bg border border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-green-400" />
              All Expenses Assigned
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <Target className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Great! All your historical expenses have been assigned to construction phases.
            </p>
            <p className="text-sm text-muted-foreground">
              Your construction progress chart should now display phase breakdown data.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose} className="btn-brand">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card-bg border border-white/10 max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-brand" />
            Assign Construction Phases ({unassignedExpenses.length} expenses)
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto max-h-[60vh]">
          <div className="flex items-center justify-between bg-dark-bg/50 p-4 rounded-lg">
            <div>
              <h3 className="font-medium text-white mb-1">Smart Phase Assignment</h3>
              <p className="text-sm text-muted-foreground">
                Apply AI-powered suggestions based on expense descriptions and categories
              </p>
            </div>
            <Button 
              onClick={applySuggestions}
              className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/40 text-purple-300"
              disabled={applyingSuggestions}
              data-testid="button-apply-suggestions"
            >
              {applyingSuggestions ? (
                <>
                  <ArrowRight className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Apply Smart Suggestions
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            {unassignedExpenses.map((expense) => {
              const suggestedPhase = getPhasesSuggestion(expense, phases);
              const selectedPhaseId = selectedPhaseAssignments[expense.id];
              const selectedPhase = phases.find(p => p.id === selectedPhaseId);

              return (
                <Card key={expense.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-card-foreground">{expense.description}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {expense.category}
                          </Badge>
                          {suggestedPhase && (
                            <Badge 
                              className="text-xs bg-purple-600/20 text-purple-300 border-purple-600/40"
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              Suggested: {suggestedPhase.name}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Amount: {formatCurrency(expense.amount)}</span>
                          <span>Date: {new Date(expense.date).toLocaleDateString()}</span>
                          {expense.quantity && expense.unit && (
                            <span>Qty: {expense.quantity} {expense.unit}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {selectedPhase && (
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: selectedPhase.color }}
                          />
                        )}
                        <Select
                          value={selectedPhaseId || ''}
                          onValueChange={(value) => handlePhaseChange(expense.id, value)}
                        >
                          <SelectTrigger className="w-48 bg-dark-bg border-white/20 text-white">
                            <SelectValue placeholder="Select phase..." />
                          </SelectTrigger>
                          <SelectContent>
                            {phases.map((phase) => (
                              <SelectItem key={phase.id} value={phase.id}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: phase.color }}
                                  />
                                  {phase.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div className="text-sm text-muted-foreground">
            {Object.keys(selectedPhaseAssignments).length} of {unassignedExpenses.length} expenses assigned
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyAssignments}
              className="btn-brand"
              disabled={assignPhasesMutation.isPending || Object.keys(selectedPhaseAssignments).length === 0}
              data-testid="button-apply-assignments"
            >
              {assignPhasesMutation.isPending ? 'Applying...' : `Apply Assignments (${Object.keys(selectedPhaseAssignments).length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}