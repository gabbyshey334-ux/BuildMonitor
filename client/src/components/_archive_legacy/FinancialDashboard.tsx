import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, DollarSign, Wallet, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Update } from "@shared/schema";
import { monetaryAmountValidation } from "@shared/schema";
import type { ProjectAnalytics } from "@/types";

interface FinancialDashboardProps {
  projectId: string;
  userRole?: 'owner' | 'manager';
}

const cashDepositSchema = z.object({
  amount: monetaryAmountValidation,
  date: z.string().min(1, "Date is required"),
  method: z.enum(["Mobile Money", "Bank Transfer", "Cash"]),
  reference: z.string().optional(),
  note: z.string().optional(),
});

export default function FinancialDashboard({ projectId, userRole = 'owner' }: FinancialDashboardProps) {
  const [isCashDepositDialogOpen, setIsCashDepositDialogOpen] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: analytics } = useQuery<ProjectAnalytics>({
    queryKey: ['/api/projects', projectId, 'analytics'],
    enabled: !!projectId,
    staleTime: 0, // Always consider data stale
    refetchOnWindowFocus: true,
  });

  const { data: recentTransactions = [] } = useQuery<{
    id: string;
    type: string;
    title: string;
    description: string;
    amount?: number;
    category?: string;
    createdAt: string;
  }[]>({
    queryKey: ['/api/projects', projectId, 'activities'],
    enabled: !!projectId,
  });

  // Cash balance comes from analytics
  const cashOnHand = analytics?.cashBalance || 0;

  // Cash deposit form
  const cashDepositForm = useForm<z.infer<typeof cashDepositSchema>>({
    resolver: zodResolver(cashDepositSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      amount: '0',
      method: 'Mobile Money',
      reference: '',
      note: '',
    },
  });

  const createCashDepositMutation = useMutation({
    mutationFn: async (data: z.infer<typeof cashDepositSchema>) => {
      const depositData = {
        projectId,
        amount: data.amount,
        date: new Date(data.date),
        method: data.method,
        reference: data.reference || '',
        note: data.note || '',
      };

      await apiRequest('POST', '/api/cash-deposits', depositData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'cash-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'opening-balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'analytics'] });
      cashDepositForm.reset({
        date: new Date().toISOString().split('T')[0],
        amount: '0',
        method: 'Mobile Money',
        reference: '',
        note: '',
      });
      toast({
        title: "Success",
        description: "Cash deposit recorded successfully",
      });
      setIsCashDepositDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record cash deposit",
        variant: "destructive",
      });
    },
  });

  // Budget update mutation
  const updateBudgetMutation = useMutation({
    mutationFn: async (newBudget: string) => {
      await apiRequest('PUT', `/api/projects/${projectId}`, { budget: newBudget });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'analytics'] });
      toast({
        title: "Success",
        description: "Project budget updated successfully",
      });
      setIsEditingBudget(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update project budget",
        variant: "destructive",
      });
    },
  });

  const onCashDepositSubmit = (data: z.infer<typeof cashDepositSchema>) => {
    createCashDepositMutation.mutate(data);
  };

  const handleEditBudget = () => {
    setBudgetAmount(analytics?.totalBudget?.toString() || '0');
    setIsEditingBudget(true);
  };

  const handleSaveBudget = () => {
    if (budgetAmount && parseFloat(budgetAmount) > 0) {
      updateBudgetMutation.mutate(budgetAmount);
    }
  };

  const handleCancelBudget = () => {
    setIsEditingBudget(false);
    setBudgetAmount('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'materials':
        return 'bg-brand';
      case 'labor':
        return 'bg-blue-500';
      case 'transport':
        return 'bg-green-500';
      case 'food':
        return 'bg-yellow-500';
      default:
        return 'bg-purple-500';
    }
  };

  const getTransactionIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'materials':
        return 'fas fa-hammer';
      case 'labor':
        return 'fas fa-users';
      case 'transport':
        return 'fas fa-truck';
      case 'food':
        return 'fas fa-utensils';
      default:
        return 'fas fa-receipt';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Financial Management</h2>
          <p className="text-sm text-muted-foreground">
            {userRole === 'owner' ? 'Monitor project finances and review expense reports' : 'View financial summary - expenses are logged through Daily Ledgers'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {userRole === 'owner' && (
            <>
              <Dialog open={isCashDepositDialogOpen} onOpenChange={setIsCashDepositDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300 h-12 flex-1 sm:flex-initial">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Send Cash
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card-bg border border-white/10 max-w-[95vw] sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-white">Send Cash to Manager</DialogTitle>
                  </DialogHeader>
                  <Form {...cashDepositForm}>
                    <form onSubmit={cashDepositForm.handleSubmit(onCashDepositSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={cashDepositForm.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white">Amount (UGX)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number"
                                  min="0"
                                  className="bg-dark-bg border-white/20 text-white h-12"
                                  placeholder="0"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={cashDepositForm.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white">Date Sent</FormLabel>
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

                      <FormField
                        control={cashDepositForm.control}
                        name="method"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Transfer Method</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-dark-bg border-white/20 text-white">
                                  <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-dark-bg border-white/20">
                                <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                <SelectItem value="Cash">Cash</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={cashDepositForm.control}
                        name="reference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Reference/Transaction ID</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="bg-dark-bg border-white/20 text-white"
                                placeholder="Optional reference number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={cashDepositForm.control}
                        name="note"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Note</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                className="bg-dark-bg border-white/20 text-white"
                                placeholder="Optional note about this transfer"
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-2 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsCashDepositDialogOpen(false)}
                          className="flex-1 border-white/20 text-white hover:bg-white/10"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createCashDepositMutation.isPending}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {createCashDepositMutation.isPending ? "Recording..." : "Record Transfer"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              <Button variant="outline" className="bg-blue-600/20 hover:bg-blue-600/30 border-blue-600/40 text-blue-300">
                <Plus className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cash Balance Display */}
      <Card className="card-glass border-green-600/20">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Cash on Hand
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-400">
            {analytics ? formatCurrency(cashOnHand) : 'Loading...'}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Available for daily expenses
          </p>
        </CardContent>
      </Card>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="card-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget</CardTitle>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-brand" />
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0 text-brand hover:text-brand/80"
                data-testid="button-edit-budget"
                onClick={handleEditBudget}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isEditingBudget ? (
              <div className="space-y-3">
                <Input
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  placeholder="Enter budget amount"
                  className="bg-dark-bg border-white/20 text-white text-xl font-bold"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveBudget}
                    disabled={updateBudgetMutation.isPending}
                    className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300"
                  >
                    {updateBudgetMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelBudget}
                    className="btn-secondary"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-white">
                  {analytics ? formatCurrency(analytics.totalBudget) : 'Loading...'}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Allocated across all categories</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Cash Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {analytics ? formatCurrency(analytics.totalCashSpent) : 'Loading...'}
            </div>
            <p className="text-sm text-green-400 mt-1">
              <i className="fas fa-arrow-down mr-1"></i>
              {analytics ? Math.round((analytics.totalCashSpent / analytics.totalBudget) * 100) : 0}% of budget
            </p>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Supplier Credit Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {analytics ? formatCurrency(analytics.totalSupplierSpent) : 'Loading...'}
            </div>
            <p className="text-sm text-blue-400 mt-1">
              <i className="fas fa-handshake mr-1"></i>Via suppliers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expense Breakdown & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Categories */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-white">Expense Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics && Object.entries(analytics.categoryBreakdown).map(([category, amount]) => {
                const percentage = analytics.totalSpent > 0 ? (amount / analytics.totalSpent) * 100 : 0;
                
                return (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded ${getCategoryColor(category)}`}></div>
                      <span className="text-white">{category}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">{formatCurrency(amount)}</div>
                      <div className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
              
              {(!analytics || Object.keys(analytics.categoryBreakdown).length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No expense data available yet. Log your first expense to see the breakdown.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-white">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransactions.filter(t => t.type === 'daily_ledger' || t.type === 'cash_deposit').slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${transaction.type === 'cash_deposit' ? 'bg-green-500/20' : 'bg-red-600/20'} rounded-full flex items-center justify-center`}>
                      <i className={`${getTransactionIcon(transaction.category || '')} ${transaction.type === 'cash_deposit' ? 'text-green-400' : 'text-red-400'} text-sm`}></i>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{transaction.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.category} • {transaction.type === 'cash_deposit' ? 'Cash Deposit' : 'Daily Expenses'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">
                      {transaction.amount ? formatCurrency(transaction.amount) : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Entered: {new Date(transaction.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {recentTransactions.filter(t => t.type === 'daily_ledger' || t.type === 'cash_deposit').length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions yet. Log your first expense or send cash to see transaction history.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
