import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Projects
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  budget: decimal("budget", { precision: 15, scale: 2 }).notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: varchar("status", { length: 50 }).notNull().default('Active'),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tasks
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: varchar("priority", { length: 20 }).notNull().default('Medium'),
  dueDate: timestamp("due_date"),
  location: varchar("location", { length: 255 }),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Updates (reports)
export const updates = pgTable("updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  taskId: varchar("task_id").references(() => tasks.id, { onDelete: 'set null' }),
  managerName: varchar("manager_name", { length: 255 }).notNull(),
  taskTitle: varchar("task_title", { length: 255 }).notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
  photos: text("photos").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Advances (money sent to managers)
export const advances = pgTable("advances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  totalDeposited: decimal("total_deposited", { precision: 12, scale: 2 }).notNull().default('0'),
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).notNull().default('0'),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Supplier purchases
export const supplierPurchases = pgTable("supplier_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierId: varchar("supplier_id").references(() => suppliers.id, { onDelete: 'cascade' }).notNull(),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  item: varchar("item", { length: 255 }).notNull(),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Inventory
export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  item: varchar("item", { length: 255 }).notNull(),
  quantity: integer("quantity").notNull(),
  deliveryDate: timestamp("delivery_date").notNull(),
  used: integer("used").notNull().default(0),
  remaining: integer("remaining").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Milestones
export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  targetDate: timestamp("target_date").notNull(),
  completed: boolean("completed").notNull().default(false),
  progress: integer("progress").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily ledgers
export const dailyLedgers = pgTable("daily_ledgers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  date: timestamp("date").notNull(),
  openingCash: decimal("opening_cash", { precision: 12, scale: 2 }).notNull(),
  closingCash: decimal("closing_cash", { precision: 12, scale: 2 }).notNull(),
  totalCashSpent: decimal("total_cash_spent", { precision: 12, scale: 2 }).notNull().default('0'),
  totalSupplierSpent: decimal("total_supplier_spent", { precision: 12, scale: 2 }).notNull().default('0'),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily ledger lines
export const dailyLedgerLines = pgTable("daily_ledger_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ledgerId: varchar("ledger_id").references(() => dailyLedgers.id, { onDelete: 'cascade' }).notNull(),
  item: varchar("item", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cash deposits - when owner sends money to manager
export const cashDeposits = pgTable("cash_deposits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  method: varchar("method", { length: 50 }).notNull(), // Mobile Money, Bank Transfer, Cash Handover
  reference: varchar("reference", { length: 100 }), // Transaction reference/receipt number
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Telegram bot managers - tracks approved managers who can use the bot
export const managers = pgTable("managers", {
  telegramId: varchar("telegram_id").primaryKey(),
  approved: boolean("approved").notNull().default(false),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  username: varchar("username", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Telegram bot updates - project updates submitted via Telegram bot
export const telegramUpdates = pgTable("telegram_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  telegramId: varchar("telegram_id").references(() => managers.telegramId, { onDelete: 'cascade' }).notNull(),
  taskStatus: text("task_status"),
  hours: integer("hours"),
  expenses: decimal("expenses", { precision: 12, scale: 2 }),
  inventory: text("inventory"),
  issues: text("issues"),
  photoUrl: text("photo_url"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Relations
export const projectsRelations = relations(projects, ({ many, one }) => ({
  tasks: many(tasks),
  updates: many(updates),
  advances: many(advances),
  supplierPurchases: many(supplierPurchases),
  inventory: many(inventory),
  milestones: many(milestones),
  dailyLedgers: many(dailyLedgers),
  cashDeposits: many(cashDeposits),
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  updates: many(updates),
}));

export const updatesRelations = relations(updates, ({ one }) => ({
  project: one(projects, {
    fields: [updates.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [updates.taskId],
    references: [tasks.id],
  }),
}));

export const dailyLedgersRelations = relations(dailyLedgers, ({ one, many }) => ({
  project: one(projects, {
    fields: [dailyLedgers.projectId],
    references: [projects.id],
  }),
  lines: many(dailyLedgerLines),
}));

export const dailyLedgerLinesRelations = relations(dailyLedgerLines, ({ one }) => ({
  ledger: one(dailyLedgers, {
    fields: [dailyLedgerLines.ledgerId],
    references: [dailyLedgers.id],
  }),
}));

export const cashDepositsRelations = relations(cashDeposits, ({ one }) => ({
  project: one(projects, {
    fields: [cashDeposits.projectId],
    references: [projects.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchases: many(supplierPurchases),
}));

export const supplierPurchasesRelations = relations(supplierPurchases, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierPurchases.supplierId],
    references: [suppliers.id],
  }),
  project: one(projects, {
    fields: [supplierPurchases.projectId],
    references: [projects.id],
  }),
}));

export const managersRelations = relations(managers, ({ many }) => ({
  telegramUpdates: many(telegramUpdates),
}));

export const telegramUpdatesRelations = relations(telegramUpdates, ({ one }) => ({
  project: one(projects, {
    fields: [telegramUpdates.projectId],
    references: [projects.id],
  }),
  manager: one(managers, {
    fields: [telegramUpdates.telegramId],
    references: [managers.telegramId],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects, {
  startDate: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    return typeof val === 'string' ? new Date(val) : val;
  }),
  endDate: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    return typeof val === 'string' ? new Date(val) : val;
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks, {
  dueDate: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    return typeof val === 'string' ? new Date(val) : val;
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUpdateSchema = createInsertSchema(updates).omit({
  id: true,
  createdAt: true,
});

export const insertAdvanceSchema = createInsertSchema(advances).omit({
  id: true,
  createdAt: true,
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupplierPurchaseSchema = createInsertSchema(supplierPurchases, {
  date: z.union([z.string(), z.date()]).transform((val) => {
    return typeof val === 'string' ? new Date(val) : val;
  }),
}).omit({
  id: true,
  createdAt: true,
});

export const insertInventorySchema = createInsertSchema(inventory, {
  deliveryDate: z.union([z.string(), z.date()]).transform((val) => {
    return typeof val === 'string' ? new Date(val) : val;
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMilestoneSchema = createInsertSchema(milestones, {
  targetDate: z.union([z.string(), z.date()]).transform((val) => {
    return typeof val === 'string' ? new Date(val) : val;
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDailyLedgerSchema = createInsertSchema(dailyLedgers, {
  date: z.union([z.string(), z.date()]).transform((val) => {
    return typeof val === 'string' ? new Date(val) : val;
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDailyLedgerLineSchema = createInsertSchema(dailyLedgerLines).omit({
  id: true,
  createdAt: true,
});

export const insertCashDepositSchema = createInsertSchema(cashDeposits, {
  date: z.union([z.string(), z.date()]).transform((val) => {
    return typeof val === 'string' ? new Date(val) : val;
  }),
}).omit({
  id: true,
  createdAt: true,
});

export const insertManagerSchema = createInsertSchema(managers).omit({
  createdAt: true,
});

export const insertTelegramUpdateSchema = createInsertSchema(telegramUpdates).omit({
  id: true,
  timestamp: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Update = typeof updates.$inferSelect;
export type InsertUpdate = z.infer<typeof insertUpdateSchema>;
export type Advance = typeof advances.$inferSelect;
export type InsertAdvance = z.infer<typeof insertAdvanceSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type SupplierPurchase = typeof supplierPurchases.$inferSelect;
export type InsertSupplierPurchase = z.infer<typeof insertSupplierPurchaseSchema>;
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Milestone = typeof milestones.$inferSelect;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type DailyLedger = typeof dailyLedgers.$inferSelect;
export type InsertDailyLedger = z.infer<typeof insertDailyLedgerSchema>;
export type DailyLedgerLine = typeof dailyLedgerLines.$inferSelect;
export type InsertDailyLedgerLine = z.infer<typeof insertDailyLedgerLineSchema>;
export type CashDeposit = typeof cashDeposits.$inferSelect;
export type InsertCashDeposit = z.infer<typeof insertCashDepositSchema>;
export type Manager = typeof managers.$inferSelect;
export type InsertManager = z.infer<typeof insertManagerSchema>;
export type TelegramUpdate = typeof telegramUpdates.$inferSelect;
export type InsertTelegramUpdate = z.infer<typeof insertTelegramUpdateSchema>;
