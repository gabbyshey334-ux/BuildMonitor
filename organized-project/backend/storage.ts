import {
  users,
  projects,
  tasks,
  updates,
  advances,
  suppliers,
  supplierPurchases,
  inventory,
  milestones,
  dailyLedgers,
  dailyLedgerLines,
  cashDeposits,
  managers,
  telegramUpdates,
  type User,
  type UpsertUser,
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
  type Update,
  type InsertUpdate,
  type Advance,
  type InsertAdvance,
  type Supplier,
  type InsertSupplier,
  type SupplierPurchase,
  type InsertSupplierPurchase,
  type Inventory,
  type InsertInventory,
  type Milestone,
  type InsertMilestone,
  type DailyLedger,
  type InsertDailyLedger,
  type DailyLedgerLine,
  type InsertDailyLedgerLine,
  type CashDeposit,
  type InsertCashDeposit,
  type Manager,
  type InsertManager,
  type TelegramUpdate,
  type InsertTelegramUpdate,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sum, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Project operations
  getProjects(ownerId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  
  // Task operations
  getTasks(projectId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  
  // Update operations
  getUpdates(projectId: string): Promise<Update[]>;
  createUpdate(update: InsertUpdate): Promise<Update>;
  
  // Advance operations
  getAdvances(projectId: string): Promise<Advance[]>;
  createAdvance(advance: InsertAdvance): Promise<Advance>;
  
  // Supplier operations
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, updates: Partial<InsertSupplier>): Promise<Supplier>;
  
  // Supplier purchase operations
  getSupplierPurchases(projectId?: string): Promise<SupplierPurchase[]>;
  createSupplierPurchase(purchase: InsertSupplierPurchase): Promise<SupplierPurchase>;
  
  // Inventory operations
  getInventory(projectId: string): Promise<Inventory[]>;
  createInventoryItem(item: InsertInventory): Promise<Inventory>;
  updateInventoryItem(id: string, updates: Partial<InsertInventory>): Promise<Inventory>;
  
  // Milestone operations
  getMilestones(projectId: string): Promise<Milestone[]>;
  createMilestone(milestone: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: string, updates: Partial<InsertMilestone>): Promise<Milestone>;
  
  // Daily ledger operations
  getDailyLedgers(projectId: string): Promise<(DailyLedger & { lines: DailyLedgerLine[] })[]>;
  createDailyLedger(ledger: InsertDailyLedger, lines: InsertDailyLedgerLine[]): Promise<DailyLedger>;
  updateDailyLedger(id: string, updates: Partial<InsertDailyLedger>): Promise<DailyLedger>;
  
  // Cash deposit operations
  getCashDeposits(projectId: string): Promise<CashDeposit[]>;
  createCashDeposit(deposit: InsertCashDeposit): Promise<CashDeposit>;
  
  // Automatic opening balance calculation
  getCalculatedOpeningBalance(projectId: string, date: string): Promise<{ openingBalance: number; lastClosingBalance: number | null; cashDepositsTotal: number }>;
  
  // Analytics
  getProjectAnalytics(projectId: string): Promise<{
    totalBudget: number;
    totalSpent: number;
    totalCashSpent: number;
    totalSupplierSpent: number;
    cashBalance: number;
    categoryBreakdown: Record<string, number>;
  }>;

  // Telegram bot operations
  getManager(telegramId: string): Promise<Manager | undefined>;
  createManager(manager: InsertManager): Promise<Manager>;
  updateManager(telegramId: string, updates: Partial<InsertManager>): Promise<Manager>;
  getTelegramUpdates(projectId?: string): Promise<TelegramUpdate[]>;
  createTelegramUpdate(update: InsertTelegramUpdate): Promise<TelegramUpdate>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          id: userData.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Project operations
  async getProjects(ownerId: string): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.ownerId, ownerId));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Task operations
  async getTasks(projectId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Update operations
  async getUpdates(projectId: string): Promise<Update[]> {
    return await db
      .select()
      .from(updates)
      .where(eq(updates.projectId, projectId))
      .orderBy(desc(updates.createdAt));
  }

  async createUpdate(update: InsertUpdate): Promise<Update> {
    const [newUpdate] = await db.insert(updates).values(update).returning();
    return newUpdate;
  }

  // Advance operations
  async getAdvances(projectId: string): Promise<Advance[]> {
    return await db
      .select()
      .from(advances)
      .where(eq(advances.projectId, projectId))
      .orderBy(desc(advances.createdAt));
  }

  async createAdvance(advance: InsertAdvance): Promise<Advance> {
    const [newAdvance] = await db.insert(advances).values(advance).returning();
    return newAdvance;
  }

  // Supplier operations
  async getSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [newSupplier] = await db.insert(suppliers).values(supplier).returning();
    return newSupplier;
  }

  async updateSupplier(id: string, updates: Partial<InsertSupplier>): Promise<Supplier> {
    const [supplier] = await db
      .update(suppliers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return supplier;
  }

  // Supplier purchase operations
  async getSupplierPurchases(projectId?: string): Promise<SupplierPurchase[]> {
    const query = db.select().from(supplierPurchases).orderBy(desc(supplierPurchases.createdAt));
    
    if (projectId) {
      return await query.where(eq(supplierPurchases.projectId, projectId));
    }
    return await query;
  }

  async createSupplierPurchase(purchase: InsertSupplierPurchase): Promise<SupplierPurchase> {
    const [newPurchase] = await db.insert(supplierPurchases).values(purchase).returning();
    
    // Update supplier balance
    await db
      .update(suppliers)
      .set({
        totalSpent: sql`${suppliers.totalSpent} + ${purchase.amount}`,
        currentBalance: sql`${suppliers.currentBalance} - ${purchase.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, purchase.supplierId));

    return newPurchase;
  }

  // Inventory operations
  async getInventory(projectId: string): Promise<Inventory[]> {
    return await db
      .select()
      .from(inventory)
      .where(eq(inventory.projectId, projectId))
      .orderBy(desc(inventory.createdAt));
  }

  async createInventoryItem(item: InsertInventory): Promise<Inventory> {
    const [newItem] = await db.insert(inventory).values(item).returning();
    return newItem;
  }

  async updateInventoryItem(id: string, updates: Partial<InsertInventory>): Promise<Inventory> {
    const [item] = await db
      .update(inventory)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(inventory.id, id))
      .returning();
    return item;
  }

  // Milestone operations
  async getMilestones(projectId: string): Promise<Milestone[]> {
    return await db
      .select()
      .from(milestones)
      .where(eq(milestones.projectId, projectId))
      .orderBy(milestones.targetDate);
  }

  async createMilestone(milestone: InsertMilestone): Promise<Milestone> {
    const [newMilestone] = await db.insert(milestones).values(milestone).returning();
    return newMilestone;
  }

  async updateMilestone(id: string, updates: Partial<InsertMilestone>): Promise<Milestone> {
    const [milestone] = await db
      .update(milestones)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(milestones.id, id))
      .returning();
    return milestone;
  }

  // Daily ledger operations
  async getDailyLedgers(projectId: string): Promise<(DailyLedger & { lines: DailyLedgerLine[] })[]> {
    const ledgers = await db
      .select()
      .from(dailyLedgers)
      .where(eq(dailyLedgers.projectId, projectId))
      .orderBy(desc(dailyLedgers.date));

    const ledgersWithLines = await Promise.all(
      ledgers.map(async (ledger) => {
        const lines = await db
          .select()
          .from(dailyLedgerLines)
          .where(eq(dailyLedgerLines.ledgerId, ledger.id));
        return { ...ledger, lines };
      })
    );

    return ledgersWithLines;
  }

  async createDailyLedger(ledger: InsertDailyLedger, lines: InsertDailyLedgerLine[]): Promise<DailyLedger> {
    const [newLedger] = await db.insert(dailyLedgers).values(ledger).returning();
    
    if (lines.length > 0) {
      await db.insert(dailyLedgerLines).values(
        lines.map(line => ({ ...line, ledgerId: newLedger.id }))
      );
    }
    
    return newLedger;
  }

  async updateDailyLedger(id: string, updates: Partial<InsertDailyLedger>): Promise<DailyLedger> {
    const [ledger] = await db
      .update(dailyLedgers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dailyLedgers.id, id))
      .returning();
    return ledger;
  }

  // Cash deposit operations
  async getCashDeposits(projectId: string): Promise<CashDeposit[]> {
    return await db
      .select()
      .from(cashDeposits)
      .where(eq(cashDeposits.projectId, projectId))
      .orderBy(desc(cashDeposits.date));
  }

  async createCashDeposit(deposit: InsertCashDeposit): Promise<CashDeposit> {
    const [newDeposit] = await db.insert(cashDeposits).values(deposit).returning();
    return newDeposit;
  }

  async getCalculatedOpeningBalance(projectId: string, date: string): Promise<{ 
    openingBalance: number; 
    lastClosingBalance: number | null; 
    cashDepositsTotal: number 
  }> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    // Get the most recent daily ledger before this date
    const lastLedger = await db
      .select()
      .from(dailyLedgers)
      .where(
        and(
          eq(dailyLedgers.projectId, projectId),
          sql`DATE(${dailyLedgers.date}) < ${targetDate.toISOString().split('T')[0]}`
        )
      )
      .orderBy(desc(dailyLedgers.date))
      .limit(1);

    const lastClosingBalance = lastLedger.length > 0 ? parseFloat(lastLedger[0].closingCash) : null;

    // Get all cash deposits since the last ledger (or all if no previous ledger)
    const startDate = lastLedger.length > 0 
      ? lastLedger[0].date 
      : new Date('2000-01-01'); // Far past date to include all deposits

    const deposits = await db
      .select()
      .from(cashDeposits)
      .where(
        and(
          eq(cashDeposits.projectId, projectId),
          sql`${cashDeposits.date} > ${startDate}`,
          sql`DATE(${cashDeposits.date}) <= ${targetDate.toISOString().split('T')[0]}`
        )
      );

    const cashDepositsTotal = deposits.reduce((total, deposit) => {
      return total + parseFloat(deposit.amount);
    }, 0);

    // Calculate opening balance: last closing balance + cash deposits since then
    const openingBalance = (lastClosingBalance || 0) + cashDepositsTotal;

    return {
      openingBalance,
      lastClosingBalance,
      cashDepositsTotal
    };
  }

  // Analytics
  async getProjectAnalytics(projectId: string): Promise<{
    totalBudget: number;
    totalSpent: number;
    totalCashSpent: number;
    totalSupplierSpent: number;
    cashBalance: number;
    categoryBreakdown: Record<string, number>;
  }> {
    // Get project budget
    const project = await this.getProject(projectId);
    const totalBudget = project ? parseFloat(project.budget) : 0;

    // Get total spent from updates
    const updatesSummary = await db
      .select({
        totalAmount: sum(updates.amount),
        category: updates.category,
        paymentMethod: updates.paymentMethod,
      })
      .from(updates)
      .where(eq(updates.projectId, projectId))
      .groupBy(updates.category, updates.paymentMethod);

    let totalSpent = 0;
    let totalCashSpent = 0;
    let totalSupplierSpent = 0;
    const categoryBreakdown: Record<string, number> = {};

    updatesSummary.forEach((summary) => {
      const amount = parseFloat(summary.totalAmount || '0');
      totalSpent += amount;
      
      if (summary.paymentMethod === 'cash') {
        totalCashSpent += amount;
      } else if (summary.paymentMethod === 'supplier') {
        totalSupplierSpent += amount;
      }

      categoryBreakdown[summary.category] = (categoryBreakdown[summary.category] || 0) + amount;
    });

    // Get total advances
    const advancesSummary = await db
      .select({ totalAdvances: sum(advances.amount) })
      .from(advances)
      .where(eq(advances.projectId, projectId));

    const totalAdvances = parseFloat(advancesSummary[0]?.totalAdvances || '0');
    const cashBalance = totalAdvances - totalCashSpent;

    return {
      totalBudget,
      totalSpent,
      totalCashSpent,
      totalSupplierSpent,
      cashBalance,
      categoryBreakdown,
    };
  }

  // Telegram bot operations
  async getManager(telegramId: string): Promise<Manager | undefined> {
    const [manager] = await db.select().from(managers).where(eq(managers.telegramId, telegramId));
    return manager;
  }

  async createManager(managerData: InsertManager): Promise<Manager> {
    const [manager] = await db.insert(managers).values(managerData).returning();
    return manager;
  }

  async updateManager(telegramId: string, updates: Partial<InsertManager>): Promise<Manager> {
    const [manager] = await db
      .update(managers)
      .set(updates)
      .where(eq(managers.telegramId, telegramId))
      .returning();
    return manager;
  }

  async getTelegramUpdates(projectId?: string): Promise<TelegramUpdate[]> {
    if (projectId) {
      return await db
        .select()
        .from(telegramUpdates)
        .where(eq(telegramUpdates.projectId, projectId))
        .orderBy(desc(telegramUpdates.timestamp));
    }
    return await db.select().from(telegramUpdates).orderBy(desc(telegramUpdates.timestamp));
  }

  async createTelegramUpdate(updateData: InsertTelegramUpdate): Promise<TelegramUpdate> {
    const [update] = await db.insert(telegramUpdates).values(updateData).returning();
    return update;
  }
}

export const storage = new DatabaseStorage();
