import { Request, Response, NextFunction } from "express";
import { storage } from "./storage.js";
import { z } from "zod";
import {
  insertHistoricalExpenseSchema,
  insertInventorySchema,
  insertTaskSchema,
  insertDailyLedgerLineSchema,
  insertDailyLedgerSchema,
  insertSupplierSchema,
} from "@shared/schema";

// Webhook authentication token (in production, this should be an environment variable)
const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || "n8n-webhook-secret-change-in-production";

// Middleware to validate webhook token
export function validateWebhookToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header',
      message: 'Include "Authorization: Bearer YOUR_TOKEN" in request headers'
    });
  }

  const token = authHeader.substring(7);
  
  if (token !== WEBHOOK_SECRET) {
    return res.status(403).json({
      success: false,
      error: 'Invalid webhook token',
      message: 'The provided token does not match the server configuration'
    });
  }

  next();
}

// Schema for N8N webhook payload
const n8nWebhookSchema = z.object({
  type: z.enum(['expense', 'inventory', 'task', 'daily_ledger', 'supplier', 'query']),
  projectId: z.string().uuid(),
  data: z.record(z.any()),
  metadata: z.object({
    source: z.string().optional(),
    timestamp: z.string().optional(),
    conversationId: z.string().optional(),
  }).optional(),
});

// Parse natural language data for expenses
function parseExpenseData(data: any, projectId: string) {
  const parsed = {
    projectId,
    category: data.category || 'Materials',
    description: data.description || data.item || 'Unnamed expense',
    amount: parseFloat(data.amount) || 0,
    quantity: data.quantity ? parseInt(data.quantity) : null,
    unit: data.unit || null,
    supplier: data.supplier || null,
    phaseId: data.phaseId || null,
    date: data.date ? new Date(data.date) : new Date(),
  };

  // Validate using schema
  return insertHistoricalExpenseSchema.parse(parsed);
}

// Parse inventory data
function parseInventoryData(data: any, projectId: string) {
  const parsed = {
    projectId,
    item: data.item || data.description || 'Unnamed item',
    quantity: parseInt(data.quantity) || 0,
    deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : new Date(),
    used: data.used ? parseInt(data.used) : 0,
    remaining: data.remaining ? parseInt(data.remaining) : parseInt(data.quantity) || 0,
    location: data.location || 'on-site',
    unit: data.unit || null,
    supplierId: data.supplierId || null,
  };

  return insertInventorySchema.parse(parsed);
}

// Parse task data
function parseTaskData(data: any, projectId: string) {
  const parsed = {
    projectId,
    title: data.title || data.description || 'Unnamed task',
    description: data.details || data.description || null,
    priority: data.priority || 'Medium',
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    location: data.location || null,
    completed: data.completed || false,
  };

  return insertTaskSchema.parse(parsed);
}

// Parse daily ledger line data with validation
function parseDailyLedgerLineData(data: any, ledgerId: string) {
  const parsed = {
    ledgerId,
    category: data.category || 'Labor',
    item: data.item || data.description || 'Daily expense',
    amount: (parseFloat(data.amount) || 0).toString(),
    paymentMethod: data.paymentMethod || data.paymentType || 'cash',
    supplierId: data.supplierId || null,
    phaseId: data.phaseId || null,
    quantity: data.quantity?.toString() || null,
    unit: data.unit || null,
    note: data.note || null,
  };

  // Validate using schema
  return insertDailyLedgerLineSchema.parse(parsed);
}

// Parse supplier data
function parseSupplierData(data: any) {
  const parsed = {
    name: data.name || data.supplierName || 'Unnamed supplier',
    totalDeposited: data.totalDeposited ? parseFloat(data.totalDeposited) : 0,
    totalSpent: data.totalSpent ? parseFloat(data.totalSpent) : 0,
    currentBalance: data.currentBalance ? parseFloat(data.currentBalance) : 0,
  };

  return insertSupplierSchema.parse(parsed);
}

// Main webhook handler
export async function handleWebhook(req: Request, res: Response) {
  try {
    // Validate request body
    const payload = n8nWebhookSchema.parse(req.body);
    const { type, projectId, data, metadata } = payload;

    let result: any;
    let message: string;

    // Route to appropriate handler based on type
    switch (type) {
      case 'expense':
        const expenseData = parseExpenseData(data, projectId);
        result = await storage.createHistoricalExpense(expenseData);
        message = `Expense created: ${expenseData.description} - ${expenseData.amount} UGX`;
        break;

      case 'inventory':
        const inventoryData = parseInventoryData(data, projectId);
        result = await storage.createInventoryItem(inventoryData);
        message = `Inventory added: ${inventoryData.item} (${inventoryData.quantity} ${inventoryData.unit || 'units'})`;
        break;

      case 'task':
        const taskData = parseTaskData(data, projectId);
        result = await storage.createTask(taskData);
        message = `Task created: ${taskData.title}`;
        break;

      case 'daily_ledger':
        // Get or create today's ledger
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let dailyLedger = await storage.getDailyLedgerByDate(projectId, today);
        
        if (!dailyLedger) {
          // Calculate opening balance from previous day
          const balanceInfo = await storage.getCalculatedOpeningBalance(
            projectId, 
            today.toISOString()
          );
          
          // Create new ledger for today with proper opening balance
          dailyLedger = await storage.createDailyLedger({
            projectId,
            date: today,
            openingCash: balanceInfo.openingBalance.toString(),
            closingCash: balanceInfo.openingBalance.toString(),
          }, []);
        }
        
        // Parse and validate ledger line data
        const ledgerLineData = parseDailyLedgerLineData(data, dailyLedger.id);
        
        // Create ledger line (this auto-updates ledger totals)
        result = await storage.createDailyLedgerLine(ledgerLineData);
        
        // Fetch updated ledger to get correct closing balance
        const updatedLedger = await storage.getDailyLedgerByDate(projectId, today);
        
        message = `Daily expense recorded: ${ledgerLineData.item} - ${ledgerLineData.amount} UGX (Closing balance: ${updatedLedger?.closingCash || 0} UGX)`;
        break;

      case 'supplier':
        const supplierData = parseSupplierData(data);
        result = await storage.createSupplier(supplierData);
        message = `Supplier added: ${supplierData.name}`;
        break;

      case 'query':
        // Handle query requests (for reporting)
        result = await handleQuery(data, projectId);
        message = 'Query processed';
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid webhook type',
          message: `Type must be one of: expense, inventory, task, daily_ledger, supplier, query`
        });
    }

    // Log webhook activity
    console.log(`[N8N Webhook] ${type} - ${message}`, {
      projectId,
      conversationId: metadata?.conversationId,
      timestamp: new Date().toISOString(),
    });

    // Return success response
    res.json({
      success: true,
      message,
      data: result,
      recordId: result.id,
      metadata: {
        type,
        timestamp: new Date().toISOString(),
        conversationId: metadata?.conversationId,
      }
    });

  } catch (error: any) {
    console.error('[N8N Webhook Error]', error);
    
    // Return detailed error for debugging
    res.status(400).json({
      success: false,
      error: error.message || 'Webhook processing failed',
      details: error.issues || error.errors || null,
      timestamp: new Date().toISOString(),
    });
  }
}

// Handle query requests (for WhatsApp reporting)
async function handleQuery(data: any, projectId: string) {
  const queryType = data.queryType;

  switch (queryType) {
    case 'daily_spending':
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dailyLedger = await storage.getDailyLedgerByDate(projectId, today);
      
      if (!dailyLedger) {
        return { message: 'No expenses recorded today', total: 0 };
      }
      
      const lines = await storage.getDailyLedgerLines(dailyLedger.id);
      const total = lines.reduce((sum: number, line: any) => sum + parseFloat(line.amount.toString()), 0);
      
      return {
        message: `Today's spending: ${total.toLocaleString()} UGX`,
        total,
        items: lines.length,
        breakdown: lines.map((l: any) => ({
          category: l.category,
          item: l.item,
          amount: parseFloat(l.amount.toString()),
        }))
      };

    case 'weekly_spending':
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const expenses = await storage.getHistoricalExpenses(projectId);
      const weekExpenses = expenses.filter(e => 
        new Date(e.date) >= weekAgo
      );
      
      const weekTotal = weekExpenses.reduce((sum, exp) => 
        sum + parseFloat(exp.amount.toString()), 0
      );
      
      return {
        message: `Last 7 days spending: ${weekTotal.toLocaleString()} UGX`,
        total: weekTotal,
        items: weekExpenses.length,
      };

    case 'inventory_status':
      const inventory = await storage.getInventory(projectId);
      
      return {
        message: `Inventory: ${inventory.length} items`,
        items: inventory.map(item => ({
          item: item.item,
          quantity: item.quantity,
          remaining: item.remaining,
          used: item.used,
        }))
      };

    case 'project_summary':
      const analytics = await storage.getProjectAnalytics(projectId);
      
      return {
        message: 'Project summary',
        budget: parseFloat(analytics.totalBudget?.toString() || '0'),
        totalSpent: parseFloat(analytics.totalSpent?.toString() || '0'),
        remaining: parseFloat(analytics.totalBudget?.toString() || '0') - parseFloat(analytics.totalSpent?.toString() || '0'),
        percentUsed: parseFloat(analytics.totalBudget?.toString() || '0') > 0 
          ? (parseFloat(analytics.totalSpent?.toString() || '0') / parseFloat(analytics.totalBudget?.toString() || '0')) * 100 
          : 0,
      };

    default:
      return { message: 'Unknown query type', queryType };
  }
}

// Test endpoint handler
export function handleWebhookTest(req: Request, res: Response) {
  const testPayloads = {
    expense: {
      type: 'expense',
      projectId: 'YOUR_PROJECT_ID',
      data: {
        category: 'Materials',
        description: 'Cement',
        amount: 500000,
        quantity: 50,
        unit: 'bags',
        supplier: 'Musa Hardware',
        date: new Date().toISOString(),
      }
    },
    inventory: {
      type: 'inventory',
      projectId: 'YOUR_PROJECT_ID',
      data: {
        item: 'Cement',
        quantity: 100,
        unit: 'bags',
        location: 'on-site',
        deliveryDate: new Date().toISOString(),
      }
    },
    task: {
      type: 'task',
      projectId: 'YOUR_PROJECT_ID',
      data: {
        title: 'Inspect foundation work',
        priority: 'High',
        dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      }
    },
    daily_ledger: {
      type: 'daily_ledger',
      projectId: 'YOUR_PROJECT_ID',
      data: {
        category: 'Labor',
        description: 'Workers payment',
        amount: 150000,
        paymentType: 'cash',
      }
    },
    query: {
      type: 'query',
      projectId: 'YOUR_PROJECT_ID',
      data: {
        queryType: 'daily_spending',
      }
    }
  };

  const curlExamples = {
    expense: `curl -X POST https://your-replit-app.replit.dev/api/webhook/n8n \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${WEBHOOK_SECRET}" \\
  -d '${JSON.stringify(testPayloads.expense, null, 2)}'`,
    
    inventory: `curl -X POST https://your-replit-app.replit.dev/api/webhook/n8n \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${WEBHOOK_SECRET}" \\
  -d '${JSON.stringify(testPayloads.inventory, null, 2)}'`,
    
    query: `curl -X POST https://your-replit-app.replit.dev/api/webhook/n8n \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${WEBHOOK_SECRET}" \\
  -d '${JSON.stringify(testPayloads.query, null, 2)}'`,
  };

  res.json({
    message: 'N8N Webhook Test Endpoint',
    status: 'ready',
    webhookUrl: '/api/webhook/n8n',
    authToken: WEBHOOK_SECRET,
    documentation: {
      authentication: 'Include "Authorization: Bearer YOUR_TOKEN" header in all requests',
      supportedTypes: ['expense', 'inventory', 'task', 'daily_ledger', 'supplier', 'query'],
      testPayloads,
      curlExamples,
    },
    instructions: {
      step1: 'Replace YOUR_PROJECT_ID with an actual project ID from your dashboard',
      step2: 'Copy one of the curl examples above',
      step3: 'Run the curl command in your terminal',
      step4: 'Check the response for success/error',
      step5: 'Verify data appears in your Replit dashboard',
    },
    n8nSetup: {
      httpRequestNode: {
        method: 'POST',
        url: '{{your-replit-url}}/api/webhook/n8n',
        authentication: 'Header Auth',
        headerName: 'Authorization',
        headerValue: `Bearer ${WEBHOOK_SECRET}`,
      },
      bodyFormat: 'JSON',
      exampleBody: testPayloads.expense,
    }
  });
}
