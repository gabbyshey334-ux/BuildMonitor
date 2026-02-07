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
  constructionPhases,
  historicalExpenses,
  userPreferences,
  whatsappMessages,
  profiles,
  type User,
  type UpsertUser,
  type Profile,
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
  type ConstructionPhase,
  type InsertConstructionPhase,
  type HistoricalExpense,
  type InsertHistoricalExpense,
  type UserPreferences,
  type InsertUserPreferences,
  type WhatsappMessage,
  type InsertWhatsappMessage,
} from "@shared/schema";
import { db } from "./db.js";
import { eq, desc, and, sum, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // User preferences operations
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  upsertUserPreferences(userId: string, preferences: Partial<InsertUserPreferences>): Promise<UserPreferences>;
  
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
  getSupplierTransactionHistory(supplierId: string, projectId?: string): Promise<{
    purchases: (SupplierPurchase & { source: 'purchase' })[];
    ledgerEntries: (DailyLedgerLine & { date: Date; source: 'ledger' })[];
  }>;
  
  // Inventory operations
  getInventory(projectId: string): Promise<Inventory[]>;
  createInventoryItem(item: InsertInventory): Promise<Inventory>;
  updateInventoryItem(id: string, updates: Partial<InsertInventory>): Promise<Inventory>;
  getInventoryByLocation(projectId: string, location: 'hardware' | 'on-site'): Promise<Inventory[]>;
  getInventoryAnalytics(projectId: string): Promise<{
    hardwareItems: { item: string; totalQuantity: number; totalRemaining: number; totalUsed: number; locations: number }[];
    onSiteItems: { item: string; totalQuantity: number; totalRemaining: number; totalUsed: number; locations: number }[];
    totalHardwareValue: number;
    totalOnSiteValue: number;
  }>;
  
  // Milestone operations
  getMilestones(projectId: string): Promise<Milestone[]>;
  createMilestone(milestone: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: string, updates: Partial<InsertMilestone>): Promise<Milestone>;
  
  // Daily ledger operations
  getDailyLedgers(projectId: string): Promise<(DailyLedger & { lines: DailyLedgerLine[] })[]>;
  getDailyLedgerByDate(projectId: string, date: Date): Promise<DailyLedger | undefined>;
  getDailyLedgerLines(ledgerId: string): Promise<DailyLedgerLine[]>;
  createDailyLedger(ledger: InsertDailyLedger, lines?: InsertDailyLedgerLine[]): Promise<DailyLedger>;
  createDailyLedgerLine(line: InsertDailyLedgerLine): Promise<DailyLedgerLine>;
  updateDailyLedger(id: string, updates: Partial<InsertDailyLedger>): Promise<DailyLedger>;
  updateDailyLedgerWithLines(id: string, ledgerUpdates: Partial<InsertDailyLedger>, lines: InsertDailyLedgerLine[]): Promise<DailyLedger>;
  
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

  // Recent activities
  getRecentActivities(projectId: string, limit?: number): Promise<{
    id: string;
    type: string;
    title: string;
    description: string;
    amount?: number;
    category?: string;
    createdAt: Date;
    userId?: string;
  }[]>;

  // Construction phase operations
  getConstructionPhases(): Promise<ConstructionPhase[]>;
  createConstructionPhase(phase: InsertConstructionPhase): Promise<ConstructionPhase>;
  updateConstructionPhase(id: string, updates: Partial<InsertConstructionPhase>): Promise<ConstructionPhase>;
  deleteConstructionPhase(id: string): Promise<void>;

  // Historical expense operations
  getHistoricalExpenses(projectId: string): Promise<HistoricalExpense[]>;
  createHistoricalExpense(expense: InsertHistoricalExpense): Promise<HistoricalExpense>;
  updateHistoricalExpense(id: string, updates: Partial<InsertHistoricalExpense>): Promise<HistoricalExpense>;
  deleteHistoricalExpense(id: string): Promise<void>;
  getHistoricalExpensesByPhase(projectId: string, phaseId: string): Promise<HistoricalExpense[]>;

  // WhatsApp message operations
  findUserByWhatsApp(whatsappNumber: string): Promise<User | undefined>;
  createWhatsAppUser(whatsappNumber: string, name?: string): Promise<User>;
  storeWhatsAppMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  getMessageHistory(whatsappNumber: string, limit?: number): Promise<WhatsappMessage[]>;
  getUserMessages(userId: string, limit?: number): Promise<WhatsappMessage[]>;
  getProjectMessages(projectId: string, limit?: number): Promise<WhatsappMessage[]>;
  getAllMessages(filters?: {
    projectId?: string;
    userId?: string;
    whatsappNumber?: string;
    direction?: 'incoming' | 'outgoing';
    startDate?: Date;
    endDate?: Date;
  }, limit?: number): Promise<WhatsappMessage[]>;
  updateMessageStatus(id: string, status: string): Promise<WhatsappMessage>;
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
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return preferences;
  }

  async upsertUserPreferences(userId: string, preferenceData: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const [preferences] = await db
      .insert(userPreferences)
      .values({
        userId,
        ...preferenceData,
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          ...preferenceData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return preferences;
  }

  // Project operations
  async getProjects(userId: string): Promise<Project[]> {
    // For construction management, both owner and manager should see all projects
    // This allows real-time collaboration between roles
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
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
    return await db.transaction(async (tx) => {
      const [newPurchase] = await tx.insert(supplierPurchases).values(purchase).returning();
      
      // Update supplier balance within the same transaction
      await tx
        .update(suppliers)
        .set({
          totalSpent: sql`${suppliers.totalSpent} + ${purchase.amount}`,
          currentBalance: sql`${suppliers.currentBalance} - ${purchase.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(suppliers.id, purchase.supplierId));

      return newPurchase;
    });
  }

  async getSupplierTransactionHistory(supplierId: string, projectId?: string): Promise<{
    purchases: (SupplierPurchase & { source: 'purchase' })[];
    ledgerEntries: (DailyLedgerLine & { date: Date; source: 'ledger' })[];
  }> {
    // Get direct purchases
    let purchaseQuery = db
      .select()
      .from(supplierPurchases)
      .where(eq(supplierPurchases.supplierId, supplierId));

    if (projectId) {
      purchaseQuery = db
        .select()
        .from(supplierPurchases)
        .where(
          and(
            eq(supplierPurchases.supplierId, supplierId),
            eq(supplierPurchases.projectId, projectId)
          )
        );
    }

    const purchases = await purchaseQuery.orderBy(desc(supplierPurchases.date));

    // Get ledger entries with supplier payments
    let ledgerQuery = db
      .select({
        id: dailyLedgerLines.id,
        ledgerId: dailyLedgerLines.ledgerId,
        item: dailyLedgerLines.item,
        category: dailyLedgerLines.category,
        amount: dailyLedgerLines.amount,
        paymentMethod: dailyLedgerLines.paymentMethod,
        quantity: dailyLedgerLines.quantity,
        unit: dailyLedgerLines.unit,
        supplierId: dailyLedgerLines.supplierId,
        phaseId: dailyLedgerLines.phaseId,
        note: dailyLedgerLines.note,
        createdAt: dailyLedgerLines.createdAt,
        date: dailyLedgers.date,
      })
      .from(dailyLedgerLines)
      .innerJoin(dailyLedgers, eq(dailyLedgers.id, dailyLedgerLines.ledgerId))
      .where(
        and(
          eq(dailyLedgerLines.supplierId, supplierId),
          eq(dailyLedgerLines.paymentMethod, 'supplier')
        )
      );

    if (projectId) {
      ledgerQuery = db
        .select({
          id: dailyLedgerLines.id,
          ledgerId: dailyLedgerLines.ledgerId,
          item: dailyLedgerLines.item,
          category: dailyLedgerLines.category,
          amount: dailyLedgerLines.amount,
          paymentMethod: dailyLedgerLines.paymentMethod,
          quantity: dailyLedgerLines.quantity,
          unit: dailyLedgerLines.unit,
          supplierId: dailyLedgerLines.supplierId,
          phaseId: dailyLedgerLines.phaseId,
          note: dailyLedgerLines.note,
          createdAt: dailyLedgerLines.createdAt,
          date: dailyLedgers.date,
        })
        .from(dailyLedgerLines)
        .innerJoin(dailyLedgers, eq(dailyLedgers.id, dailyLedgerLines.ledgerId))
        .where(
          and(
            eq(dailyLedgerLines.supplierId, supplierId),
            eq(dailyLedgerLines.paymentMethod, 'supplier'),
            eq(dailyLedgers.projectId, projectId)
          )
        );
    }

    const ledgerEntries = await ledgerQuery.orderBy(desc(dailyLedgers.date));

    return {
      purchases: purchases.map(p => ({ ...p, source: 'purchase' as const })),
      ledgerEntries: ledgerEntries.map(l => ({ ...l, source: 'ledger' as const })),
    };
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

  async getInventoryByLocation(projectId: string, location: 'hardware' | 'on-site'): Promise<Inventory[]> {
    return await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.projectId, projectId),
          eq(inventory.location, location)
        )
      )
      .orderBy(desc(inventory.createdAt));
  }

  async getInventoryAnalytics(projectId: string): Promise<{
    hardwareItems: { item: string; totalQuantity: number; totalRemaining: number; totalUsed: number; locations: number }[];
    onSiteItems: { item: string; totalQuantity: number; totalRemaining: number; totalUsed: number; locations: number }[];
    totalHardwareValue: number;
    totalOnSiteValue: number;
  }> {
    // Get aggregated hardware items
    const hardwareItems = await db
      .select({
        item: inventory.item,
        totalQuantity: sum(inventory.quantity),
        totalRemaining: sum(inventory.remaining),
        totalUsed: sum(inventory.used),
        locations: sql<number>`COUNT(DISTINCT ${inventory.id})`,
      })
      .from(inventory)
      .where(
        and(
          eq(inventory.projectId, projectId),
          eq(inventory.location, 'hardware')
        )
      )
      .groupBy(inventory.item);

    // Get aggregated on-site items
    const onSiteItems = await db
      .select({
        item: inventory.item,
        totalQuantity: sum(inventory.quantity),
        totalRemaining: sum(inventory.remaining),
        totalUsed: sum(inventory.used),
        locations: sql<number>`COUNT(DISTINCT ${inventory.id})`,
      })
      .from(inventory)
      .where(
        and(
          eq(inventory.projectId, projectId),
          eq(inventory.location, 'on-site')
        )
      )
      .groupBy(inventory.item);

    // Note: We can't calculate actual value without purchase prices
    // For now, we return 0 for total values or could estimate based on recent purchase prices
    const totalHardwareValue = 0;
    const totalOnSiteValue = 0;

    return {
      hardwareItems: hardwareItems.map(item => ({
        item: item.item,
        totalQuantity: Number(item.totalQuantity) || 0,
        totalRemaining: Number(item.totalRemaining) || 0,
        totalUsed: Number(item.totalUsed) || 0,
        locations: Number(item.locations) || 0,
      })),
      onSiteItems: onSiteItems.map(item => ({
        item: item.item,
        totalQuantity: Number(item.totalQuantity) || 0,
        totalRemaining: Number(item.totalRemaining) || 0,
        totalUsed: Number(item.totalUsed) || 0,
        locations: Number(item.locations) || 0,
      })),
      totalHardwareValue,
      totalOnSiteValue,
    };
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

  async getDailyLedgerByDate(projectId: string, date: Date): Promise<DailyLedger | undefined> {
    const dateString = date.toISOString().split('T')[0];
    const [ledger] = await db
      .select()
      .from(dailyLedgers)
      .where(
        and(
          eq(dailyLedgers.projectId, projectId),
          sql`DATE(${dailyLedgers.date}) = ${dateString}`
        )
      )
      .limit(1);
    return ledger;
  }

  async getDailyLedgerLines(ledgerId: string): Promise<DailyLedgerLine[]> {
    return await db
      .select()
      .from(dailyLedgerLines)
      .where(eq(dailyLedgerLines.ledgerId, ledgerId))
      .orderBy(dailyLedgerLines.createdAt);
  }

  async createDailyLedgerLine(line: InsertDailyLedgerLine): Promise<DailyLedgerLine> {
    const [newLine] = await db.insert(dailyLedgerLines).values(line).returning();
    
    // Update ledger totals
    const ledger = await db
      .select()
      .from(dailyLedgers)
      .where(eq(dailyLedgers.id, line.ledgerId))
      .limit(1);
    
    if (ledger.length > 0) {
      const allLines = await this.getDailyLedgerLines(line.ledgerId);
      const totalCashSpent = allLines
        .filter(l => l.paymentMethod === 'cash')
        .reduce((sum, l) => sum + parseFloat(l.amount.toString()), 0);
      const totalSupplierSpent = allLines
        .filter(l => l.paymentMethod === 'supplier')
        .reduce((sum, l) => sum + parseFloat(l.amount.toString()), 0);
      
      await db
        .update(dailyLedgers)
        .set({
          totalCashSpent: totalCashSpent.toString(),
          totalSupplierSpent: totalSupplierSpent.toString(),
          closingCash: (parseFloat(ledger[0].openingCash.toString()) - totalCashSpent).toString(),
          updatedAt: new Date(),
        })
        .where(eq(dailyLedgers.id, line.ledgerId));
    }
    
    return newLine;
  }

  async createDailyLedger(ledger: InsertDailyLedger, lines: InsertDailyLedgerLine[] = []): Promise<DailyLedger> {
    return await db.transaction(async (tx) => {
      // Check for existing ledger on the same date
      const ledgerDate = ledger.date instanceof Date ? ledger.date : new Date(ledger.date);
      const dateString = ledgerDate.toISOString().split('T')[0];
      
      const existingLedger = await tx
        .select()
        .from(dailyLedgers)
        .where(
          and(
            eq(dailyLedgers.projectId, ledger.projectId),
            sql`DATE(${dailyLedgers.date}) = ${dateString}`
          )
        )
        .limit(1);
      
      if (existingLedger.length > 0) {
        throw new Error(`A daily ledger already exists for ${dateString}. You can edit the existing ledger instead of creating a new one.`);
      }
      
      const [newLedger] = await tx.insert(dailyLedgers).values(ledger).returning();
      
      if (lines.length > 0) {
        await tx.insert(dailyLedgerLines).values(
          lines.map(line => ({ ...line, ledgerId: newLedger.id }))
        );
      }
      
      // Auto-create supplier purchases and inventory records within transaction
      await this.autoCreateSupplierPurchasesAndInventoryTx(tx, newLedger, lines);
      
      return newLedger;
    });
  }

  // Helper method to auto-create supplier purchases and inventory records
  private async autoCreateSupplierPurchasesAndInventory(ledger: DailyLedger, lines: InsertDailyLedgerLine[]): Promise<void> {
    for (const line of lines) {
      // Create supplier purchase if payment method is supplier and supplierId is provided
      if (line.paymentMethod === 'supplier' && line.supplierId) {
        await db.insert(supplierPurchases).values({
          supplierId: line.supplierId,
          projectId: ledger.projectId,
          amount: line.amount,
          item: line.item,
          date: ledger.date,
        });

        // Update supplier totals
        await db
          .update(suppliers)
          .set({ 
            totalSpent: sql`${suppliers.totalSpent} + ${line.amount}`,
            currentBalance: sql`${suppliers.currentBalance} - ${line.amount}`,
            updatedAt: new Date()
          })
          .where(eq(suppliers.id, line.supplierId));
      }

      // Create inventory record if category is Materials or Equipment and quantity is provided
      if ((line.category === 'Materials' || line.category === 'Equipment') && line.quantity && line.unit) {
        const quantity = parseInt(line.quantity);
        await db.insert(inventory).values({
          projectId: ledger.projectId,
          item: line.item,
          quantity: quantity,
          deliveryDate: ledger.date,
          used: 0,
          remaining: quantity,
        });
      }
    }
  }

  // Transaction-aware helper method for auto-creating supplier purchases and inventory records
  private async autoCreateSupplierPurchasesAndInventoryTx(tx: any, ledger: DailyLedger, lines: InsertDailyLedgerLine[]): Promise<void> {
    for (const line of lines) {
      // Create supplier purchase if payment method is supplier and supplierId is provided
      if (line.paymentMethod === 'supplier' && line.supplierId) {
        // Get current supplier balance to validate the purchase
        const [supplier] = await tx
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, line.supplierId))
          .limit(1);

        if (!supplier) {
          throw new Error(`Supplier with ID ${line.supplierId} not found`);
        }

        const purchaseAmount = parseFloat(line.amount);
        const currentBalance = parseFloat(supplier.currentBalance);

        if (purchaseAmount > currentBalance) {
          const shortfall = purchaseAmount - currentBalance;
          throw new Error(`Insufficient supplier balance for ${supplier.name}. Purchase amount (${purchaseAmount.toLocaleString()} UGX) exceeds available balance (${currentBalance.toLocaleString()} UGX) by ${shortfall.toLocaleString()} UGX. Please add more credit to this supplier first.`);
        }

        await tx.insert(supplierPurchases).values({
          supplierId: line.supplierId,
          projectId: ledger.projectId,
          amount: line.amount,
          item: line.item,
          date: ledger.date,
        });

        // Update supplier totals
        await tx
          .update(suppliers)
          .set({ 
            totalSpent: sql`${suppliers.totalSpent} + ${line.amount}`,
            currentBalance: sql`${suppliers.currentBalance} - ${line.amount}`,
            updatedAt: new Date()
          })
          .where(eq(suppliers.id, line.supplierId));
      }

      // Create inventory record if category is Materials or Equipment and quantity is provided
      if ((line.category === 'Materials' || line.category === 'Equipment') && line.quantity && line.unit) {
        const quantity = parseInt(line.quantity);
        await tx.insert(inventory).values({
          projectId: ledger.projectId,
          item: line.item,
          quantity: quantity,
          deliveryDate: ledger.date,
          used: 0,
          remaining: quantity,
        });
      }
    }
  }

  // Helper method to reverse supplier purchases and inventory when updating ledgers
  private async reverseSupplierPurchasesAndInventory(ledger: DailyLedger, lines: DailyLedgerLine[]): Promise<void> {
    for (const line of lines) {
      // Remove supplier purchase and reverse supplier totals if payment method is supplier
      if (line.paymentMethod === 'supplier' && line.supplierId) {
        // Remove the supplier purchase record
        await db
          .delete(supplierPurchases)
          .where(
            and(
              eq(supplierPurchases.supplierId, line.supplierId),
              eq(supplierPurchases.projectId, ledger.projectId),
              eq(supplierPurchases.item, line.item),
              eq(supplierPurchases.amount, line.amount)
            )
          );

        // Reverse supplier totals
        await db
          .update(suppliers)
          .set({ 
            totalSpent: sql`${suppliers.totalSpent} - ${line.amount}`,
            currentBalance: sql`${suppliers.currentBalance} + ${line.amount}`,
            updatedAt: new Date()
          })
          .where(eq(suppliers.id, line.supplierId));
      }

      // Remove inventory record if it was created from this line
      if ((line.category === 'Materials' || line.category === 'Equipment') && line.quantity && line.unit) {
        await db
          .delete(inventory)
          .where(
            and(
              eq(inventory.projectId, ledger.projectId),
              eq(inventory.item, line.item),
              eq(inventory.deliveryDate, ledger.date)
            )
          );
      }
    }
  }

  // Transaction-aware helper method to reverse supplier purchases and inventory when updating ledgers
  private async reverseSupplierPurchasesAndInventoryTx(tx: any, ledger: DailyLedger, lines: DailyLedgerLine[]): Promise<void> {
    for (const line of lines) {
      // Remove supplier purchase and reverse supplier totals if payment method is supplier
      if (line.paymentMethod === 'supplier' && line.supplierId) {
        // Remove the supplier purchase record
        await tx
          .delete(supplierPurchases)
          .where(
            and(
              eq(supplierPurchases.supplierId, line.supplierId),
              eq(supplierPurchases.projectId, ledger.projectId),
              eq(supplierPurchases.item, line.item),
              eq(supplierPurchases.amount, line.amount)
            )
          );

        // Reverse supplier totals
        await tx
          .update(suppliers)
          .set({ 
            totalSpent: sql`${suppliers.totalSpent} - ${line.amount}`,
            currentBalance: sql`${suppliers.currentBalance} + ${line.amount}`,
            updatedAt: new Date()
          })
          .where(eq(suppliers.id, line.supplierId));
      }

      // Remove inventory record if it was created from this line
      if ((line.category === 'Materials' || line.category === 'Equipment') && line.quantity && line.unit) {
        await tx
          .delete(inventory)
          .where(
            and(
              eq(inventory.projectId, ledger.projectId),
              eq(inventory.item, line.item),
              eq(inventory.deliveryDate, ledger.date)
            )
          );
      }
    }
  }

  async updateDailyLedger(id: string, updates: Partial<InsertDailyLedger>): Promise<DailyLedger> {
    const [ledger] = await db
      .update(dailyLedgers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dailyLedgers.id, id))
      .returning();
    return ledger;
  }

  async updateDailyLedgerWithLines(id: string, ledgerUpdates: Partial<InsertDailyLedger>, lines: InsertDailyLedgerLine[]): Promise<DailyLedger> {
    return await db.transaction(async (tx) => {
      // Get the existing ledger first
      const [existingLedger] = await tx
        .select()
        .from(dailyLedgers)
        .where(eq(dailyLedgers.id, id))
        .limit(1);

      if (!existingLedger) {
        throw new Error('Ledger not found');
      }

      // Get existing lines to reverse any supplier/inventory changes
      const existingLines = await tx
        .select()
        .from(dailyLedgerLines)
        .where(eq(dailyLedgerLines.ledgerId, id));

      // Reverse existing supplier purchases and inventory within transaction
      await this.reverseSupplierPurchasesAndInventoryTx(tx, existingLedger, existingLines);

      // Update the ledger
      const [updatedLedger] = await tx
        .update(dailyLedgers)
        .set({ ...ledgerUpdates, updatedAt: new Date() })
        .where(eq(dailyLedgers.id, id))
        .returning();
      
      // Delete existing lines and insert new ones
      await tx.delete(dailyLedgerLines).where(eq(dailyLedgerLines.ledgerId, id));
      
      if (lines.length > 0) {
        await tx.insert(dailyLedgerLines).values(
          lines.map(line => ({ ...line, ledgerId: id }))
        );
      }
      
      // Auto-create new supplier purchases and inventory records within transaction
      await this.autoCreateSupplierPurchasesAndInventoryTx(tx, updatedLedger, lines);
      
      return updatedLedger;
    });
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
          sql`${cashDeposits.date} >= ${startDate}`,
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

    // Get total spent from daily ledgers
    const ledgers = await db
      .select()
      .from(dailyLedgers)
      .where(eq(dailyLedgers.projectId, projectId));

    let totalCashSpent = 0;
    let totalSupplierSpent = 0;
    const categoryBreakdown: Record<string, number> = {};

    // Sum up spending from all daily ledgers
    for (const ledger of ledgers) {
      totalCashSpent += parseFloat(ledger.totalCashSpent || '0');
      totalSupplierSpent += parseFloat(ledger.totalSupplierSpent || '0');

      // Get category breakdown from ledger lines
      const lines = await db
        .select()
        .from(dailyLedgerLines)
        .where(eq(dailyLedgerLines.ledgerId, ledger.id));

      lines.forEach((line) => {
        const amount = parseFloat(line.amount);
        categoryBreakdown[line.category] = (categoryBreakdown[line.category] || 0) + amount;
      });
    }

    // Add historical expenses to spending calculations
    const historicalExpensesList = await db
      .select()
      .from(historicalExpenses)
      .where(eq(historicalExpenses.projectId, projectId));

    let historicalCashSpent = 0;
    let historicalSupplierSpent = 0;

    for (const expense of historicalExpensesList) {
      const amount = parseFloat(expense.amount);
      
      // Add to payment method totals
      if (expense.paymentMethod === 'cash') {
        historicalCashSpent += amount;
      } else {
        historicalSupplierSpent += amount;
      }
      
      // Add to category breakdown
      categoryBreakdown[expense.category] = (categoryBreakdown[expense.category] || 0) + amount;
    }

    // Include historical expenses in totals
    totalCashSpent += historicalCashSpent;
    totalSupplierSpent += historicalSupplierSpent;
    const totalSpent = totalCashSpent + totalSupplierSpent;

    // Calculate current cash balance: total deposits minus total cash spent (including historical)
    const allDeposits = await db
      .select()
      .from(cashDeposits)
      .where(eq(cashDeposits.projectId, projectId));
    
    const totalDeposits = allDeposits.reduce((sum, deposit) => sum + parseFloat(deposit.amount), 0);
    const cashBalance = totalDeposits - totalCashSpent;

    return {
      totalBudget,
      totalSpent,
      totalCashSpent,
      totalSupplierSpent,
      cashBalance,
      categoryBreakdown,
    };
  }

  // Recent activities
  async getRecentActivities(projectId: string, limit: number = 10): Promise<{
    id: string;
    type: string;
    title: string;
    description: string;
    amount?: number;
    category?: string;
    createdAt: Date;
    userId?: string;
  }[]> {
    const activities: any[] = [];

    // Get recent daily ledger entries
    const recentLedgers = await db
      .select()
      .from(dailyLedgers)
      .where(eq(dailyLedgers.projectId, projectId))
      .orderBy(desc(dailyLedgers.submittedAt))
      .limit(5);

    for (const ledger of recentLedgers) {
      const lines = await db
        .select()
        .from(dailyLedgerLines)
        .where(eq(dailyLedgerLines.ledgerId, ledger.id));

      const totalAmount = parseFloat(ledger.totalCashSpent) + parseFloat(ledger.totalSupplierSpent);
      
      // Format the ledger date nicely
      const ledgerDate = new Date(ledger.date).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      });
      
      activities.push({
        id: `ledger-${ledger.id}`,
        type: 'daily_ledger',
        title: `Daily Ledger for ${ledgerDate}`,
        description: `Recorded ${lines.length} expense items`,
        amount: totalAmount,
        category: 'Finance',
        createdAt: ledger.submittedAt || ledger.createdAt,
        ledgerDate: ledger.date, // Add the actual ledger date
        userId: 'manager'
      });
    }

    // Get recent cash deposits
    const recentDeposits = await db
      .select()
      .from(cashDeposits)
      .where(eq(cashDeposits.projectId, projectId))
      .orderBy(desc(cashDeposits.createdAt))
      .limit(5);

    for (const deposit of recentDeposits) {
      activities.push({
        id: `deposit-${deposit.id}`,
        type: 'cash_deposit',
        title: 'Cash Deposit',
        description: `Cash sent to manager`,
        amount: parseFloat(deposit.amount),
        category: 'Finance',
        createdAt: deposit.createdAt,
        userId: 'owner'
      });
    }

    // Get recent task updates
    const recentTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(desc(tasks.updatedAt))
      .limit(5);

    for (const task of recentTasks) {
      if (task.updatedAt && task.createdAt && task.updatedAt > task.createdAt) {
        activities.push({
          id: `task-${task.id}`,
          type: 'task_update',
          title: task.completed ? 'Task Completed' : 'Task Updated',
          description: task.title,
          category: 'Project',
          createdAt: task.updatedAt,
          userId: 'manager'
        });
      }
    }

    // Get recent milestone updates
    const recentMilestones = await db
      .select()
      .from(milestones)
      .where(eq(milestones.projectId, projectId))
      .orderBy(desc(milestones.updatedAt))
      .limit(5);

    for (const milestone of recentMilestones) {
      if (milestone.updatedAt && milestone.createdAt && milestone.updatedAt > milestone.createdAt) {
        activities.push({
          id: `milestone-${milestone.id}`,
          type: 'milestone_update',
          title: milestone.completed ? 'Milestone Completed' : 'Milestone Updated',
          description: milestone.title,
          category: 'Project',
          createdAt: milestone.updatedAt,
          userId: 'manager'
        });
      }
    }

    // Sort by creation date and limit results
    return activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // Construction phase operations
  async getConstructionPhases(): Promise<ConstructionPhase[]> {
    return await db
      .select()
      .from(constructionPhases)
      .orderBy(constructionPhases.sortOrder);
  }

  async createConstructionPhase(phase: InsertConstructionPhase): Promise<ConstructionPhase> {
    const [newPhase] = await db.insert(constructionPhases).values(phase).returning();
    return newPhase;
  }

  async updateConstructionPhase(id: string, updates: Partial<InsertConstructionPhase>): Promise<ConstructionPhase> {
    const [phase] = await db
      .update(constructionPhases)
      .set(updates)
      .where(eq(constructionPhases.id, id))
      .returning();
    return phase;
  }

  async deleteConstructionPhase(id: string): Promise<void> {
    await db.delete(constructionPhases).where(eq(constructionPhases.id, id));
  }

  // Historical expense operations
  async getHistoricalExpenses(projectId: string): Promise<HistoricalExpense[]> {
    return await db
      .select()
      .from(historicalExpenses)
      .where(eq(historicalExpenses.projectId, projectId))
      .orderBy(desc(historicalExpenses.date));
  }

  async createHistoricalExpense(expense: InsertHistoricalExpense): Promise<HistoricalExpense> {
    const [newExpense] = await db.insert(historicalExpenses).values(expense).returning();
    return newExpense;
  }

  async updateHistoricalExpense(id: string, updates: Partial<InsertHistoricalExpense>): Promise<HistoricalExpense> {
    const [expense] = await db
      .update(historicalExpenses)
      .set(updates)
      .where(eq(historicalExpenses.id, id))
      .returning();
    return expense;
  }

  async deleteHistoricalExpense(id: string): Promise<void> {
    await db.delete(historicalExpenses).where(eq(historicalExpenses.id, id));
  }

  async getHistoricalExpensesByPhase(projectId: string, phaseId: string): Promise<HistoricalExpense[]> {
    return await db
      .select()
      .from(historicalExpenses)
      .where(
        and(
          eq(historicalExpenses.projectId, projectId),
          eq(historicalExpenses.phaseId, phaseId)
        )
      )
      .orderBy(desc(historicalExpenses.date));
  }

  // WhatsApp message operations
  async findUserByWhatsApp(whatsappNumber: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.whatsappNumber, whatsappNumber));
    return user;
  }

  async createWhatsAppUser(whatsappNumber: string, name?: string): Promise<User> {
    const userId = `whatsapp_${whatsappNumber.replace(/[^0-9]/g, '')}_${Date.now()}`;
    const [user] = await db
      .insert(users)
      .values({
        id: userId,
        whatsappNumber,
        firstName: name || `WhatsApp User`,
        lastName: whatsappNumber,
      })
      .returning();
    return user;
  }

  async storeWhatsAppMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [storedMessage] = await db
      .insert(whatsappMessages)
      .values(message)
      .returning();
    return storedMessage;
  }

  async getMessageHistory(whatsappNumber: string, limit: number = 50): Promise<WhatsappMessage[]> {
    return await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.whatsappNumber, whatsappNumber))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(limit);
  }

  async getUserMessages(userId: string, limit: number = 50): Promise<WhatsappMessage[]> {
    return await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.userId, userId))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(limit);
  }

  async getProjectMessages(projectId: string, limit: number = 50): Promise<WhatsappMessage[]> {
    return await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.projectId, projectId))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(limit);
  }

  async getAllMessages(filters?: {
    projectId?: string;
    userId?: string;
    whatsappNumber?: string;
    direction?: 'incoming' | 'outgoing';
    startDate?: Date;
    endDate?: Date;
  }, limit: number = 100): Promise<WhatsappMessage[]> {
    let query = db.select().from(whatsappMessages);

    const conditions: any[] = [];

    if (filters) {
      if (filters.projectId) {
        conditions.push(eq(whatsappMessages.projectId, filters.projectId));
      }
      if (filters.userId) {
        conditions.push(eq(whatsappMessages.userId, filters.userId));
      }
      if (filters.whatsappNumber) {
        conditions.push(eq(whatsappMessages.whatsappNumber, filters.whatsappNumber));
      }
      if (filters.direction) {
        conditions.push(eq(whatsappMessages.direction, filters.direction));
      }
      if (filters.startDate) {
        conditions.push(sql`${whatsappMessages.createdAt} >= ${filters.startDate}`);
      }
      if (filters.endDate) {
        conditions.push(sql`${whatsappMessages.createdAt} <= ${filters.endDate}`);
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(limit);
  }

  async updateMessageStatus(id: string, status: string): Promise<WhatsappMessage> {
    const [message] = await db
      .update(whatsappMessages)
      .set({ status })
      .where(eq(whatsappMessages.id, id))
      .returning();
    return message;
  }

  // Profile-based methods for Supabase integration
  async findProfileByWhatsApp(whatsappNumber: string): Promise<Profile | undefined> {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.whatsappNumber, whatsappNumber));
    return profile;
  }

  async createWhatsAppProfile(whatsappNumber: string, fullName?: string): Promise<Profile> {
    // For now, we'll create a profile without a userId (since we're not using Supabase Auth yet)
    // In production, you'd create a user in Supabase Auth first, then link the profile
    const [profile] = await db
      .insert(profiles)
      .values({
        whatsappNumber,
        fullName: fullName || `User ${whatsappNumber}`,
      })
      .returning();
    return profile;
  }

  async getProjectsByProfile(profileId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, profileId))
      .orderBy(desc(projects.createdAt));
  }

  async updateWhatsAppMessageStatus(id: string, status: string): Promise<WhatsappMessage> {
    const [message] = await db
      .update(whatsappMessages)
      .set({ status })
      .where(eq(whatsappMessages.id, id))
      .returning();
    return message;
  }

}

export const storage = new DatabaseStorage();
