export type UserRole = 'owner' | 'manager' | 'viewer';

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type PaymentMethod = 'cash' | 'supplier';

export type ExpenseCategory = 'Materials' | 'Labor' | 'Equipment' | 'Transport' | 'Food' | 'Other';

export interface ProjectAnalytics {
  totalBudget: number;
  totalSpent: number;
  totalCashSpent: number;
  totalSupplierSpent: number;
  cashBalance: number;
  categoryBreakdown: Record<string, number>;
}
