import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, History, Package, Trash2, Calendar, FileSpreadsheet, Flag } from "lucide-react";
import { insertHistoricalExpenseSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { HistoricalExpense, ConstructionPhase, Supplier } from "@shared/schema";
import { z } from "zod";
import ExcelImportWizard from "./ExcelImportWizard";
import PhaseAssignment from "./PhaseAssignment";

interface BulkHistoricalEntryProps {
  projectId: string;
}

// Form schema for individual expense entry
const expenseFormSchema = insertHistoricalExpenseSchema.omit({ 
  projectId: true, 
  isHistorical: true 
}).extend({
  date: z.string().min(1, "Date is required"),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

// Multi-entry form for bulk addition
const bulkEntrySchema = z.object({
  expenses: z.array(expenseFormSchema).min(1, "At least one expense is required"),
});

export default function BulkHistoricalEntry({ projectId }: BulkHistoricalEntryProps) {
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [expenses, setExpenses] = useState<Partial<ExpenseFormData>[]>([{}]);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isPhaseAssignmentOpen, setIsPhaseAssignmentOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch construction phases
  const { data: phases = [], isLoading: phasesLoading } = useQuery<ConstructionPhase[]>({
    queryKey: ['/api/construction-phases'],
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
  });

  // Fetch historical expenses
  const { data: historicalExpenses = [], isLoading } = useQuery<HistoricalExpense[]>({
    queryKey: ['/api/projects', projectId, 'historical-expenses'],
    enabled: !!projectId,
  });

  // Single expense form
  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: "",
      amount: "",
      date: new Date().toISOString().split('T')[0],
      category: "Materials",
      paymentMethod: "cash",
      phaseId: "",
      supplierId: "",
      quantity: "",
      unit: "",
      note: "",
    },
  });

  // Create historical expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const expenseData = {
        ...data,
        projectId,
        isHistorical: true,
        date: new Date(data.date),
        supplierId: data.supplierId || null,
        quantity: data.quantity || null,
        unit: data.unit || null,
        note: data.note || null,
      };
      await apiRequest('POST', `/api/projects/${projectId}/historical-expenses`, expenseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'historical-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'analytics'] });
      toast({
        title: "Success",
        description: "Historical expense added successfully",
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add historical expense",
        variant: "destructive",
      });
    },
  });

  // Bulk create mutation
  const bulkCreateMutation = useMutation({
    mutationFn: async (expensesData: ExpenseFormData[]) => {
      const promises = expensesData.map(expense => {
        const expenseData = {
          ...expense,
          projectId,
          isHistorical: true,
          date: new Date(expense.date),
          supplierId: expense.supplierId || null,
          quantity: expense.quantity || null,
          unit: expense.unit || null,
          note: expense.note || null,
        };
        return apiRequest('POST', `/api/projects/${projectId}/historical-expenses`, expenseData);
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'historical-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'analytics'] });
      toast({
        title: "Success", 
        description: `${expenses.length} historical expenses added successfully`,
      });
      setExpenses([{}]);
      setIsBulkDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add bulk historical expenses",
        variant: "destructive",
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (expenseIds: string[]) => {
      const promises = expenseIds.map(id => 
        apiRequest('DELETE', `/api/historical-expenses/${id}`)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'historical-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'analytics'] });
      setSelectedExpenseIds([]);
      setIsBulkDeleteDialogOpen(false);
      toast({
        title: "Success",
        description: `${selectedExpenseIds.length} historical expenses deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to delete historical expenses",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExpenseFormData) => {
    createExpenseMutation.mutate(data);
  };

  const addExpenseRow = () => {
    setExpenses([...expenses, {}]);
  };

  const removeExpenseRow = (index: number) => {
    if (expenses.length > 1) {
      setExpenses(expenses.filter((_, i) => i !== index));
    }
  };

  const updateExpenseRow = (index: number, field: keyof ExpenseFormData, value: any) => {
    const newExpenses = [...expenses];
    newExpenses[index] = { ...newExpenses[index], [field]: value };
    setExpenses(newExpenses);
  };

  const submitBulkExpenses = () => {
    // Validate that all expenses have required fields
    const validExpenses = expenses.filter(expense => 
      expense.description && 
      expense.amount && 
      expense.date && 
      expense.phaseId &&
      expense.category &&
      expense.paymentMethod
    ) as ExpenseFormData[];

    if (validExpenses.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in at least one complete expense entry",
        variant: "destructive",
      });
      return;
    }

    bulkCreateMutation.mutate(validExpenses);
  };

  if (phasesLoading) {
    return (
      <Card className="card-glass">
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Loading construction phases...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Historical Expenses</h2>
        <div className="flex gap-3">
          {/* Excel Import Dialog */}
          <Dialog open={isExcelImportOpen} onOpenChange={setIsExcelImportOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
              <DialogHeader className="sr-only">
                <DialogTitle>Excel Import Wizard</DialogTitle>
              </DialogHeader>
              <div className="p-6">
                <ExcelImportWizard
                  projectId={projectId}
                  onComplete={() => setIsExcelImportOpen(false)}
                  onCancel={() => setIsExcelImportOpen(false)}
                />
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Bulk Entry Dialog */}
          <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/40 text-purple-300">
                <Package className="w-4 h-4 mr-2" />
                Manual Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Bulk Historical Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add multiple historical expenses at once. Perfect for migrating data from WhatsApp chats or old records.
                </p>
                
                <div className="space-y-4">
                  {expenses.map((expense, index) => (
                    <Card key={index} className="card-glass">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-medium text-white">Expense #{index + 1}</h4>
                          {expenses.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeExpenseRow(index)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Description *</Label>
                            <Input
                              value={expense.description || ''}
                              onChange={(e) => updateExpenseRow(index, 'description', e.target.value)}
                              placeholder="e.g., Cement bags"
                              className="bg-dark-bg border-white/20 text-white"
                            />
                          </div>
                          
                          <div>
                            <Label className="text-xs text-muted-foreground">Amount (UGX) *</Label>
                            <Input
                              value={expense.amount || ''}
                              onChange={(e) => updateExpenseRow(index, 'amount', e.target.value)}
                              placeholder="e.g., 150000"
                              className="bg-dark-bg border-white/20 text-white"
                            />
                          </div>
                          
                          <div>
                            <Label className="text-xs text-muted-foreground">Date *</Label>
                            <Input
                              type="date"
                              value={expense.date || ''}
                              onChange={(e) => updateExpenseRow(index, 'date', e.target.value)}
                              className="bg-dark-bg border-white/20 text-white"
                            />
                          </div>
                          
                          <div>
                            <Label className="text-xs text-muted-foreground">Phase *</Label>
                            <Select
                              value={expense.phaseId || ''}
                              onValueChange={(value) => updateExpenseRow(index, 'phaseId', value)}
                            >
                              <SelectTrigger className="bg-dark-bg border-white/20 text-white">
                                <SelectValue placeholder="Select phase" />
                              </SelectTrigger>
                              <SelectContent>
                                {phases.map((phase) => (
                                  <SelectItem key={phase.id} value={phase.id}>
                                    {phase.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label className="text-xs text-muted-foreground">Category *</Label>
                            <Select
                              value={expense.category || 'Materials'}
                              onValueChange={(value) => updateExpenseRow(index, 'category', value)}
                            >
                              <SelectTrigger className="bg-dark-bg border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Materials">Materials</SelectItem>
                                <SelectItem value="Labor">Labor</SelectItem>
                                <SelectItem value="Equipment">Equipment</SelectItem>
                                <SelectItem value="Transport">Transport</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label className="text-xs text-muted-foreground">Payment Method *</Label>
                            <Select
                              value={expense.paymentMethod || 'cash'}
                              onValueChange={(value) => updateExpenseRow(index, 'paymentMethod', value)}
                            >
                              <SelectTrigger className="bg-dark-bg border-white/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="supplier">Supplier Account</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {expense.paymentMethod === 'supplier' && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Supplier</Label>
                              <Select
                                value={expense.supplierId || ''}
                                onValueChange={(value) => updateExpenseRow(index, 'supplierId', value)}
                              >
                                <SelectTrigger className="bg-dark-bg border-white/20 text-white">
                                  <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                  {suppliers.map((supplier) => (
                                    <SelectItem key={supplier.id} value={supplier.id}>
                                      {supplier.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          
                          <div>
                            <Label className="text-xs text-muted-foreground">Quantity</Label>
                            <Input
                              value={expense.quantity || ''}
                              onChange={(e) => updateExpenseRow(index, 'quantity', e.target.value)}
                              placeholder="e.g., 50"
                              className="bg-dark-bg border-white/20 text-white"
                            />
                          </div>
                          
                          <div>
                            <Label className="text-xs text-muted-foreground">Unit</Label>
                            <Input
                              value={expense.unit || ''}
                              onChange={(e) => updateExpenseRow(index, 'unit', e.target.value)}
                              placeholder="e.g., bags, pieces"
                              className="bg-dark-bg border-white/20 text-white"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <Label className="text-xs text-muted-foreground">Notes</Label>
                          <Textarea
                            value={expense.note || ''}
                            onChange={(e) => updateExpenseRow(index, 'note', e.target.value)}
                            placeholder="Additional notes..."
                            className="bg-dark-bg border-white/20 text-white resize-none"
                            rows={2}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <div className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    onClick={addExpenseRow}
                    className="btn-secondary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Another Expense
                  </Button>
                  
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setIsBulkDialogOpen(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={submitBulkExpenses}
                      className="btn-brand"
                      disabled={bulkCreateMutation.isPending}
                    >
                      {bulkCreateMutation.isPending ? 'Adding...' : `Add ${expenses.length} Expenses`}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Single Entry Form */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Add Single Historical Expense</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Description</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Cement bags for foundation"
                          className="bg-dark-bg border-white/20 text-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Amount (UGX)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., 150000"
                          className="bg-dark-bg border-white/20 text-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Date</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          className="bg-dark-bg border-white/20 text-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phaseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Construction Phase</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-dark-bg border-white/20 text-white">
                            <SelectValue placeholder="Select phase" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {phases.map((phase) => (
                            <SelectItem key={phase.id} value={phase.id}>
                              {phase.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-dark-bg border-white/20 text-white">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Materials">Materials</SelectItem>
                          <SelectItem value="Labor">Labor</SelectItem>
                          <SelectItem value="Equipment">Equipment</SelectItem>
                          <SelectItem value="Transport">Transport</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-dark-bg border-white/20 text-white">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="mobile_money">Mobile Money</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="supplier">Supplier Account</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="btn-brand"
                  disabled={createExpenseMutation.isPending}
                >
                  {createExpenseMutation.isPending ? 'Adding...' : 'Add Historical Expense'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Historical Expenses List */}
      <Card className="card-glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5" />
              Historical Expenses ({historicalExpenses.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              {historicalExpenses.filter(exp => !exp.phaseId).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPhaseAssignmentOpen(true)}
                  className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 text-blue-300"
                  data-testid="button-assign-phases"
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Assign Phases ({historicalExpenses.filter(exp => !exp.phaseId).length})
                </Button>
              )}
              {selectedExpenseIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsBulkDeleteDialogOpen(true)}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected ({selectedExpenseIds.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historicalExpenses.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-6">
                No historical expenses recorded yet. Start by adding your past expenses to get a complete financial picture.
              </p>
              <div className="flex gap-3 justify-center">
                <Button 
                  onClick={() => setIsExcelImportOpen(true)}
                  className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Import from Excel
                </Button>
                <Button 
                  onClick={() => setIsBulkDialogOpen(true)}
                  className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/40 text-purple-300"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Manual Entry
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2">
                      <input
                        type="checkbox"
                        checked={selectedExpenseIds.length === historicalExpenses.length && historicalExpenses.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExpenseIds(historicalExpenses.map(exp => exp.id));
                          } else {
                            setSelectedExpenseIds([]);
                          }
                        }}
                        className="rounded border-white/20 bg-dark-bg"
                      />
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Date</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Description</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Phase</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Category</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Amount</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {historicalExpenses.map((expense) => (
                    <tr key={expense.id} className={selectedExpenseIds.includes(expense.id) ? 'bg-red-950/20' : ''}>
                      <td className="py-3 px-2">
                        <input
                          type="checkbox"
                          checked={selectedExpenseIds.includes(expense.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedExpenseIds([...selectedExpenseIds, expense.id]);
                            } else {
                              setSelectedExpenseIds(selectedExpenseIds.filter(id => id !== expense.id));
                            }
                          }}
                          className="rounded border-white/20 bg-dark-bg"
                        />
                      </td>
                      <td className="py-3 px-2 text-sm text-white">
                        {new Date(expense.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 text-sm text-white">
                        {expense.description}
                        {expense.quantity && expense.unit && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({expense.quantity} {expense.unit})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-sm">
                        <span className="px-2 py-1 rounded text-xs bg-blue-600/20 text-blue-300">
                          {phases.find(p => p.id === expense.phaseId)?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {expense.category}
                      </td>
                      <td className="py-3 px-2 text-sm font-medium text-green-400">
                        UGX {parseFloat(expense.amount).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {expense.paymentMethod.replace('_', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="bg-card-bg border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Historical Expenses</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to permanently delete {selectedExpenseIds.length} selected historical expenses? 
              This action cannot be undone and will update your project analytics.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsBulkDeleteDialogOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => bulkDeleteMutation.mutate(selectedExpenseIds)}
                disabled={bulkDeleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete Expenses'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Phase Assignment Dialog */}
      <PhaseAssignment 
        isOpen={isPhaseAssignmentOpen}
        onClose={() => setIsPhaseAssignmentOpen(false)}
        projectId={projectId}
      />
    </div>
  );
}