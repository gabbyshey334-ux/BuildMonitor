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
import { Plus, CreditCard, Truck } from "lucide-react";
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
  });

  const { data: purchases = [], isLoading: purchasesLoading } = useQuery<SupplierPurchase[]>({
    queryKey: ['/api/supplier-purchases'],
    select: (data) => data.filter(p => p.projectId === projectId),
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
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
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
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
    return total > 0 ? Math.round((spent / total) * 100) : 0;
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
            <DialogContent className="bg-card-bg border border-white/10">
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
                            className="bg-dark-bg border-white/20 text-white"
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
                            className="bg-dark-bg border-white/20 text-white"
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
            <DialogContent className="bg-card-bg border border-white/10">
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
                            <SelectTrigger className="bg-dark-bg border-white/20 text-white">
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
                            className="bg-dark-bg border-white/20 text-white"
                            placeholder="e.g., Cement 20 bags"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
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
                              className="bg-dark-bg border-white/20 text-white"
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
                              className="bg-dark-bg border-white/20 text-white"
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
                      className="btn-secondary"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="btn-brand"
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

                  <div className="w-full bg-white/10 rounded-full h-2 mb-4">
                    <div 
                      className="bg-gradient-to-r from-brand to-accent h-2 rounded-full transition-all" 
                      style={{ width: `${utilization}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Credit utilized: {utilization}%
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Recent Supplier Purchases */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Recent Supplier Purchases</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No supplier purchases recorded yet for this project.
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
