import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, CreditCard, Truck, History, Calendar, DollarSign } from "lucide-react";
import { insertSupplierSchema, insertSupplierPurchaseSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Supplier, SupplierPurchase, Project } from "@shared/schema";
import { z } from "zod";

interface SupplierManagementProps {
  projectId: string;
}

const supplierFormSchema = insertSupplierSchema;
const purchaseFormSchema = insertSupplierPurchaseSchema;

export default function SupplierManagement({ projectId }: SupplierManagementProps) {
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
  });

  const { data: purchases = [], isLoading: purchasesLoading } = useQuery<SupplierPurchase[]>({
    queryKey: ['/api/supplier-purchases', projectId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/supplier-purchases?projectId=${projectId}`);
      const data = await response.json();
      // Ensure response is always an array
      return Array.isArray(data) ? data : [];
    },
    enabled: !!projectId,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Supplier transaction history query
  const { data: supplierHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['/api/suppliers', selectedSupplierForHistory, 'transactions', projectId],
    queryFn: async () => {
      if (!selectedSupplierForHistory) return null;
      const response = await apiRequest('GET', `/api/suppliers/${selectedSupplierForHistory}/transactions?projectId=${projectId}`);
      return response.json();
    },
    enabled: !!selectedSupplierForHistory && !!projectId,
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data: z.infer<typeof supplierFormSchema>) => {
      await apiRequest('POST', '/api/suppliers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      toast({
        title: "Success",
        description: "Supplier created successfully",
      });
      setIsSupplierDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create supplier",
        variant: "destructive",
      });
    },
  });

  const createPurchaseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof purchaseFormSchema>) => {
      await apiRequest('POST', '/api/supplier-purchases', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-purchases', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'analytics'] });
      toast({
        title: "Success",
        description: "Purchase recorded successfully",
      });
      setIsPurchaseDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to record purchase",
        variant: "destructive",
      });
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const supplier = suppliers.find(s => s.id === id);
      if (!supplier) return;
      
      const newTotalDeposited = parseFloat(supplier.totalDeposited) + amount;
      const newCurrentBalance = parseFloat(supplier.currentBalance) + amount;
      
      await apiRequest('PUT', `/api/suppliers/${id}`, {
        totalDeposited: newTotalDeposited.toString(),
        currentBalance: newCurrentBalance.toString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      toast({
        title: "Success",
        description: "Supplier credit added successfully",
      });
    },
  });

  const supplierForm = useForm<z.infer<typeof supplierFormSchema>>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: '',
      totalDeposited: '0',
      totalSpent: '0',
      currentBalance: '0',
    },
  });

  const purchaseForm = useForm<z.infer<typeof purchaseFormSchema>>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      supplierId: '',
      projectId,
      amount: '',
      item: '',
      date: new Date(),
    },
  });

  const onSupplierSubmit = (data: z.infer<typeof supplierFormSchema>) => {
    createSupplierMutation.mutate(data);
  };

  const onPurchaseSubmit = (data: z.infer<typeof purchaseFormSchema>) => {
    // Find the selected supplier
    const selectedSupplier = suppliers.find(s => s.id === data.supplierId);
    if (!selectedSupplier) {
      toast({
        title: "Error",
        description: "Selected supplier not found",
        variant: "destructive",
      });
      return;
    }

    const purchaseAmount = parseFloat(data.amount);
    const currentBalance = parseFloat(selectedSupplier.currentBalance);

    // Check if purchase exceeds available balance
    if (purchaseAmount > currentBalance) {
      const shortfall = purchaseAmount - currentBalance;
      toast({
        title: "Insufficient Balance",
        description: `This purchase exceeds the supplier's available balance by ${formatCurrency(shortfall)}. Please add more credit or reduce the purchase amount.`,
        variant: "destructive",
      });
      return;
    }

    createPurchaseMutation.mutate(data);
  };

  const handleAddCredit = (supplierId: string) => {
    const amount = prompt("Enter credit amount (UGX):");
    if (amount && !isNaN(parseFloat(amount))) {
      updateSupplierMutation.mutate({
        id: supplierId,
        amount: parseFloat(amount),
      });
    }
  };

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      maximumFractionDigits: 0,
    }).format(numAmount);
  };

  const getCreditUtilization = (supplier: Supplier) => {
    const total = parseFloat(supplier.totalDeposited);
    const spent = parseFloat(supplier.totalSpent);
    if (total <= 0) return 0;
    
    const utilization = Math.round((spent / total) * 100);
    // Cap at 100% for UI display to prevent overflow
    return Math.min(utilization, 100);
  };

  const getActualUtilization = (supplier: Supplier) => {
    const total = parseFloat(supplier.totalDeposited);
    const spent = parseFloat(supplier.totalSpent);
    return total > 0 ? Math.round((spent / total) * 100) : 0;
  };

  const isOverspent = (supplier: Supplier) => {
    return getActualUtilization(supplier) > 100;
  };

  if (suppliersLoading || purchasesLoading) {
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
        <h2 className="text-2xl font-bold text-white">Supplier Management</h2>
        <div className="flex gap-3">
          <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent/20 hover:bg-accent/30 border border-accent/40 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card-bg border border-white/10 max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Supplier</DialogTitle>
              </DialogHeader>
              <Form {...supplierForm}>
                <form onSubmit={supplierForm.handleSubmit(onSupplierSubmit)} className="space-y-4">
                  <FormField
                    control={supplierForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Supplier Name</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="bg-dark-bg border-white/20 text-white h-12"
                            placeholder="e.g., ABC Hardware"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={supplierForm.control}
                    name="totalDeposited"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Initial Deposit (UGX)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number"
                            min="0"
                            className="bg-dark-bg border-white/20 text-white h-12"
                            placeholder="0"
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              supplierForm.setValue('currentBalance', e.target.value);
                            }}
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
                      onClick={() => setIsSupplierDialogOpen(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="btn-brand"
                      disabled={createSupplierMutation.isPending}
                    >
                      {createSupplierMutation.isPending ? 'Adding...' : 'Add Supplier'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-brand">
                <CreditCard className="w-4 h-4 mr-2" />
                New Purchase
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card-bg border border-white/10 max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">Record Supplier Purchase</DialogTitle>
              </DialogHeader>
              <Form {...purchaseForm}>
                <form onSubmit={purchaseForm.handleSubmit(onPurchaseSubmit)} className="space-y-4">
                  <FormField
                    control={purchaseForm.control}
                    name="supplierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Supplier</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-dark-bg border-white/20 text-white h-12">
                              <SelectValue placeholder="Select supplier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card-bg border-white/20">
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={purchaseForm.control}
                    name="item"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Item/Description</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="bg-dark-bg border-white/20 text-white h-12"
                            placeholder="e.g., Cement 20 bags"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={purchaseForm.control}
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
                      control={purchaseForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Date</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="date"
                              className="bg-dark-bg border-white/20 text-white h-12"
                              value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                              onChange={(e) => field.onChange(new Date(e.target.value))}
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
                      onClick={() => setIsPurchaseDialogOpen(false)}
                      className="btn-secondary h-12"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="btn-brand h-12"
                      disabled={createPurchaseMutation.isPending}
                    >
                      {createPurchaseMutation.isPending ? 'Recording...' : 'Record Purchase'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Supplier Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {suppliers.length === 0 ? (
          <Card className="card-glass col-span-full">
            <CardContent className="text-center py-12">
              <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No suppliers added yet. Create your first supplier to manage credit accounts.
              </p>
              <Button 
                onClick={() => setIsSupplierDialogOpen(true)}
                className="bg-accent/20 hover:bg-accent/30 border border-accent/40 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Supplier
              </Button>
            </CardContent>
          </Card>
        ) : (
          suppliers.map((supplier) => {
            const utilization = getCreditUtilization(supplier);
            
            return (
              <Card key={supplier.id} className="card-glass">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-white">{supplier.name}</CardTitle>
                    <span className="status-pill status-active">Active</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Total Deposited</div>
                      <div className="text-lg font-bold text-white">
                        {formatCurrency(supplier.totalDeposited)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Total Spent</div>
                      <div className="text-lg font-bold text-white">
                        {formatCurrency(supplier.totalSpent)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Balance</div>
                      <div className="text-lg font-bold text-green-400">
                        {formatCurrency(supplier.currentBalance)}
                      </div>
                    </div>
                  </div>

                  <div className="w-full bg-white/10 rounded-full h-2 mb-4 overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        isOverspent(supplier) 
                          ? 'bg-gradient-to-r from-red-500 to-red-600' 
                          : utilization > 80 
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                            : 'bg-gradient-to-r from-brand to-accent'
                      }`}
                      style={{ width: `${utilization}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${
                      isOverspent(supplier) 
                        ? 'text-red-400 font-medium' 
                        : utilization > 80 
                          ? 'text-yellow-400' 
                          : 'text-muted-foreground'
                    }`}>
                      Credit utilized: {getActualUtilization(supplier)}%
                      {isOverspent(supplier) && (
                        <span className="block text-xs text-red-300 mt-1">
                          ⚠️ Overspent by {formatCurrency(parseFloat(supplier.totalSpent) - parseFloat(supplier.totalDeposited))}
                        </span>
                      )}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAddCredit(supplier.id)}
                        size="sm"
                        className="bg-brand/20 hover:bg-brand/30 border border-brand/40 text-brand text-xs px-3 py-1"
                      >
                        Add Credit
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedSupplierId(supplier.id);
                          setIsPurchaseDialogOpen(true);
                          purchaseForm.setValue('supplierId', supplier.id);
                        }}
                        size="sm"
                        className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 text-blue-300 text-xs px-3 py-1"
                      >
                        Purchase
                      </Button>
                      <Button
                        onClick={() => setSelectedSupplierForHistory(supplier.id)}
                        size="sm"
                        className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/40 text-purple-300 text-xs px-3 py-1"
                      >
                        <History className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Supplier Transaction History */}
      {selectedSupplierForHistory && (
        <Card className="card-glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5" />
              Transaction History - {suppliers.find(s => s.id === selectedSupplierForHistory)?.name}
            </CardTitle>
            <Button
              onClick={() => setSelectedSupplierForHistory("")}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-white"
            >
              ×
            </Button>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading transaction history...
              </div>
            ) : !supplierHistory || (supplierHistory.purchases.length === 0 && supplierHistory.ledgerEntries.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                No transaction history found for this supplier.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Direct Purchases */}
                {supplierHistory.purchases.length > 0 && (
                  <div>
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Direct Purchases ({supplierHistory.purchases.length})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-xs font-medium text-muted-foreground py-2">Date</th>
                            <th className="text-left text-xs font-medium text-muted-foreground py-2">Item</th>
                            <th className="text-left text-xs font-medium text-muted-foreground py-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {supplierHistory.purchases.map((purchase: any) => (
                            <tr key={purchase.id}>
                              <td className="py-2 text-sm text-white">
                                {new Date(purchase.date).toLocaleDateString()}
                              </td>
                              <td className="py-2 text-sm text-white">{purchase.item}</td>
                              <td className="py-2 text-sm text-green-400 font-medium">
                                {formatCurrency(purchase.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Daily Ledger Entries */}
                {supplierHistory.ledgerEntries.length > 0 && (
                  <div>
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Daily Ledger Entries ({supplierHistory.ledgerEntries.length})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-xs font-medium text-muted-foreground py-2">Date</th>
                            <th className="text-left text-xs font-medium text-muted-foreground py-2">Item</th>
                            <th className="text-left text-xs font-medium text-muted-foreground py-2">Category</th>
                            <th className="text-left text-xs font-medium text-muted-foreground py-2">Amount</th>
                            <th className="text-left text-xs font-medium text-muted-foreground py-2">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {supplierHistory.ledgerEntries.map((entry: any) => (
                            <tr key={entry.id}>
                              <td className="py-2 text-sm text-white">
                                {new Date(entry.date).toLocaleDateString()}
                              </td>
                              <td className="py-2 text-sm text-white">{entry.item}</td>
                              <td className="py-2 text-sm text-muted-foreground">{entry.category}</td>
                              <td className="py-2 text-sm text-blue-400 font-medium">
                                {formatCurrency(entry.amount)}
                              </td>
                              <td className="py-2 text-sm text-muted-foreground">
                                {entry.quantity ? `${entry.quantity} ${entry.unit || ''}` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Transaction Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Direct Purchases:</span>
                      <span className="block text-green-400 font-medium">
                        {formatCurrency(
                          supplierHistory.purchases.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0)
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Daily Ledger Entries:</span>
                      <span className="block text-blue-400 font-medium">
                        {formatCurrency(
                          supplierHistory.ledgerEntries.reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Supplier Purchases */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Recent Supplier Purchases</CardTitle>
        </CardHeader>
        <CardContent>
          {purchasesLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading purchases...
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No supplier purchases recorded yet for this project.
              <br />
              <small className="text-xs">Project ID: {projectId}</small>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Date</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Supplier</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Item</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {purchases.slice().reverse().map((purchase) => {
                    const supplier = suppliers.find(s => s.id === purchase.supplierId);
                    
                    return (
                      <tr key={purchase.id}>
                        <td className="py-4 px-2 text-sm text-white">
                          {new Date(purchase.date).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-2 text-sm text-white">
                          {supplier?.name || 'Unknown Supplier'}
                        </td>
                        <td className="py-4 px-2 text-sm text-white">{purchase.item}</td>
                        <td className="py-4 px-2 text-sm text-white font-medium">
                          {formatCurrency(purchase.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
