import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Form validation schema
const expenseFormSchema = z.object({
  description: z
    .string()
    .min(1, "Description is required")
    .min(3, "Description must be at least 3 characters")
    .max(255, "Description must be less than 255 characters"),
  amount: z
    .number({
      required_error: "Amount is required",
      invalid_type_error: "Amount must be a number",
    })
    .positive("Amount must be greater than 0")
    .max(999999999, "Amount is too large"),
  category_id: z.string().optional(),
  expense_date: z.date({
    required_error: "Expense date is required",
  }),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface Category {
  id: string;
  name: string;
  colorHex: string | null;
}

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddExpenseDialog({
  open,
  onOpenChange,
}: AddExpenseDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Fetch categories from API
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<{
    success: boolean;
    categories: Category[];
  }>({
    queryKey: ["/api/categories"],
    enabled: open, // Only fetch when dialog is open
  });

  const categories = categoriesData?.categories || [];

  // Initialize form
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: "",
      amount: undefined,
      category_id: undefined,
      expense_date: new Date(), // Default to today
    },
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          description: values.description,
          amount: values.amount,
          category_id: values.category_id || undefined,
          expense_date: values.expense_date.toISOString(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create expense");
      }

      return await res.json();
    },
    onSuccess: (data) => {
      console.log("[AddExpense] Expense created successfully:", data.expense);

      // Show success toast
      toast({
        title: "Expense added!",
        description: `${data.expense.description} - UGX ${data.expense.amount.toLocaleString()}`,
      });

      // Invalidate queries to refresh the lists
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });

      // Reset form and close dialog
      form.reset({
        description: "",
        amount: undefined,
        category_id: undefined,
        expense_date: new Date(),
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("[AddExpense] Error creating expense:", error);
      toast({
        title: "Failed to add expense",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = async (values: ExpenseFormValues) => {
    console.log("[AddExpense] Submitting form:", values);
    await createExpenseMutation.mutateAsync(values);
  };

  // Handle dialog close (reset form if needed)
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !createExpenseMutation.isPending) {
      // Reset form when closing (only if not submitting)
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-white/20">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            Add Expense
          </DialogTitle>
          <DialogDescription>
            Record a new expense for your project. All fields marked with * are
            required.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Description Field */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">
                    Description <span className="text-red-400">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Cement for foundation"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                      {...field}
                      disabled={createExpenseMutation.isPending}
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-muted-foreground">
                    What did you spend money on?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount Field */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">
                    Amount (UGX) <span className="text-red-400">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 50000"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value ? parseFloat(value) : undefined);
                      }}
                      value={field.value ?? ""}
                      disabled={createExpenseMutation.isPending}
                      min="0"
                      step="1"
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-muted-foreground">
                    Enter the amount in Ugandan Shillings
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category Field */}
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={
                      categoriesLoading || createExpenseMutation.isPending
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Select a category (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card border-white/20">
                      {categories.map((category) => (
                        <SelectItem
                          key={category.id}
                          value={category.id}
                          className="text-white hover:bg-white/10"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor:
                                  category.colorHex || "#3B82F6",
                              }}
                            />
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs text-muted-foreground">
                    {categoriesLoading
                      ? "Loading categories..."
                      : "Optional: Categorize this expense"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date Field */}
            <FormField
              control={form.control}
              name="expense_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-white">
                    Expense Date <span className="text-red-400">*</span>
                  </FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20",
                            !field.value && "text-white/60"
                          )}
                          disabled={createExpenseMutation.isPending}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-white/20" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date);
                          setIsCalendarOpen(false);
                        }}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                        className="bg-card text-white"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription className="text-xs text-muted-foreground">
                    When was this expense made?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Form Actions */}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={createExpenseMutation.isPending}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createExpenseMutation.isPending}
                className="btn-brand min-h-[44px]"
              >
                {createExpenseMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Expense"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

