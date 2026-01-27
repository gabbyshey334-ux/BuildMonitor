import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  DollarSign, 
  User, 
  Bell, 
  Settings as SettingsIcon, 
  Shield, 
  Palette,
  Save,
  AlertTriangle,
  Phone,
  Mail
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertUserPreferencesSchema } from "@shared/schema";
import type { UserPreferences } from "@shared/schema";
import { z } from "zod";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

// Form schema
const settingsFormSchema = insertUserPreferencesSchema.extend({
  customExpenseCategories: z.array(z.string()).default(['Materials', 'Labor', 'Transport', 'Other']),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState('financial');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch user preferences
  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ['/api/user-preferences'],
    enabled: isOpen,
  });

  // Form setup
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      showDecimals: false,
      currencyFormat: 'UGX 1,500,000',
      budgetWarningThreshold: 80,
      budgetCriticalThreshold: 90,
      defaultPaymentMethod: 'cash',
      defaultCurrency: 'UGX',
      customExpenseCategories: ['Materials', 'Labor', 'Transport', 'Other'],
      emailAlerts: true,
      emailAddress: '',
      whatsappNumber: '',
      fullName: '',
      phoneNumber: '',
    },
  });

  // Update form when preferences are loaded
  useEffect(() => {
    if (preferences) {
      form.reset({
        ...preferences,
        customExpenseCategories: preferences.customExpenseCategories || ['Materials', 'Labor', 'Transport', 'Other'],
      });
    }
  }, [preferences, form]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      await apiRequest('PUT', '/api/user-preferences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-preferences'] });
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    saveSettingsMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-card-bg border border-white/10 max-w-4xl max-h-[80vh]">
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading settings...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const tabs = [
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'project', label: 'Project', icon: SettingsIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card-bg border border-white/10 max-w-5xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-6 h-[70vh]">
          {/* Sidebar */}
          <div className="w-48 space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-brand/20 text-brand border border-brand/40'
                      : 'text-muted-foreground hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Financial Settings */}
                {activeTab === 'financial' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">Financial Preferences</h3>
                      
                      <Card className="card-glass">
                        <CardHeader>
                          <CardTitle className="text-sm font-medium text-white">Currency Display</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField
                            control={form.control}
                            name="showDecimals"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between">
                                <FormLabel className="text-white">Show decimal places</FormLabel>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="currencyFormat"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white">Currency Format</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="bg-dark-bg border-white/20 text-white">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="UGX 1,500,000">UGX 1,500,000</SelectItem>
                                    <SelectItem value="1500000 UGX">1500000 UGX</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>

                      <Card className="card-glass">
                        <CardHeader>
                          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Budget Alerts
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField
                            control={form.control}
                            name="budgetWarningThreshold"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white">Warning Threshold (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="50"
                                    max="100"
                                    {...field}
                                    className="bg-dark-bg border-white/20 text-white"
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="budgetCriticalThreshold"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white">Critical Threshold (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="50"
                                    max="100"
                                    {...field}
                                    className="bg-dark-bg border-white/20 text-white"
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>

                      <Card className="card-glass">
                        <CardHeader>
                          <CardTitle className="text-sm font-medium text-white">Default Payment Method</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <FormField
                            control={form.control}
                            name="defaultPaymentMethod"
                            render={({ field }) => (
                              <FormItem>
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
                                    <SelectItem value="supplier">Supplier Credit</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Profile Settings */}
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Profile Information</h3>
                    
                    <Card className="card-glass">
                      <CardContent className="space-y-4 pt-6">
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white">Full Name</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Enter your full name"
                                  className="bg-dark-bg border-white/20 text-white"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white">Phone Number</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="+256 XXX XXX XXX"
                                  className="bg-dark-bg border-white/20 text-white"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Project Preferences */}
                {activeTab === 'project' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Project Preferences</h3>
                    
                    <Card className="card-glass">
                      <CardContent className="space-y-4 pt-6">
                        <FormField
                          control={form.control}
                          name="defaultCurrency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white">Default Currency</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-dark-bg border-white/20 text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="UGX">Ugandan Shilling (UGX)</SelectItem>
                                  <SelectItem value="USD">US Dollar (USD)</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Notifications */}
                {activeTab === 'notifications' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Notification Preferences</h3>
                    
                    <Card className="card-glass">
                      <CardContent className="space-y-4 pt-6">
                        <FormField
                          control={form.control}
                          name="emailAlerts"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel className="text-white">Email Notifications</FormLabel>
                                <p className="text-sm text-muted-foreground">Receive budget alerts and project updates</p>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="emailAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Email Address
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="email"
                                  placeholder="your.email@example.com"
                                  className="bg-dark-bg border-white/20 text-white"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="whatsappNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                WhatsApp Number
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="+256 XXX XXX XXX"
                                  className="bg-dark-bg border-white/20 text-white"
                                />
                              </FormControl>
                              <p className="text-xs text-muted-foreground">For future WhatsApp integration</p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Security */}
                {activeTab === 'security' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Security Settings</h3>
                    
                    <Card className="card-glass">
                      <CardContent className="space-y-4 pt-6">
                        <div className="text-center py-8">
                          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            Security settings are managed through Replit Auth
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Update your password and security settings in your Replit account
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="btn-secondary"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveSettingsMutation.isPending}
                    className="btn-brand"
                  >
                    {saveSettingsMutation.isPending ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Settings
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}