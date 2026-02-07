import { IStorage } from './storage.js';
import { Request, Response } from 'express';
import { z } from 'zod';

const extractedExpenseSchema = z.object({
  type: z.literal('expense'),
  projectId: z.string(),
  whatsappNumber: z.string(),
  item: z.string(),
  amount: z.number().positive(),
  category: z.string().optional().default('Materials'),
  paymentMethod: z.enum(['cash', 'supplier']).optional().default('cash'),
  supplierName: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  note: z.string().optional(),
  date: z.string().optional(),
});

const extractedInventorySchema = z.object({
  type: z.literal('inventory'),
  projectId: z.string(),
  whatsappNumber: z.string(),
  item: z.string(),
  quantity: z.number().positive(),
  unit: z.string().optional().default('pieces'),
  supplierName: z.string().optional(),
  location: z.enum(['hardware', 'on-site']).optional().default('on-site'),
  note: z.string().optional(),
  date: z.string().optional(),
});

const extractedTaskSchema = z.object({
  type: z.literal('task'),
  projectId: z.string(),
  whatsappNumber: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High']).optional().default('Medium'),
  location: z.string().optional(),
  dueDate: z.string().optional(),
});

const extractedCashDepositSchema = z.object({
  type: z.literal('cash_deposit'),
  projectId: z.string(),
  whatsappNumber: z.string(),
  amount: z.number().positive(),
  method: z.string().optional().default('Mobile Money'),
  reference: z.string().optional(),
  note: z.string().optional(),
  date: z.string().optional(),
});

const extractedQuerySchema = z.object({
  type: z.literal('query'),
  projectId: z.string(),
  whatsappNumber: z.string(),
  question: z.string(),
});

const extractedDataSchema = z.discriminatedUnion('type', [
  extractedExpenseSchema,
  extractedInventorySchema,
  extractedTaskSchema,
  extractedCashDepositSchema,
  extractedQuerySchema,
]);

export type ExtractedData = z.infer<typeof extractedDataSchema>;

export interface ExtractedDataResult {
  success: boolean;
  type: string;
  message: string;
  data?: any;
  confirmationMessage: string;
}

export async function handleExtractedData(
  storage: IStorage,
  data: ExtractedData
): Promise<ExtractedDataResult> {
  const today = new Date();
  
  switch (data.type) {
    case 'expense':
      return handleExpense(storage, data, today);
    case 'inventory':
      return handleInventory(storage, data, today);
    case 'task':
      return handleTask(storage, data);
    case 'cash_deposit':
      return handleCashDeposit(storage, data, today);
    case 'query':
      return handleQuery(storage, data);
    default:
      return {
        success: false,
        type: 'unknown',
        message: 'Unknown data type',
        confirmationMessage: "Sorry, I couldn't understand that message. Could you rephrase it?",
      };
  }
}

async function handleExpense(
  storage: IStorage,
  data: z.infer<typeof extractedExpenseSchema>,
  today: Date
): Promise<ExtractedDataResult> {
  try {
    const project = await storage.getProject(data.projectId);
    if (!project) {
      return {
        success: false,
        type: 'expense',
        message: 'Project not found',
        confirmationMessage: "I couldn't find that project. Please check the project ID.",
      };
    }

    const expenseDate = data.date ? new Date(data.date) : today;
    const dateString = expenseDate.toISOString().split('T')[0];
    
    let ledger = await storage.getDailyLedgerByDate(data.projectId, expenseDate);
    
    if (!ledger) {
      const openingCalc = await storage.getCalculatedOpeningBalance(data.projectId, dateString);
      ledger = await storage.createDailyLedger({
        projectId: data.projectId,
        date: expenseDate,
        openingCash: openingCalc.openingBalance.toString(),
        closingCash: openingCalc.openingBalance.toString(),
        totalCashSpent: '0',
        totalSupplierSpent: '0',
      });
    }

    let supplierId: string | undefined;
    if (data.paymentMethod === 'supplier' && data.supplierName) {
      const suppliers = await storage.getSuppliers();
      const existingSupplier = suppliers.find(
        s => s.name.toLowerCase() === data.supplierName!.toLowerCase()
      );
      
      if (existingSupplier) {
        supplierId = existingSupplier.id;
      } else {
        const newSupplier = await storage.createSupplier({
          name: data.supplierName,
          totalDeposited: '0',
          totalSpent: '0',
          currentBalance: '0',
        });
        supplierId = newSupplier.id;
      }
    }

    const line = await storage.createDailyLedgerLine({
      ledgerId: ledger.id,
      item: data.item,
      category: data.category || 'Materials',
      amount: data.amount.toString(),
      paymentMethod: data.paymentMethod || 'cash',
      quantity: data.quantity?.toString(),
      unit: data.unit,
      supplierId,
      note: data.note,
    });

    const formattedAmount = formatUGX(data.amount);
    const paymentInfo = data.paymentMethod === 'supplier' && data.supplierName
      ? ` (via ${data.supplierName})`
      : ' (cash)';
    
    return {
      success: true,
      type: 'expense',
      message: 'Expense recorded successfully',
      data: { ledgerId: ledger.id, lineId: line.id },
      confirmationMessage: `Recorded: ${data.item} - ${formattedAmount}${paymentInfo}${data.quantity ? ` (${data.quantity} ${data.unit || 'pcs'})` : ''}`,
    };
  } catch (error) {
    console.error('Error handling expense:', error);
    return {
      success: false,
      type: 'expense',
      message: error instanceof Error ? error.message : 'Failed to record expense',
      confirmationMessage: "Sorry, there was a problem recording that expense. Please try again.",
    };
  }
}

async function handleInventory(
  storage: IStorage,
  data: z.infer<typeof extractedInventorySchema>,
  today: Date
): Promise<ExtractedDataResult> {
  try {
    const project = await storage.getProject(data.projectId);
    if (!project) {
      return {
        success: false,
        type: 'inventory',
        message: 'Project not found',
        confirmationMessage: "I couldn't find that project. Please check the project ID.",
      };
    }

    const deliveryDate = data.date ? new Date(data.date) : today;

    let supplierId: string | undefined;
    if (data.supplierName) {
      const suppliers = await storage.getSuppliers();
      const existingSupplier = suppliers.find(
        s => s.name.toLowerCase() === data.supplierName!.toLowerCase()
      );
      
      if (existingSupplier) {
        supplierId = existingSupplier.id;
      } else {
        const newSupplier = await storage.createSupplier({
          name: data.supplierName,
          totalDeposited: '0',
          totalSpent: '0',
          currentBalance: '0',
        });
        supplierId = newSupplier.id;
      }
    }

    const inventoryItem = await storage.createInventoryItem({
      projectId: data.projectId,
      item: data.item,
      quantity: data.quantity,
      remaining: data.quantity,
      used: 0,
      unit: data.unit,
      location: data.location || 'on-site',
      deliveryDate,
      supplierId,
    });

    const locationText = data.location === 'hardware' ? 'at hardware' : 'on-site';
    const supplierText = data.supplierName ? ` from ${data.supplierName}` : '';

    return {
      success: true,
      type: 'inventory',
      message: 'Inventory item recorded successfully',
      data: { inventoryId: inventoryItem.id },
      confirmationMessage: `Inventory recorded: ${data.quantity} ${data.unit || 'pcs'} of ${data.item} ${locationText}${supplierText}`,
    };
  } catch (error) {
    console.error('Error handling inventory:', error);
    return {
      success: false,
      type: 'inventory',
      message: error instanceof Error ? error.message : 'Failed to record inventory',
      confirmationMessage: "Sorry, there was a problem recording that inventory. Please try again.",
    };
  }
}

async function handleTask(
  storage: IStorage,
  data: z.infer<typeof extractedTaskSchema>
): Promise<ExtractedDataResult> {
  try {
    const project = await storage.getProject(data.projectId);
    if (!project) {
      return {
        success: false,
        type: 'task',
        message: 'Project not found',
        confirmationMessage: "I couldn't find that project. Please check the project ID.",
      };
    }

    const task = await storage.createTask({
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      priority: data.priority || 'Medium',
      location: data.location,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      completed: false,
    });

    const priorityEmoji = data.priority === 'High' ? '🔴' : data.priority === 'Low' ? '🟢' : '🟡';
    const locationText = data.location ? ` at ${data.location}` : '';

    return {
      success: true,
      type: 'task',
      message: 'Task created successfully',
      data: { taskId: task.id },
      confirmationMessage: `${priorityEmoji} Task added: "${data.title}"${locationText}`,
    };
  } catch (error) {
    console.error('Error handling task:', error);
    return {
      success: false,
      type: 'task',
      message: error instanceof Error ? error.message : 'Failed to create task',
      confirmationMessage: "Sorry, there was a problem creating that task. Please try again.",
    };
  }
}

async function handleCashDeposit(
  storage: IStorage,
  data: z.infer<typeof extractedCashDepositSchema>,
  today: Date
): Promise<ExtractedDataResult> {
  try {
    const project = await storage.getProject(data.projectId);
    if (!project) {
      return {
        success: false,
        type: 'cash_deposit',
        message: 'Project not found',
        confirmationMessage: "I couldn't find that project. Please check the project ID.",
      };
    }

    const depositDate = data.date ? new Date(data.date) : today;

    const deposit = await storage.createCashDeposit({
      projectId: data.projectId,
      amount: data.amount.toString(),
      date: depositDate,
      method: data.method || 'Mobile Money',
      reference: data.reference,
      note: data.note,
    });

    const formattedAmount = formatUGX(data.amount);

    return {
      success: true,
      type: 'cash_deposit',
      message: 'Cash deposit recorded successfully',
      data: { depositId: deposit.id },
      confirmationMessage: `Cash deposit recorded: ${formattedAmount} via ${data.method || 'Mobile Money'}`,
    };
  } catch (error) {
    console.error('Error handling cash deposit:', error);
    return {
      success: false,
      type: 'cash_deposit',
      message: error instanceof Error ? error.message : 'Failed to record cash deposit',
      confirmationMessage: "Sorry, there was a problem recording that deposit. Please try again.",
    };
  }
}

async function handleQuery(
  storage: IStorage,
  data: z.infer<typeof extractedQuerySchema>
): Promise<ExtractedDataResult> {
  try {
    const project = await storage.getProject(data.projectId);
    if (!project) {
      return {
        success: false,
        type: 'query',
        message: 'Project not found',
        confirmationMessage: "I couldn't find that project. Please check the project ID.",
      };
    }

    const question = data.question.toLowerCase();

    if (question.includes('budget') || question.includes('spent') || question.includes('balance')) {
      const analytics = await storage.getProjectAnalytics(data.projectId);
      const remaining = analytics.totalBudget - analytics.totalSpent;
      const percentUsed = ((analytics.totalSpent / analytics.totalBudget) * 100).toFixed(1);
      
      return {
        success: true,
        type: 'query',
        message: 'Budget query answered',
        data: analytics,
        confirmationMessage: `📊 Project Budget:\n• Total: ${formatUGX(analytics.totalBudget)}\n• Spent: ${formatUGX(analytics.totalSpent)} (${percentUsed}%)\n• Remaining: ${formatUGX(remaining)}\n• Cash on hand: ${formatUGX(analytics.cashBalance)}`,
      };
    }

    if (question.includes('task') || question.includes('pending') || question.includes('todo')) {
      const tasks = await storage.getTasks(data.projectId);
      const pendingTasks = tasks.filter(t => !t.completed);
      const taskList = pendingTasks.slice(0, 5).map(t => `• ${t.title}`).join('\n');
      
      return {
        success: true,
        type: 'query',
        message: 'Tasks query answered',
        data: { pendingCount: pendingTasks.length, tasks: pendingTasks.slice(0, 5) },
        confirmationMessage: `📋 ${pendingTasks.length} pending tasks:\n${taskList}${pendingTasks.length > 5 ? `\n... and ${pendingTasks.length - 5} more` : ''}`,
      };
    }

    if (question.includes('inventory') || question.includes('material') || question.includes('stock')) {
      const inventoryItems = await storage.getInventory(data.projectId);
      const summary = inventoryItems.slice(0, 5).map(i => 
        `• ${i.item}: ${i.remaining}/${i.quantity} ${i.unit || 'pcs'}`
      ).join('\n');
      
      return {
        success: true,
        type: 'query',
        message: 'Inventory query answered',
        data: { itemCount: inventoryItems.length, items: inventoryItems.slice(0, 5) },
        confirmationMessage: `📦 Inventory (${inventoryItems.length} items):\n${summary}${inventoryItems.length > 5 ? `\n... and ${inventoryItems.length - 5} more items` : ''}`,
      };
    }

    if (question.includes('today') || question.includes('spent today')) {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      const ledger = await storage.getDailyLedgerByDate(data.projectId, today);
      
      if (ledger) {
        const lines = await storage.getDailyLedgerLines(ledger.id);
        const totalCash = parseFloat(ledger.totalCashSpent?.toString() || '0');
        const totalSupplier = parseFloat(ledger.totalSupplierSpent?.toString() || '0');
        const total = totalCash + totalSupplier;
        
        return {
          success: true,
          type: 'query',
          message: 'Daily spending query answered',
          data: { ledger, lines },
          confirmationMessage: `💰 Today's spending (${todayString}):\n• Cash: ${formatUGX(totalCash)}\n• Supplier: ${formatUGX(totalSupplier)}\n• Total: ${formatUGX(total)}\n• ${lines.length} transactions`,
        };
      } else {
        return {
          success: true,
          type: 'query',
          message: 'No spending recorded today',
          data: null,
          confirmationMessage: `💰 No spending recorded for today (${todayString}) yet.`,
        };
      }
    }

    return {
      success: true,
      type: 'query',
      message: 'General query - needs AI response',
      data: { question: data.question },
      confirmationMessage: "I'll need to look that up. One moment...",
    };
  } catch (error) {
    console.error('Error handling query:', error);
    return {
      success: false,
      type: 'query',
      message: error instanceof Error ? error.message : 'Failed to process query',
      confirmationMessage: "Sorry, there was a problem with that query. Please try again.",
    };
  }
}

function formatUGX(amount: number): string {
  return `UGX ${amount.toLocaleString('en-UG')}`;
}

export function createExtractedDataRoutes(storage: IStorage) {
  return async (req: Request, res: Response) => {
    try {
      const parseResult = extractedDataSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        console.log('[ExtractedData] Validation failed:', parseResult.error.errors);
        return res.status(400).json({
          error: 'Invalid data format',
          details: parseResult.error.errors,
          confirmationMessage: "I couldn't understand the data format. Please check the message.",
        });
      }

      const data = parseResult.data;
      console.log(`[ExtractedData] Processing ${data.type} from ${data.whatsappNumber}`);

      const result = await handleExtractedData(storage, data);

      if (result.success) {
        let user = await storage.findUserByWhatsApp(data.whatsappNumber);
        if (!user) {
          user = await storage.createWhatsAppUser(data.whatsappNumber);
        }
        
        await storage.storeWhatsAppMessage({
          userId: user.id,
          whatsappNumber: data.whatsappNumber,
          direction: 'incoming',
          messageType: 'text',
          text: JSON.stringify(data),
          status: 'processed',
          projectId: data.projectId,
          replyText: result.confirmationMessage,
          metadata: { extractedData: data, result: result.data },
        });
      }

      console.log(`[ExtractedData] Result:`, result);
      res.json(result);
    } catch (error) {
      console.error('[ExtractedData] Error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        confirmationMessage: "Sorry, something went wrong. Please try again.",
      });
    }
  };
}
