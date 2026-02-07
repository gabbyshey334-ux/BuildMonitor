import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage.js";
import { setupSimpleAuth, isAuthenticated } from "./simpleAuth.js";
import {
  insertProjectSchema,
  insertTaskSchema,
  insertUpdateSchema,
  insertAdvanceSchema,
  insertSupplierSchema,
  insertSupplierPurchaseSchema,
  insertInventorySchema,
  insertMilestoneSchema,
  insertDailyLedgerSchema,
  insertCashDepositSchema,
  insertConstructionPhaseSchema,
  insertHistoricalExpenseSchema,
  insertUserPreferencesSchema,
} from "../shared/schema.js";
import { z } from "zod";
import { handleError, createSuccessResponse } from "./errorHandler.js";
import { exportService, ExportOptions } from "./exportService.js";
import { validateWebhookToken, handleWebhook, handleWebhookTest } from "./webhookHandler.js";
import { handleWhatsAppWebhook, handleRAGQuery, handleAIAnswer } from "./whatsappHandler.js";
import { createExtractedDataRoutes } from "./extractedDataHandler.js";
import whatsappRouter from "./routes/whatsapp.js";
import { db } from "./db.js";
import { sql } from "drizzle-orm";

// WebSocket connection manager
const connectedClients = new Set<WebSocket>();

function broadcastToClients(data: any) {
  const message = JSON.stringify(data);
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  setupSimpleAuth(app);

  // Auth route is now handled in simpleAuth.ts

  // N8N Webhook routes (no auth required, uses token instead)
  app.post('/api/webhook/n8n', validateWebhookToken, handleWebhook);
  app.get('/api/webhook/test', handleWebhookTest);

  // Twilio WhatsApp webhook (NEW: Complete WhatsApp integration)
  app.use('/api/whatsapp', whatsappRouter);

  // WhatsApp Integration routes (webhook secret auth) - Legacy n8n integration
  app.post('/api/webhooks/whatsapp', validateWebhookToken, handleWhatsAppWebhook);
  app.post('/api/rag/query', validateWebhookToken, handleRAGQuery);
  app.post('/api/ai/answer', validateWebhookToken, handleAIAnswer);
  
  // NEW: Extracted data endpoint - receives pre-processed structured data from n8n
  // n8n does AI extraction, sends clean data here for storage
  app.post('/api/webhooks/extracted-data', validateWebhookToken, createExtractedDataRoutes(storage));

  // Message history routes (authenticated)
  app.get('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { projectId, userId, whatsappNumber, direction, startDate, endDate, limit } = req.query;
      
      const filters: any = {};
      if (projectId) filters.projectId = projectId;
      if (userId) filters.userId = userId;
      if (whatsappNumber) filters.whatsappNumber = whatsappNumber;
      if (direction) filters.direction = direction;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const messages = await storage.getAllMessages(
        Object.keys(filters).length > 0 ? filters : undefined,
        limit ? parseInt(limit) : 100
      );

      res.json({
        success: true,
        messages,
        count: messages.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      handleError(error, res, 'fetching messages');
    }
  });

  app.get('/api/users/:id/history', isAuthenticated, async (req, res) => {
    try {
      const userId = req.params.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const messages = await storage.getUserMessages(userId, limit);

      res.json({
        success: true,
        userId,
        messages,
        count: messages.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      handleError(error, res, 'fetching user message history');
    }
  });

  // Health check endpoint (public)
  app.get('/api/health', async (req, res) => {
    try {
      // Check database connectivity
      await db.execute(sql`SELECT 1`);

      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        services: {
          api: 'operational',
          whatsapp: 'operational',
          ai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      });
    }
  });

  // User preferences routes
  app.get('/api/user-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences);
    } catch (error) {
      handleError(error, res, 'fetching user preferences');
    }
  });

  app.put('/api/user-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const preferencesData = insertUserPreferencesSchema.parse(req.body);
      const preferences = await storage.upsertUserPreferences(userId, preferencesData);
      res.json(createSuccessResponse(preferences, 'User preferences updated successfully'));
    } catch (error) {
      handleError(error, res, 'updating user preferences');
    }
  });

  // Project routes
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const projects = await storage.getProjects(userId);
      res.json(projects);
    } catch (error) {
      handleError(error, res, 'fetching projects');
    }
  });

  app.get('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found. It may have been deleted or you may not have access to it." });
      }
      res.json(project);
    } catch (error) {
      handleError(error, res, 'fetching project details');
    }
  });

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const projectData = insertProjectSchema.parse({ ...req.body, ownerId: userId });
      const project = await storage.createProject(projectData);
      
      // Broadcast new project to all clients
      broadcastToClients({
        type: 'PROJECT_CREATED',
        data: project,
        userId
      });
      
      res.json(createSuccessResponse(project, 'Project created successfully'));
    } catch (error) {
      handleError(error, res, 'creating project');
    }
  });

  app.put('/api/projects/:id', isAuthenticated, async (req, res) => {
    try {
      const updates = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, updates);
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete('/api/projects/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Project analytics
  app.get('/api/projects/:id/analytics', isAuthenticated, async (req, res) => {
    try {
      const analytics = await storage.getProjectAnalytics(req.params.id);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Recent activities
  app.get('/api/projects/:id/activities', isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const activities = await storage.getRecentActivities(req.params.id, limit);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      res.status(500).json({ message: "Failed to fetch recent activities" });
    }
  });

  // Construction phase routes
  app.get('/api/construction-phases', isAuthenticated, async (req, res) => {
    try {
      const phases = await storage.getConstructionPhases();
      res.json(phases);
    } catch (error) {
      handleError(error, res, 'fetching construction phases');
    }
  });

  app.post('/api/construction-phases', isAuthenticated, async (req, res) => {
    try {
      const phaseData = insertConstructionPhaseSchema.parse(req.body);
      const phase = await storage.createConstructionPhase(phaseData);
      res.json(createSuccessResponse(phase, 'Construction phase created successfully'));
    } catch (error) {
      handleError(error, res, 'creating construction phase');
    }
  });

  app.put('/api/construction-phases/:id', isAuthenticated, async (req, res) => {
    try {
      const updates = insertConstructionPhaseSchema.partial().parse(req.body);
      const phase = await storage.updateConstructionPhase(req.params.id, updates);
      res.json(createSuccessResponse(phase, 'Construction phase updated successfully'));
    } catch (error) {
      handleError(error, res, 'updating construction phase');
    }
  });

  app.delete('/api/construction-phases/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteConstructionPhase(req.params.id);
      res.json(createSuccessResponse({}, 'Construction phase deleted successfully'));
    } catch (error) {
      handleError(error, res, 'deleting construction phase');
    }
  });

  // Historical expense routes
  app.get('/api/projects/:id/historical-expenses', isAuthenticated, async (req, res) => {
    try {
      const expenses = await storage.getHistoricalExpenses(req.params.id);
      res.json(expenses);
    } catch (error) {
      handleError(error, res, 'fetching historical expenses');
    }
  });

  app.post('/api/projects/:id/historical-expenses', isAuthenticated, async (req, res) => {
    try {
      const expenseData = insertHistoricalExpenseSchema.parse({
        ...req.body,
        projectId: req.params.id
      });
      const expense = await storage.createHistoricalExpense(expenseData);
      res.json(createSuccessResponse(expense, 'Historical expense added successfully'));
    } catch (error) {
      handleError(error, res, 'creating historical expense');
    }
  });

  app.put('/api/historical-expenses/:id', isAuthenticated, async (req, res) => {
    try {
      const updates = insertHistoricalExpenseSchema.partial().parse(req.body);
      const expense = await storage.updateHistoricalExpense(req.params.id, updates);
      res.json(createSuccessResponse(expense, 'Historical expense updated successfully'));
    } catch (error) {
      handleError(error, res, 'updating historical expense');
    }
  });

  app.delete('/api/historical-expenses/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteHistoricalExpense(req.params.id);
      res.json(createSuccessResponse({}, 'Historical expense deleted successfully'));
    } catch (error) {
      handleError(error, res, 'deleting historical expense');
    }
  });

  app.get('/api/projects/:id/historical-expenses/by-phase/:phaseId', isAuthenticated, async (req, res) => {
    try {
      const expenses = await storage.getHistoricalExpensesByPhase(req.params.id, req.params.phaseId);
      res.json(expenses);
    } catch (error) {
      handleError(error, res, 'fetching historical expenses by phase');
    }
  });

  // Task routes
  app.get('/api/projects/:projectId/tasks', isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getTasks(req.params.projectId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(taskData);
      
      // Broadcast task creation to all clients
      broadcastToClients({
        type: 'TASK_CREATED',
        data: task,
        projectId: task.projectId,
        userId: req.user.id
      });
      
      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation failed", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create task" });
      }
    }
  });

  app.put('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const updates = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(req.params.id, updates);
      
      // Broadcast task update to all clients
      broadcastToClients({
        type: 'TASK_UPDATED',
        data: task,
        projectId: task.projectId,
        userId: req.user.id
      });
      
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      // Get task info before deletion for broadcast
      const task = await storage.getTask(req.params.id);
      await storage.deleteTask(req.params.id);
      
      // Broadcast task deletion to all clients
      if (task) {
        broadcastToClients({
          type: 'TASK_DELETED',
          data: { id: req.params.id },
          projectId: task.projectId,
          userId: req.user.id
        });
      }
      
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Update routes
  app.get('/api/projects/:projectId/updates', isAuthenticated, async (req, res) => {
    try {
      const updates = await storage.getUpdates(req.params.projectId);
      res.json(updates);
    } catch (error) {
      console.error("Error fetching updates:", error);
      res.status(500).json({ message: "Failed to fetch updates" });
    }
  });

  app.post('/api/updates', isAuthenticated, async (req, res) => {
    try {
      const updateData = insertUpdateSchema.parse(req.body);
      const update = await storage.createUpdate(updateData);
      res.json(update);
    } catch (error) {
      console.error("Error creating update:", error);
      res.status(500).json({ message: "Failed to create update" });
    }
  });

  // Advance routes
  app.get('/api/projects/:projectId/advances', isAuthenticated, async (req, res) => {
    try {
      const advances = await storage.getAdvances(req.params.projectId);
      res.json(advances);
    } catch (error) {
      console.error("Error fetching advances:", error);
      res.status(500).json({ message: "Failed to fetch advances" });
    }
  });

  app.post('/api/advances', isAuthenticated, async (req, res) => {
    try {
      const advanceData = insertAdvanceSchema.parse(req.body);
      const advance = await storage.createAdvance(advanceData);
      res.json(advance);
    } catch (error) {
      console.error("Error creating advance:", error);
      res.status(500).json({ message: "Failed to create advance" });
    }
  });

  // Supplier routes
  app.get('/api/suppliers', isAuthenticated, async (req, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.post('/api/suppliers', isAuthenticated, async (req, res) => {
    try {
      const supplierData = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(supplierData);
      res.json(supplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(500).json({ message: "Failed to create supplier" });
    }
  });

  app.put('/api/suppliers/:id', isAuthenticated, async (req, res) => {
    try {
      const updates = insertSupplierSchema.partial().parse(req.body);
      const supplier = await storage.updateSupplier(req.params.id, updates);
      res.json(supplier);
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ message: "Failed to update supplier" });
    }
  });

  // Supplier purchase routes
  app.get('/api/supplier-purchases', isAuthenticated, async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const purchases = await storage.getSupplierPurchases(projectId);
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching supplier purchases:", error);
      res.status(500).json({ message: "Failed to fetch supplier purchases" });
    }
  });

  app.post('/api/supplier-purchases', isAuthenticated, async (req: any, res) => {
    try {
      const purchaseData = insertSupplierPurchaseSchema.parse(req.body);
      
      // Validate supplier balance before creating purchase
      const supplier = await storage.getSupplier(purchaseData.supplierId);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      const purchaseAmount = parseFloat(purchaseData.amount);
      const currentBalance = parseFloat(supplier.currentBalance);

      if (purchaseAmount > currentBalance) {
        const shortfall = purchaseAmount - currentBalance;
        return res.status(400).json({ 
          message: `Insufficient supplier balance. Purchase amount (${purchaseAmount.toLocaleString()} UGX) exceeds available balance (${currentBalance.toLocaleString()} UGX) by ${shortfall.toLocaleString()} UGX. Please add more credit to the supplier first.`
        });
      }
      
      const purchase = await storage.createSupplierPurchase(purchaseData);
      
      // Broadcast supplier purchase to all clients
      broadcastToClients({
        type: 'PURCHASE_CREATED',
        data: purchase,
        projectId: purchaseData.projectId,
        userId: req.user.id
      });
      
      res.json(purchase);
    } catch (error) {
      console.error("Error creating supplier purchase:", error);
      handleError(error, res, 'creating supplier purchase');
    }
  });

  // Supplier transaction history route
  app.get('/api/suppliers/:supplierId/transactions', isAuthenticated, async (req, res) => {
    try {
      const { supplierId } = req.params;
      const projectId = req.query.projectId as string;
      
      const history = await storage.getSupplierTransactionHistory(supplierId, projectId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching supplier transaction history:", error);
      handleError(error, res, 'fetching supplier transaction history');
    }
  });

  // Inventory routes
  app.get('/api/projects/:projectId/inventory', isAuthenticated, async (req, res) => {
    try {
      const { projectId } = req.params;
      const location = req.query.location as 'hardware' | 'on-site' | undefined;
      
      if (location) {
        const inventory = await storage.getInventoryByLocation(projectId, location);
        res.json(inventory);
      } else {
        const inventory = await storage.getInventory(projectId);
        res.json(inventory);
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
      handleError(error, res, 'fetching inventory');
    }
  });

  // Inventory analytics route
  app.get('/api/projects/:projectId/inventory/analytics', isAuthenticated, async (req, res) => {
    try {
      const { projectId } = req.params;
      const analytics = await storage.getInventoryAnalytics(projectId);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching inventory analytics:", error);
      handleError(error, res, 'fetching inventory analytics');
    }
  });

  app.post('/api/inventory', isAuthenticated, async (req, res) => {
    try {
      const inventoryData = insertInventorySchema.parse(req.body);
      const item = await storage.createInventoryItem(inventoryData);
      res.json(item);
    } catch (error) {
      console.error("Error creating inventory item:", error);
      res.status(500).json({ message: "Failed to create inventory item" });
    }
  });

  app.put('/api/inventory/:id', isAuthenticated, async (req, res) => {
    try {
      const updates = insertInventorySchema.partial().parse(req.body);
      const item = await storage.updateInventoryItem(req.params.id, updates);
      res.json(item);
    } catch (error) {
      console.error("Error updating inventory item:", error);
      res.status(500).json({ message: "Failed to update inventory item" });
    }
  });

  // Milestone routes
  app.get('/api/projects/:projectId/milestones', isAuthenticated, async (req, res) => {
    try {
      const milestones = await storage.getMilestones(req.params.projectId);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ message: "Failed to fetch milestones" });
    }
  });

  app.post('/api/milestones', isAuthenticated, async (req: any, res) => {
    try {
      const milestoneData = insertMilestoneSchema.parse(req.body);
      const milestone = await storage.createMilestone(milestoneData);
      
      // Broadcast milestone creation to all clients
      broadcastToClients({
        type: 'MILESTONE_CREATED',
        data: milestone,
        projectId: milestoneData.projectId,
        userId: req.user.id
      });
      
      res.json(milestone);
    } catch (error) {
      console.error("Error creating milestone:", error);
      res.status(500).json({ message: "Failed to create milestone" });
    }
  });

  app.put('/api/milestones/:id', isAuthenticated, async (req: any, res) => {
    try {
      const updates = insertMilestoneSchema.partial().parse(req.body);
      const milestone = await storage.updateMilestone(req.params.id, updates);
      
      // Broadcast milestone update to all clients
      broadcastToClients({
        type: 'MILESTONE_UPDATED',
        data: milestone,
        projectId: milestone.projectId,
        userId: req.user.id
      });
      
      res.json(milestone);
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ message: "Failed to update milestone" });
    }
  });

  // Daily ledger routes
  app.get('/api/projects/:projectId/daily-ledgers', isAuthenticated, async (req, res) => {
    try {
      const ledgers = await storage.getDailyLedgers(req.params.projectId);
      res.json(ledgers);
    } catch (error) {
      console.error("Error fetching daily ledgers:", error);
      res.status(500).json({ message: "Failed to fetch daily ledgers" });
    }
  });

  app.post('/api/daily-ledgers', isAuthenticated, async (req: any, res) => {
    try {
      const { ledger, lines } = req.body;
      
      if (!ledger) {
        return res.status(400).json({ message: "Missing ledger data" });
      }
      
      const ledgerData = insertDailyLedgerSchema.parse(ledger);
      const createdLedger = await storage.createDailyLedger(ledgerData, lines || []);
      
      // Broadcast financial update to all clients
      broadcastToClients({
        type: 'LEDGER_CREATED',
        data: createdLedger,
        projectId: ledgerData.projectId,
        userId: req.user.id
      });
      
      res.json(createdLedger);
    } catch (error) {
      console.error("Error creating daily ledger:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      res.status(500).json({ message: "Failed to create daily ledger", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.put('/api/daily-ledgers/:id', isAuthenticated, async (req: any, res) => {
    try {
      console.log("Daily ledger update request body:", JSON.stringify(req.body, null, 2));
      const { ledger, lines } = req.body;
      
      if (!ledger) {
        console.error("No ledger data in update request body");
        return res.status(400).json({ message: "Missing ledger data" });
      }
      
      console.log("Parsing ledger update data:", ledger);
      const ledgerUpdates = insertDailyLedgerSchema.partial().parse(ledger);
      console.log("Parsed ledger update data:", ledgerUpdates);
      
      console.log("Updating daily ledger with lines:", lines);
      const updatedLedger = await storage.updateDailyLedgerWithLines(req.params.id, ledgerUpdates, lines || []);
      console.log("Successfully updated ledger:", updatedLedger);
      
      // Broadcast financial update to all clients
      broadcastToClients({
        type: 'LEDGER_UPDATED',
        data: updatedLedger,
        projectId: updatedLedger.projectId,
        userId: req.user.id
      });
      
      res.json(updatedLedger);
    } catch (error) {
      console.error("Error updating daily ledger:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      res.status(500).json({ message: "Failed to update daily ledger", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Cash deposit routes
  app.get('/api/projects/:projectId/cash-deposits', isAuthenticated, async (req, res) => {
    try {
      const deposits = await storage.getCashDeposits(req.params.projectId);
      res.json(deposits);
    } catch (error) {
      console.error("Error fetching cash deposits:", error);
      res.status(500).json({ message: "Failed to fetch cash deposits" });
    }
  });

  app.post('/api/cash-deposits', isAuthenticated, async (req: any, res) => {
    try {
      const depositData = insertCashDepositSchema.parse(req.body);
      const deposit = await storage.createCashDeposit(depositData);
      
      // Broadcast cash deposit to all clients
      broadcastToClients({
        type: 'CASH_DEPOSIT_CREATED',
        data: deposit,
        projectId: depositData.projectId,
        userId: req.user.id
      });
      
      res.json(deposit);
    } catch (error) {
      console.error("Error creating cash deposit:", error);
      res.status(500).json({ message: "Failed to create cash deposit" });
    }
  });

  // Opening balance calculation
  app.get('/api/projects/:projectId/opening-balance/:date', isAuthenticated, async (req, res) => {
    try {
      const { projectId, date } = req.params;
      const balanceInfo = await storage.getCalculatedOpeningBalance(projectId, date);
      
      // Return in format expected by frontend: { amount: string, ...other fields }
      res.json({
        amount: balanceInfo.openingBalance.toString(),
        openingBalance: balanceInfo.openingBalance,
        lastClosingBalance: balanceInfo.lastClosingBalance,
        cashDepositsTotal: balanceInfo.cashDepositsTotal
      });
    } catch (error) {
      console.error("Error calculating opening balance:", error);
      res.status(500).json({ message: "Failed to calculate opening balance" });
    }
  });

  // Data export
  app.get('/api/projects/:projectId/export', isAuthenticated, async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const [
        project,
        tasks,
        updates,
        advances,
        inventory,
        milestones,
        dailyLedgers,
        analytics
      ] = await Promise.all([
        storage.getProject(projectId),
        storage.getTasks(projectId),
        storage.getUpdates(projectId),
        storage.getAdvances(projectId),
        storage.getInventory(projectId),
        storage.getMilestones(projectId),
        storage.getDailyLedgers(projectId),
        storage.getProjectAnalytics(projectId)
      ]);

      const exportData = {
        project,
        tasks,
        updates,
        advances,
        inventory,
        milestones,
        dailyLedgers,
        analytics,
        exportedAt: new Date().toISOString()
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="project-${projectId}-export.json"`);
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting project data:", error);
      res.status(500).json({ message: "Failed to export project data" });
    }
  });

  // Enhanced export routes
  app.post('/api/projects/:id/export', isAuthenticated, async (req, res) => {
    try {
      const projectId = req.params.id;
      const { format = 'json', dataTypes = ['all'], dateRange } = req.body;

      const options: ExportOptions = {
        projectId,
        format,
        dataTypes,
        dateRange
      };

      const exportResult = await exportService.exportProjectData(options);
      
      res.setHeader('Content-Type', exportResult.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.send(exportResult.content);
    } catch (error) {
      handleError(error, res, 'exporting project data');
    }
  });

  // Export all projects summary
  app.get('/api/projects/export/all', isAuthenticated, async (req, res) => {
    try {
      const exportResult = await exportService.exportAllProjects();
      
      res.setHeader('Content-Type', exportResult.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.send(exportResult.content);
    } catch (error) {
      handleError(error, res, 'exporting all projects');
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket server setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection established');
    connectedClients.add(ws);
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Real-time updates enabled' }));
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      connectedClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      connectedClients.delete(ws);
    });
  });
  
  return httpServer;
}
