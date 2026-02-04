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
import { Plus, Package, Edit, Warehouse, Building, BarChart3 } from "lucide-react";
import { insertInventorySchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Inventory } from "@shared/schema";
import { z } from "zod";

interface InventoryManagementProps {
  projectId: string;
}

const deliveryFormSchema = insertInventorySchema.omit({ remaining: true });
const usageFormSchema = z.object({
  invId: z.string().min(1, "Please select an inventory item"),
  qty: z.string().min(1, "Usage quantity is required"),
});

export default function InventoryManagement({ projectId }: InventoryManagementProps) {
  const [isDeliveryDialogOpen, setIsDeliveryDialogOpen] = useState(false);
  const [isUsageDialogOpen, setIsUsageDialogOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<'all' | 'hardware' | 'on-site'>('all');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: inventory = [], isLoading } = useQuery<Inventory[]>({
    queryKey: ['/api/projects', projectId, 'inventory', selectedLocation === 'all' ? undefined : selectedLocation],
    queryFn: async () => {
      const url = selectedLocation === 'all' 
        ? `/api/projects/${projectId}/inventory`
        : `/api/projects/${projectId}/inventory?location=${selectedLocation}`;
      const response = await apiRequest('GET', url);
      return response.json();
    },
    enabled: !!projectId,
  });

  // Inventory analytics query
  const { data: inventoryAnalytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'inventory', 'analytics'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/projects/${projectId}/inventory/analytics`);
      return response.json();
    },
    enabled: !!projectId && showAnalytics,
  });

  const createDeliveryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof deliveryFormSchema>) => {
      const inventoryData = {
        ...data,
        remaining: data.quantity,
        deliveryDate: new Date(data.deliveryDate),
      };
      await apiRequest('POST', '/api/inventory', inventoryData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'inventory'] });
      toast({
        title: "Success",
        description: "Delivery recorded successfully",
      });
      setIsDeliveryDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record delivery",
        variant: "destructive",
      });
    },
  });

  const updateUsageMutation = useMutation({
    mutationFn: async ({ invId, usedQty }: { invId: string; usedQty: number }) => {
      const item = inventory.find(i => i.id === invId);
      if (!item) throw new Error('Item not found');
      
      const newUsed = item.used + usedQty;
      const newRemaining = item.quantity - newUsed;
      
      if (newRemaining < 0) {
        throw new Error('Cannot use more than available quantity');
      }
      
      await apiRequest('PUT', `/api/inventory/${invId}`, {
        used: newUsed,
        remaining: newRemaining,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'inventory'] });
      toast({
        title: "Success",
        description: "Usage recorded successfully",
      });
      setIsUsageDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record usage",
        variant: "destructive",
      });
    },
  });

  const deliveryForm = useForm<z.infer<typeof deliveryFormSchema>>({
    resolver: zodResolver(deliveryFormSchema),
    defaultValues: {
      projectId,
      item: '',
      quantity: 0,
      used: 0,
      deliveryDate: new Date(),
    },
  });

  const usageForm = useForm<z.infer<typeof usageFormSchema>>({
    resolver: zodResolver(usageFormSchema),
    defaultValues: {
      invId: '',
      qty: '',
    },
  });

  const onDeliverySubmit = (data: z.infer<typeof deliveryFormSchema>) => {
    createDeliveryMutation.mutate(data);
  };

  const onUsageSubmit = (data: z.infer<typeof usageFormSchema>) => {
    updateUsageMutation.mutate({
      invId: data.invId,
      usedQty: parseInt(data.qty),
    });
  };

  const getStockStatus = (item: Inventory) => {
    const percentage = item.quantity > 0 ? (item.remaining / item.quantity) * 100 : 0;
    if (percentage === 0) return 'out-of-stock';
    if (percentage <= 20) return 'low-stock';
    return 'in-stock';
  };

  const getStockColor = (status: string) => {
    switch (status) {
      case 'out-of-stock':
        return 'text-red-400';
      case 'low-stock':
        return 'text-yellow-400';
      case 'in-stock':
        return 'text-green-400';
      default:
        return 'text-white';
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
        <h2 className="text-2xl font-bold text-white">Inventory Management</h2>
        <div className="flex items-center gap-3">
          {/* Location Filter */}
          <Select value={selectedLocation} onValueChange={(value: 'all' | 'hardware' | 'on-site') => setSelectedLocation(value)}>
            <SelectTrigger className="bg-dark-bg border-white/20 text-white w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="hardware">Hardware</SelectItem>
              <SelectItem value="on-site">On-Site</SelectItem>
            </SelectContent>
          </Select>

          {/* Analytics Toggle */}
          <Button
            onClick={() => setShowAnalytics(!showAnalytics)}
            variant={showAnalytics ? "secondary" : "outline"}
            className={showAnalytics 
              ? "bg-brand/20 hover:bg-brand/30 border border-brand/40 text-brand" 
              : "bg-dark-bg/50 hover:bg-dark-bg/70 border border-white/20 text-white"
            }
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
          <Dialog open={isDeliveryDialogOpen} onOpenChange={setIsDeliveryDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300">
                <Plus className="w-4 h-4 mr-2" />
                Log Delivery
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card-bg border border-white/10 max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">Log Material Delivery</DialogTitle>
              </DialogHeader>
              <Form {...deliveryForm}>
                <form onSubmit={deliveryForm.handleSubmit(onDeliverySubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={deliveryForm.control}
                      name="item"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Item</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              className="bg-dark-bg border-white/20 text-white h-12"
                              placeholder="e.g., Cement (bags)"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={deliveryForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Quantity</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number"
                              min="0"
                              className="bg-dark-bg border-white/20 text-white h-12"
                              placeholder="0"
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={deliveryForm.control}
                    name="deliveryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Delivery Date</FormLabel>
                        <FormControl>
                          <Input 
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

                  <div className="flex justify-end gap-3">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setIsDeliveryDialogOpen(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="btn-brand"
                      disabled={createDeliveryMutation.isPending}
                    >
                      {createDeliveryMutation.isPending ? 'Recording...' : 'Record Delivery'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isUsageDialogOpen} onOpenChange={setIsUsageDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-ocean-pine/15 hover:bg-ocean-pine/20 border border-ocean-pine/30 text-ocean-pine">
                <Edit className="w-4 h-4 mr-2" />
                Log Usage
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card-bg border border-white/10 max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">Log Material Usage</DialogTitle>
              </DialogHeader>
              <Form {...usageForm}>
                <form onSubmit={usageForm.handleSubmit(onUsageSubmit)} className="space-y-4">
                  <FormField
                    control={usageForm.control}
                    name="invId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Inventory Item</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-dark-bg border-white/20 text-white h-12">
                              <SelectValue placeholder="Select item to use" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card-bg border-white/20">
                            {inventory.filter(i => i.remaining > 0).map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.item} (remaining: {item.remaining})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={usageForm.control}
                    name="qty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Used Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number"
                            min="1"
                            className="bg-dark-bg border-white/20 text-white h-12"
                            placeholder="0"
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
                      onClick={() => setIsUsageDialogOpen(false)}
                      className="btn-secondary h-12"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="btn-brand h-12"
                      disabled={updateUsageMutation.isPending}
                    >
                      {updateUsageMutation.isPending ? 'Recording...' : 'Record Usage'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Analytics Section */}
      {showAnalytics && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <Card className="card-glass">
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  Loading inventory analytics...
                </div>
              </CardContent>
            </Card>
          ) : inventoryAnalytics && (
            <>
              {/* Hardware vs On-Site Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="card-glass">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                      <Warehouse className="w-5 h-5" />
                      Hardware Inventory
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {inventoryAnalytics.hardwareItems.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No hardware inventory recorded</p>
                      ) : (
                        inventoryAnalytics.hardwareItems.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-white/10 last:border-0">
                            <span className="text-white text-sm">{item.item}</span>
                            <div className="text-right">
                              <div className="text-green-400 font-medium text-sm">
                                {item.totalRemaining} / {item.totalQuantity}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.locations} location{item.locations !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                      <Building className="w-5 h-5" />
                      On-Site Inventory
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {inventoryAnalytics.onSiteItems.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No on-site inventory recorded</p>
                      ) : (
                        inventoryAnalytics.onSiteItems.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-white/10 last:border-0">
                            <span className="text-white text-sm">{item.item}</span>
                            <div className="text-right">
                              <div className="text-ocean-pine font-medium text-sm">
                                {item.totalRemaining} / {item.totalQuantity}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.locations} location{item.locations !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Summary Stats */}
              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white">Inventory Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {inventoryAnalytics.hardwareItems.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Hardware Items</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-heading font-bold text-ocean-pine">
                        {inventoryAnalytics.onSiteItems.length}
                      </div>
                      <div className="text-sm text-muted-foreground">On-Site Items</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">
                        {inventoryAnalytics.hardwareItems.reduce((sum: number, item: any) => sum + item.totalQuantity, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Hardware Units</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">
                        {inventoryAnalytics.onSiteItems.reduce((sum: number, item: any) => sum + item.totalQuantity, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Total On-Site Units</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Stock Levels Table */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Stock Levels</CardTitle>
        </CardHeader>
        <CardContent>
          {inventory.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No inventory items recorded yet. Log your first delivery to start tracking stock levels.
              </p>
              <Button 
                onClick={() => setIsDeliveryDialogOpen(true)}
                className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300"
              >
                <Plus className="w-4 h-4 mr-2" />
                Log First Delivery
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Item</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Delivered</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Used</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Remaining</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Delivery Date</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {inventory.map((item) => {
                    const status = getStockStatus(item);
                    const percentage = item.quantity > 0 ? (item.remaining / item.quantity) * 100 : 0;
                    
                    return (
                      <tr key={item.id}>
                        <td className="py-4 px-2 text-sm text-white font-medium">{item.item}</td>
                        <td className="py-4 px-2 text-sm text-white">{item.quantity}</td>
                        <td className="py-4 px-2 text-sm text-white">{item.used}</td>
                        <td className="py-4 px-2 text-sm text-white">{item.remaining}</td>
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              status === 'in-stock' ? 'bg-green-400' :
                              status === 'low-stock' ? 'bg-yellow-400' : 'bg-red-400'
                            }`}></div>
                            <span className={`text-xs font-medium ${getStockColor(status)}`}>
                              {status === 'in-stock' ? 'In Stock' :
                               status === 'low-stock' ? 'Low Stock' : 'Out of Stock'}
                            </span>
                          </div>
                          {item.quantity > 0 && (
                            <div className="w-20 bg-white/10 rounded-full h-1.5 mt-1">
                              <div 
                                className={`h-1.5 rounded-full transition-all ${
                                  status === 'in-stock' ? 'bg-green-400' :
                                  status === 'low-stock' ? 'bg-yellow-400' : 'bg-red-400'
                                }`}
                                style={{ width: `${Math.max(percentage, 2)}%` }}
                              ></div>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-2 text-sm text-muted-foreground">
                          {new Date(item.deliveryDate).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-2">
                          {item.remaining > 0 && (
                            <Button
                              onClick={() => {
                                usageForm.setValue('invId', item.id);
                                setIsUsageDialogOpen(true);
                              }}
                              size="sm"
                              className="bg-ocean-pine/15 hover:bg-ocean-pine/20 border border-ocean-pine/30 text-ocean-pine text-xs px-2 py-1"
                            >
                              Use
                            </Button>
                          )}
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
