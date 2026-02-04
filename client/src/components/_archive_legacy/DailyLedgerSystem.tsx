import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Check, Clock, Trash2, Book, Edit2, DollarSign, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BulkHistoricalEntry from "./BulkHistoricalEntry";
import { insertDailyLedgerSchema, monetaryAmountValidation, quantityValidation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DailyLedger, DailyLedgerLine } from "@shared/schema";
import { z } from "zod";

interface DailyLedgerSystemProps {
  projectId: string;
  userRole?: "Owner" | "Manager";
}

const ledgerLineSchema = z.object({
  item: z.string().min(1, "Item is required"),
  category: z.enum(['Materials', 'Labor', 'Equipment', 'Transport', 'Food', 'Other']),
  amount: monetaryAmountValidation,
  paymentMethod: z.enum(['cash', 'supplier']),
  quantity: quantityValidation, // Optional quantity with proper validation
  unit: z.string().optional(), // Optional unit (bags, pieces, liters, etc.)
  supplierId: z.string().optional(), // Optional supplier when payment method is supplier
  note: z.string().optional(),
});

const ledgerFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
  lines: z.array(ledgerLineSchema).min(1, "At least one line item is required"),
});


export default function DailyLedgerSystem({ projectId, userRole = "Manager" }: DailyLedgerSystemProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLedger, setEditingLedger] = useState<(DailyLedger & { lines: DailyLedgerLine[] }) | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('daily-ledgers');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: ledgers = [], isLoading } = useQuery<(DailyLedger & { lines: DailyLedgerLine[] })[]>({
    queryKey: ['/api/projects', projectId, 'daily-ledgers'],
    enabled: !!projectId,
  });


  const { data: openingBalanceInfo, refetch: refetchOpeningBalance } = useQuery<{
    openingBalance: number;
    lastClosingBalance: number | null;
    cashDepositsTotal: number;
  }>({
    queryKey: ['/api/projects', projectId, 'opening-balance', selectedDate],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/projects/${projectId}/opening-balance/${selectedDate}`);
      return response.json();
    },
    enabled: !!projectId && !!selectedDate,
  });

  // Fetch suppliers for the supplier dropdown
  const { data: suppliers = [] } = useQuery<Array<{ id: string; name: string; contactInfo: string }>>({
    queryKey: ['/api/suppliers'],
    enabled: !!projectId,
  });

  const createLedgerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof ledgerFormSchema>) => {
      // Get the calculated opening balance
      const balanceResponse = await apiRequest('GET', `/api/projects/${projectId}/opening-balance/${data.date}`);
      const balanceInfo = await balanceResponse.json();
      
      const totalCashSpent = data.lines
        .filter(line => line.paymentMethod === 'cash')
        .reduce((sum, line) => sum + parseFloat(line.amount), 0);
      
      const totalSupplierSpent = data.lines
        .filter(line => line.paymentMethod === 'supplier')
        .reduce((sum, line) => sum + parseFloat(line.amount), 0);

      const openingCash = balanceInfo?.openingBalance || 0;
      const closingCash = openingCash - totalCashSpent;

      const ledgerData = {
        projectId,
        date: new Date(data.date),
        openingCash: openingCash.toString(),
        closingCash: closingCash.toString(),
        totalCashSpent: totalCashSpent.toString(),
        totalSupplierSpent: totalSupplierSpent.toString(),
        notes: data.notes || '',
        submittedAt: new Date(),
      };

      const lines = data.lines.map(line => ({
        item: line.item,
        category: line.category,
        amount: line.amount,
        paymentMethod: line.paymentMethod,
        quantity: line.quantity || null,
        unit: line.unit || null,
        supplierId: line.supplierId || null,
        note: line.note || '',
      }));

      await apiRequest('POST', '/api/daily-ledgers', { ledger: ledgerData, lines });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'daily-ledgers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'opening-balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'activities'] });
      // Invalidate supplier-related queries since auto-creation might have occurred
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-purchases', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'inventory'] });
      form.reset({
        date: selectedDate,
        notes: '',
        lines: [{ item: '', category: 'Materials', amount: '0', paymentMethod: 'cash', quantity: '', unit: '', supplierId: '', note: '' }],
      });
      toast({
        title: "Success",
        description: "Daily ledger created successfully",
      });
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Daily ledger creation error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create daily ledger",
        variant: "destructive",
      });
    },
  });

  const editLedgerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof ledgerFormSchema>) => {
      if (!editingLedger) throw new Error("No ledger selected for editing");

      // Get the calculated opening balance
      const balanceResponse = await apiRequest('GET', `/api/projects/${projectId}/opening-balance/${data.date}`);
      const balanceInfo = await balanceResponse.json();
      
      const totalCashSpent = data.lines
        .filter(line => line.paymentMethod === 'cash')
        .reduce((sum, line) => sum + parseFloat(line.amount), 0);
      
      const totalSupplierSpent = data.lines
        .filter(line => line.paymentMethod === 'supplier')
        .reduce((sum, line) => sum + parseFloat(line.amount), 0);

      const openingCash = balanceInfo?.openingBalance || 0;
      const closingCash = openingCash - totalCashSpent;

      const ledgerData = {
        openingCash: openingCash.toString(),
        closingCash: closingCash.toString(),
        totalCashSpent: totalCashSpent.toString(),
        totalSupplierSpent: totalSupplierSpent.toString(),
        notes: data.notes || '',
        updatedAt: new Date(),
      };

      const lines = data.lines.map(line => ({
        item: line.item,
        category: line.category,
        amount: line.amount,
        paymentMethod: line.paymentMethod,
        quantity: line.quantity || null,
        unit: line.unit || null,
        supplierId: line.supplierId || null,
        note: line.note || '',
      }));

      await apiRequest('PUT', `/api/daily-ledgers/${editingLedger.id}`, { ledger: ledgerData, lines });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'daily-ledgers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'opening-balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'activities'] });
      // Invalidate supplier-related queries since auto-creation might have occurred
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-purchases', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'inventory'] });
      toast({
        title: "Success",
        description: "Daily ledger updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingLedger(null);
    },
    onError: (error: any) => {
      console.error("Daily ledger edit error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update daily ledger",
        variant: "destructive",
      });
    },
  });


  const form = useForm<z.infer<typeof ledgerFormSchema>>({
    resolver: zodResolver(ledgerFormSchema),
    defaultValues: {
      date: selectedDate,
      notes: '',
      lines: [{ item: '', category: 'Materials', amount: '0', paymentMethod: 'cash', quantity: '', unit: '', supplierId: '', note: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });


  const onSubmit = (data: z.infer<typeof ledgerFormSchema>) => {
    createLedgerMutation.mutate(data);
  };

  const onEditSubmit = (data: z.infer<typeof ledgerFormSchema>) => {
    editLedgerMutation.mutate(data);
  };


  // Edit form setup
  const editForm = useForm<z.infer<typeof ledgerFormSchema>>({
    resolver: zodResolver(ledgerFormSchema),
    defaultValues: {
      date: '',
      notes: '',
      lines: [{ item: '', category: 'Materials', amount: '0', paymentMethod: 'cash', quantity: '', unit: '', supplierId: '', note: '' }],
    },
  });

  const { fields: editFields, append: editAppend, remove: editRemove } = useFieldArray({
    control: editForm.control,
    name: "lines"
  });

  // Populate edit form when editing ledger is selected
  useEffect(() => {
    if (editingLedger && isEditDialogOpen) {
      const ledgerDate = editingLedger.date instanceof Date 
        ? editingLedger.date.toISOString().split('T')[0]
        : new Date(editingLedger.date).toISOString().split('T')[0];
      
      editForm.reset({
        date: ledgerDate,
        notes: editingLedger.notes || '',
        lines: editingLedger.lines.length > 0 ? editingLedger.lines.map(line => ({
          item: line.item,
          category: line.category as any,
          amount: line.amount,
          paymentMethod: line.paymentMethod as any,
          quantity: line.quantity || '',
          unit: line.unit || '',
          supplierId: line.supplierId || '',
          note: line.note || '',
        })) : [{ item: '', category: 'Materials', amount: '', paymentMethod: 'cash', quantity: '', unit: '', supplierId: '', note: '' }],
      });
    }
  }, [editingLedger, isEditDialogOpen, editForm]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    form.setValue('date', newDate);
  };

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      maximumFractionDigits: 0,
    }).format(numAmount);
  };

  const getDayName = (dateValue: string | Date) => {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const getTodaysLedger = () => {
    const today = new Date().toISOString().split('T')[0];
    return ledgers.find(ledger => {
      const ledgerDate = ledger.date instanceof Date 
        ? ledger.date.toISOString().split('T')[0]
        : new Date(ledger.date).toISOString().split('T')[0];
      return ledgerDate === today;
    });
  };

  const todaysLedger = getTodaysLedger();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="daily-ledgers" className="flex items-center gap-2">
          <Book className="w-4 h-4" />
          Daily Ledgers
        </TabsTrigger>
        <TabsTrigger value="historical-expenses" className="flex items-center gap-2">
          <History className="w-4 h-4" />
          Historical Expenses
        </TabsTrigger>
      </TabsList>

      <TabsContent value="daily-ledgers" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Daily Financial Ledgers</h2>
        <div className="flex gap-3">
          {/* Cash Deposit Button - Owner Only */}

          {/* Daily Ledger Button - Both roles can create ledgers */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-brand">
                  <Plus className="w-4 h-4 mr-2" />
                  New Ledger Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card-bg border border-white/10 max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-white">Create Daily Ledger</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                className="bg-dark-bg border-white/20 text-white h-12"
                                onChange={(e) => {
                                  field.onChange(e);
                                  handleDateChange(e.target.value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div>
                        <Label className="text-white">Opening Cash Balance (UGX)</Label>
                        <div className="bg-brand/10 border border-brand/20 p-3 rounded-md">
                          <div className="text-brand font-semibold text-lg">
                            {openingBalanceInfo ? formatCurrency(openingBalanceInfo.openingBalance) : 'Loading...'}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {openingBalanceInfo && (
                              <>
                                Last closing: {openingBalanceInfo.lastClosingBalance ? formatCurrency(openingBalanceInfo.lastClosingBalance) : 'None'} 
                                {openingBalanceInfo.cashDepositsTotal > 0 && 
                                  ` + Deposits: ${formatCurrency(openingBalanceInfo.cashDepositsTotal)}`
                                }
                              </>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-green-400 mt-1">
                          ✓ Automatically calculated - cannot be edited
                        </p>
                      </div>
                    </div>

                    {/* Line Items */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <Label className="text-white font-medium">Daily Items</Label>
                        <Button
                          type="button"
                          onClick={() => append({ item: '', category: 'Materials', amount: '0', paymentMethod: 'cash', quantity: '', unit: '', supplierId: '', note: '' })}
                          className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300"
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Item
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {fields.map((field, index) => (
                          <Card key={field.id} className="bg-white/5 border border-white/10">
                            <CardContent className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-14 gap-4 md:gap-2 items-end">
                                <div className="col-span-1 md:col-span-3">
                                  <FormField
                                    control={form.control}
                                    name={`lines.${index}.item`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-white text-xs">Item</FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...field} 
                                            className="bg-dark-bg border-white/20 text-white text-sm h-12"
                                            placeholder="e.g., Labor, Cement"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                
                                <div className="col-span-1 md:col-span-2">
                                  <FormField
                                    control={form.control}
                                    name={`lines.${index}.category`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-white text-xs">Category</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger className="bg-dark-bg border-white/20 text-white text-sm h-12">
                                              <SelectValue />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent className="bg-card-bg border-white/20">
                                            <SelectItem value="Materials" className="text-white">Materials</SelectItem>
                                            <SelectItem value="Labor" className="text-white">Labor</SelectItem>
                                            <SelectItem value="Equipment" className="text-white">Equipment</SelectItem>
                                            <SelectItem value="Transport" className="text-white">Transport</SelectItem>
                                            <SelectItem value="Food" className="text-white">Food</SelectItem>
                                            <SelectItem value="Other" className="text-white">Other</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                
                                <div className="col-span-1 md:col-span-2">
                                  <FormField
                                    control={form.control}
                                    name={`lines.${index}.amount`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-white text-xs">Amount</FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...field} 
                                            type="number"
                                            min="0"
                                            className="bg-dark-bg border-white/20 text-white text-sm h-12"
                                            placeholder="0"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                
                                <div className="col-span-1 md:col-span-1">
                                  <FormField
                                    control={form.control}
                                    name={`lines.${index}.quantity`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-white text-xs">Qty</FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...field} 
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="bg-dark-bg border-white/20 text-white text-sm h-12"
                                            placeholder="0"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                
                                <div className="col-span-1 md:col-span-1">
                                  <FormField
                                    control={form.control}
                                    name={`lines.${index}.unit`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-white text-xs">Unit</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger className="bg-dark-bg border-white/20 text-white text-sm h-12">
                                              <SelectValue placeholder="Unit" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent className="bg-card-bg border-white/20">
                                            <SelectItem value="bags" className="text-white">Bags</SelectItem>
                                            <SelectItem value="pieces" className="text-white">Pieces</SelectItem>
                                            <SelectItem value="liters" className="text-white">Liters</SelectItem>
                                            <SelectItem value="kg" className="text-white">Kg</SelectItem>
                                            <SelectItem value="tons" className="text-white">Tons</SelectItem>
                                            <SelectItem value="hours" className="text-white">Hours</SelectItem>
                                            <SelectItem value="days" className="text-white">Days</SelectItem>
                                            <SelectItem value="trips" className="text-white">Trips</SelectItem>
                                            <SelectItem value="loads" className="text-white">Loads</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                
                                <div className="col-span-1 md:col-span-2">
                                  <FormField
                                    control={form.control}
                                    name={`lines.${index}.paymentMethod`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-white text-xs">Payment</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger className="bg-dark-bg border-white/20 text-white text-sm h-12">
                                              <SelectValue />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent className="bg-card-bg border-white/20">
                                            <SelectItem value="cash" className="text-white">Cash</SelectItem>
                                            <SelectItem value="supplier" className="text-white">Supplier</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                
                                <div className="col-span-1 md:col-span-2">
                                  <FormField
                                    control={form.control}
                                    name={`lines.${index}.note`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-white text-xs">Note</FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...field} 
                                            className="bg-dark-bg border-white/20 text-white text-sm h-12"
                                            placeholder="Optional"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                
                                <div className="col-span-1 md:col-span-1">
                                  {fields.length > 1 && (
                                    <Button
                                      type="button"
                                      onClick={() => remove(index)}
                                      variant="outline"
                                      size="sm"
                                      className="w-full border-red-600/40 text-red-400 hover:bg-red-600/20"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              
                              {/* Conditional supplier selection row */}
                              {form.watch(`lines.${index}.paymentMethod`) === 'supplier' && (
                                <div className="mt-4 pt-4 border-t border-white/10">
                                  <div className="grid grid-cols-1 gap-2">
                                    <FormField
                                      control={form.control}
                                      name={`lines.${index}.supplierId`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-white text-xs">Select Supplier</FormLabel>
                                          <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                              <SelectTrigger className="bg-dark-bg border-white/20 text-white text-sm h-12">
                                                <SelectValue placeholder="Choose supplier..." />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-card-bg border-white/20">
                                              {suppliers.length > 0 ? (
                                                suppliers.map((supplier) => (
                                                  <SelectItem key={supplier.id} value={supplier.id} className="text-white">
                                                    {supplier.name}
                                                  </SelectItem>
                                                ))
                                              ) : (
                                                <SelectItem value="" disabled className="text-gray-400">
                                                  No suppliers available
                                                </SelectItem>
                                              )}
                                            </SelectContent>
                                          </Select>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              className="bg-dark-bg border-white/20 text-white resize-none"
                              rows={3}
                              placeholder="Optional notes about today's work"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                        className="flex-1 border-white/20 text-white hover:bg-white/5 h-12"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createLedgerMutation.isPending}
                        className="flex-1 btn-brand h-12"
                      >
                        {createLedgerMutation.isPending ? "Creating..." : "Create Ledger"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-card-bg border border-white/10 max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">Edit Daily Ledger</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Date</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="date"
                            disabled
                            className="bg-gray-700 border-white/20 text-gray-400"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div>
                    <Label className="text-white">Opening Cash Balance (UGX)</Label>
                    <div className="bg-brand/10 border border-brand/20 p-3 rounded-md">
                      <div className="text-brand font-semibold text-lg">
                        {editingLedger ? formatCurrency(editingLedger.openingCash) : 'Loading...'}
                      </div>
                    </div>
                    <p className="text-xs text-green-400 mt-1">
                      ✓ Automatically calculated - cannot be edited
                    </p>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-white font-medium">Daily Items</Label>
                    <Button
                      type="button"
                      onClick={() => editAppend({ item: '', category: 'Materials', amount: '0', paymentMethod: 'cash', quantity: '', unit: '', supplierId: '', note: '' })}
                      className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {editFields.map((field, index) => (
                      <Card key={field.id} className="bg-dark-bg/50 border border-white/10 p-4">
                        <CardContent className="p-0">
                          <div className="grid grid-cols-1 md:grid-cols-14 gap-4 md:gap-2 items-end">
                            <div className="col-span-1 md:col-span-3">
                              <FormField
                                control={editForm.control}
                                name={`lines.${index}.item`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-white text-xs">Item</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        className="bg-dark-bg border-white/20 text-white text-sm h-12"
                                        placeholder="e.g., Cement bags"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="col-span-1 md:col-span-2">
                              <FormField
                                control={editForm.control}
                                name={`lines.${index}.category`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-white text-xs">Category</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="bg-dark-bg border-white/20 text-white text-sm h-12">
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent className="bg-card-bg border-white/20">
                                        <SelectItem value="Materials" className="text-white">Materials</SelectItem>
                                        <SelectItem value="Labor" className="text-white">Labor</SelectItem>
                                        <SelectItem value="Equipment" className="text-white">Equipment</SelectItem>
                                        <SelectItem value="Transport" className="text-white">Transport</SelectItem>
                                        <SelectItem value="Food" className="text-white">Food</SelectItem>
                                        <SelectItem value="Other" className="text-white">Other</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="col-span-1 md:col-span-2">
                              <FormField
                                control={editForm.control}
                                name={`lines.${index}.amount`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-white text-xs">Amount</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        type="number"
                                        min="0"
                                        className="bg-dark-bg border-white/20 text-white text-sm h-12"
                                        placeholder="0"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="col-span-1 md:col-span-1">
                              <FormField
                                control={editForm.control}
                                name={`lines.${index}.quantity`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-white text-xs">Qty</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="bg-dark-bg border-white/20 text-white text-sm h-12"
                                        placeholder="0"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="col-span-1 md:col-span-1">
                              <FormField
                                control={editForm.control}
                                name={`lines.${index}.unit`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-white text-xs">Unit</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="bg-dark-bg border-white/20 text-white text-sm h-12">
                                          <SelectValue placeholder="Unit" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent className="bg-card-bg border-white/20">
                                        <SelectItem value="bags" className="text-white">Bags</SelectItem>
                                        <SelectItem value="pieces" className="text-white">Pieces</SelectItem>
                                        <SelectItem value="liters" className="text-white">Liters</SelectItem>
                                        <SelectItem value="kg" className="text-white">Kg</SelectItem>
                                        <SelectItem value="tons" className="text-white">Tons</SelectItem>
                                        <SelectItem value="hours" className="text-white">Hours</SelectItem>
                                        <SelectItem value="days" className="text-white">Days</SelectItem>
                                        <SelectItem value="trips" className="text-white">Trips</SelectItem>
                                        <SelectItem value="loads" className="text-white">Loads</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="col-span-1 md:col-span-2">
                              <FormField
                                control={editForm.control}
                                name={`lines.${index}.paymentMethod`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-white text-xs">Payment</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="bg-dark-bg border-white/20 text-white text-sm h-12">
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent className="bg-card-bg border-white/20">
                                        <SelectItem value="cash" className="text-white">Cash</SelectItem>
                                        <SelectItem value="supplier" className="text-white">Supplier</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="col-span-1 md:col-span-2">
                              <FormField
                                control={editForm.control}
                                name={`lines.${index}.note`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-white text-xs">Note</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        className="bg-dark-bg border-white/20 text-white text-sm h-12"
                                        placeholder="Optional"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="col-span-1">
                              {editFields.length > 1 && (
                                <Button
                                  type="button"
                                  onClick={() => editRemove(index)}
                                  variant="outline"
                                  size="sm"
                                  className="w-full border-red-600/40 text-red-400 hover:bg-red-600/20"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {/* Conditional supplier selection row */}
                          {editForm.watch(`lines.${index}.paymentMethod`) === 'supplier' && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                              <div className="grid grid-cols-1 gap-2">
                                <FormField
                                  control={editForm.control}
                                  name={`lines.${index}.supplierId`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-white text-xs">Select Supplier</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger className="bg-dark-bg border-white/20 text-white text-sm h-12">
                                            <SelectValue placeholder="Choose supplier..." />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="bg-card-bg border-white/20">
                                          {suppliers.length > 0 ? (
                                            suppliers.map((supplier) => (
                                              <SelectItem key={supplier.id} value={supplier.id} className="text-white">
                                                {supplier.name}
                                              </SelectItem>
                                            ))
                                          ) : (
                                            <SelectItem value="" disabled className="text-gray-400">
                                              No suppliers available
                                            </SelectItem>
                                          )}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <FormField
                  control={editForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          className="bg-dark-bg border-white/20 text-white resize-none"
                          rows={3}
                          placeholder="Optional notes about today's work"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingLedger(null);
                    }}
                    className="flex-1 border-white/20 text-white hover:bg-white/5"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={editLedgerMutation.isPending}
                    className="flex-1 btn-brand"
                  >
                    {editLedgerMutation.isPending ? "Updating..." : "Update Ledger"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Cash Deposits Summary */}

      {/* Ledger Entries */}
      <div className="space-y-4">
        {ledgers.length === 0 ? (
          <Card className="bg-card-bg border border-white/10">
            <CardContent className="py-12 text-center">
              <Book className="w-12 h-12 mx-auto text-gray-500 mb-4" />
              <p className="text-gray-400">No daily ledgers yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Start by creating your first daily financial record
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Today's Status */}
            {todaysLedger ? (
              <Card className="bg-green-600/10 border border-green-600/20">
                <CardHeader>
                  <CardTitle className="text-green-400 flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    Today's Ledger Complete
                  </CardTitle>
                </CardHeader>
              </Card>
            ) : userRole === "Manager" && (
              <Card className="bg-yellow-600/10 border border-yellow-600/20">
                <CardHeader>
                  <CardTitle className="text-yellow-400 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Today's Ledger Pending
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 text-sm">
                    Don't forget to submit your daily financial record before end of day.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Ledger List */}
            {ledgers.map((ledger) => (
              <Card key={ledger.id} className="bg-card-bg border border-white/10">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-white text-lg">
                      {getDayName(ledger.date.toString())}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {userRole === "Manager" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingLedger(ledger);
                            setIsEditDialogOpen(true);
                          }}
                          className="border-ocean-pine/30 text-ocean-pine hover:bg-ocean-pine/15"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                      <span className="text-sm text-gray-400">
                        {ledger.submittedAt ? 'Submitted' : 'Draft'}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Opening Cash</span>
                      <span className="text-sm font-medium text-white">
                        {formatCurrency(ledger.openingCash)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Cash Spent</span>
                      <span className="text-sm font-medium text-red-400">
                        -{formatCurrency(ledger.totalCashSpent)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Supplier Spent</span>
                      <span className="text-sm font-medium text-ocean-pine">
                        -{formatCurrency(ledger.totalSupplierSpent)}
                      </span>
                    </div>
                    <div className="border-t border-white/10 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-white">Closing Cash</span>
                        <span className="text-sm font-bold text-green-400">
                          {formatCurrency(ledger.closingCash)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Daily Items */}
                  {ledger.lines && ledger.lines.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase">Daily Items</h4>
                      {ledger.lines.map((line, index) => (
                        <div key={index} className="text-sm text-white">
                          • {line.item}: {formatCurrency(line.amount)}
                          {line.quantity && line.unit && (
                            <span className="text-gray-300 ml-1">
                              ({line.quantity} {line.unit})
                            </span>
                          )}
                          {line.paymentMethod === 'supplier' && (
                            <span className="text-ocean-pine/90 ml-1">(Supplier)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {ledger.notes && (
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-xs text-muted-foreground italic">{ledger.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
      </TabsContent>

      <TabsContent value="historical-expenses">
        <BulkHistoricalEntry projectId={projectId} />
      </TabsContent>
    </Tabs>
  );
}