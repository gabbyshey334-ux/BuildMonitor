import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
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
  insertManagerSchema,
  insertTelegramUpdateSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Project routes
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const projects = await storage.getProjects(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const projectData = insertProjectSchema.parse({ ...req.body, ownerId: userId });
      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
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

  app.post('/api/tasks', isAuthenticated, async (req, res) => {
    try {
      console.log("Task creation request body:", JSON.stringify(req.body, null, 2));
      const taskData = insertTaskSchema.parse(req.body);
      console.log("Parsed task data:", JSON.stringify(taskData, null, 2));
      const task = await storage.createTask(taskData);
      console.log("Created task:", JSON.stringify(task, null, 2));
      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        res.status(400).json({ message: "Validation failed", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create task" });
      }
    }
  });

  app.put('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
      const updates = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(req.params.id, updates);
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTask(req.params.id);
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

  app.post('/api/supplier-purchases', isAuthenticated, async (req, res) => {
    try {
      const purchaseData = insertSupplierPurchaseSchema.parse(req.body);
      const purchase = await storage.createSupplierPurchase(purchaseData);
      res.json(purchase);
    } catch (error) {
      console.error("Error creating supplier purchase:", error);
      res.status(500).json({ message: "Failed to create supplier purchase" });
    }
  });

  // Inventory routes
  app.get('/api/projects/:projectId/inventory', isAuthenticated, async (req, res) => {
    try {
      const inventory = await storage.getInventory(req.params.projectId);
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
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

  app.post('/api/milestones', isAuthenticated, async (req, res) => {
    try {
      const milestoneData = insertMilestoneSchema.parse(req.body);
      const milestone = await storage.createMilestone(milestoneData);
      res.json(milestone);
    } catch (error) {
      console.error("Error creating milestone:", error);
      res.status(500).json({ message: "Failed to create milestone" });
    }
  });

  app.put('/api/milestones/:id', isAuthenticated, async (req, res) => {
    try {
      const updates = insertMilestoneSchema.partial().parse(req.body);
      const milestone = await storage.updateMilestone(req.params.id, updates);
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

  app.post('/api/daily-ledgers', isAuthenticated, async (req, res) => {
    try {
      console.log("Daily ledger request body:", JSON.stringify(req.body, null, 2));
      const { ledger, lines } = req.body;
      
      if (!ledger) {
        console.error("No ledger data in request body");
        return res.status(400).json({ message: "Missing ledger data" });
      }
      
      console.log("Parsing ledger data:", ledger);
      const ledgerData = insertDailyLedgerSchema.parse(ledger);
      console.log("Parsed ledger data:", ledgerData);
      
      console.log("Creating daily ledger with lines:", lines);
      const createdLedger = await storage.createDailyLedger(ledgerData, lines || []);
      console.log("Successfully created ledger:", createdLedger);
      
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

  app.put('/api/daily-ledgers/:id', isAuthenticated, async (req, res) => {
    try {
      const updates = insertDailyLedgerSchema.partial().parse(req.body);
      const ledger = await storage.updateDailyLedger(req.params.id, updates);
      res.json(ledger);
    } catch (error) {
      console.error("Error updating daily ledger:", error);
      res.status(500).json({ message: "Failed to update daily ledger" });
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

  app.post('/api/cash-deposits', isAuthenticated, async (req, res) => {
    try {
      const depositData = insertCashDepositSchema.parse(req.body);
      const deposit = await storage.createCashDeposit(depositData);
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
      res.json(balanceInfo);
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

  // Telegram Bot API endpoints (no authentication required for bot)
  app.post('/api/bot/submit-update', async (req, res) => {
    try {
      console.log("Telegram bot update request:", JSON.stringify(req.body, null, 2));
      
      // Validate the request body
      const updateData = insertTelegramUpdateSchema.parse(req.body);
      
      // Check if the manager is approved
      const manager = await storage.getManager(updateData.telegramId);
      if (!manager || !manager.approved) {
        return res.status(403).json({ error: "Manager not approved for bot access" });
      }
      
      // Create the telegram update
      const update = await storage.createTelegramUpdate(updateData);
      
      console.log("Telegram update created:", JSON.stringify(update, null, 2));
      res.json({ success: true, update });
    } catch (error) {
      console.error("Error creating telegram update:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create update" });
      }
    }
  });

  // Register/approve manager for telegram bot access
  app.post('/api/bot/register-manager', async (req, res) => {
    try {
      const managerData = insertManagerSchema.parse(req.body);
      
      // Check if manager already exists
      const existingManager = await storage.getManager(managerData.telegramId);
      if (existingManager) {
        return res.json({ success: true, manager: existingManager, message: "Manager already registered" });
      }
      
      // Create new manager (not approved by default)
      const manager = await storage.createManager(managerData);
      res.json({ success: true, manager, message: "Manager registered. Awaiting approval." });
    } catch (error) {
      console.error("Error registering manager:", error);
      res.status(500).json({ error: "Failed to register manager" });
    }
  });

  // Approve manager (authenticated endpoint for project owners)
  app.put('/api/managers/:telegramId/approve', isAuthenticated, async (req, res) => {
    try {
      const manager = await storage.updateManager(req.params.telegramId, { approved: true });
      res.json({ success: true, manager });
    } catch (error) {
      console.error("Error approving manager:", error);
      res.status(500).json({ error: "Failed to approve manager" });
    }
  });

  // Get telegram updates for a project (authenticated)
  app.get('/api/projects/:projectId/telegram-updates', isAuthenticated, async (req, res) => {
    try {
      const updates = await storage.getTelegramUpdates(req.params.projectId);
      res.json(updates);
    } catch (error) {
      console.error("Error fetching telegram updates:", error);
      res.status(500).json({ error: "Failed to fetch telegram updates" });
    }
  });

  // Telegram Bot Webhook
  app.post('/bot-webhook', async (req, res) => {
    try {
      // Import bot dynamically to handle webhook
      const { default: bot } = await import('../bot.js');
      if (bot.handleUpdate) {
        bot.handleUpdate(req.body);
      }
      res.status(200).send('OK');
    } catch (error) {
      console.warn('Telegram bot webhook not available:', error instanceof Error ? error.message : 'Unknown error');
      res.status(503).send('Bot not available');
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
