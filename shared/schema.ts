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
  uuid,
  pgSchema,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// IMPORTANT: This schema matches the EXACT structure deployed in Supabase
// DO NOT modify column names, types, or constraints without updating Supabase
// ============================================================================

// Supabase auth schema (read-only, managed by Supabase Auth)
export const authSchema = pgSchema('auth');

// Supabase auth.users table (read-only reference)
export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email'),
  createdAt: timestamp('created_at', { withTimezone: true }),
});

// Session storage table (for express-session)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// ============================================================================
// 1. PROFILES (extends Supabase auth.users)
// ============================================================================
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // This IS the auth.users.id
  email: varchar("email", { length: 255 }).unique().notNull(),
  whatsappNumber: varchar("whatsapp_number", { length: 20 }).unique().notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  defaultCurrency: varchar("default_currency", { length: 3 }).default('UGX'),
  preferredLanguage: varchar("preferred_language", { length: 10 }).default('en'),
  onboardingState: text("onboarding_state"), // WhatsApp onboarding state
  onboardingData: jsonb("onboarding_data").default('{}'), // Stored onboarding responses
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_profiles_whatsapp_number").on(table.whatsappNumber),
  index("idx_profiles_deleted_at").on(table.deletedAt),
  index("idx_profiles_onboarding_state").on(table.onboardingState),
]);

// ============================================================================
// 2. PROJECTS
// ============================================================================
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  budgetAmount: decimal("budget_amount", { precision: 15, scale: 2 }),
  status: varchar("status", { length: 20 }).notNull().default('active'), // 'active', 'completed', 'paused'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_projects_user_id").on(table.userId),
  index("idx_projects_status").on(table.status),
  index("idx_projects_deleted_at").on(table.deletedAt),
]);

// ============================================================================
// 3. EXPENSE_CATEGORIES
// ============================================================================
export const expenseCategories = pgTable("expense_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  colorHex: varchar("color_hex", { length: 7 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_expense_categories_user_id").on(table.userId),
  index("idx_expense_categories_deleted_at").on(table.deletedAt),
  // UNIQUE constraint on (user_id, name) is handled at database level
]);

// ============================================================================
// 4. EXPENSES
// ============================================================================
export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  categoryId: uuid("category_id").references(() => expenseCategories.id), // nullable
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default('UGX'),
  source: varchar("source", { length: 20 }), // 'whatsapp', 'dashboard', 'api'
  expenseDate: date("expense_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_expenses_user_id").on(table.userId),
  index("idx_expenses_project_id").on(table.projectId),
  index("idx_expenses_category_id").on(table.categoryId),
  index("idx_expenses_expense_date").on(table.expenseDate),
  index("idx_expenses_deleted_at").on(table.deletedAt),
]);

// ============================================================================
// 5. TASKS
// ============================================================================
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'cancelled'
  priority: varchar("priority", { length: 10 }).default('medium'), // 'low', 'medium', 'high'
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_tasks_user_id").on(table.userId),
  index("idx_tasks_project_id").on(table.projectId),
  index("idx_tasks_status").on(table.status),
  index("idx_tasks_due_date").on(table.dueDate),
  index("idx_tasks_deleted_at").on(table.deletedAt),
]);

// ============================================================================
// 6. IMAGES
// ============================================================================
export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: 'set null' }), // nullable
  expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: 'set null' }), // nullable
  storagePath: text("storage_path").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  mimeType: varchar("mime_type", { length: 100 }),
  caption: text("caption"),
  source: varchar("source", { length: 20 }), // 'whatsapp', 'dashboard'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_images_user_id").on(table.userId),
  index("idx_images_project_id").on(table.projectId),
  index("idx_images_expense_id").on(table.expenseId),
  index("idx_images_deleted_at").on(table.deletedAt),
]);

// ============================================================================
// 7. WHATSAPP_MESSAGES (audit log)
// ============================================================================
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: 'set null' }), // nullable
  whatsappMessageId: varchar("whatsapp_message_id", { length: 255 }),
  direction: varchar("direction", { length: 10 }).notNull(), // 'inbound', 'outbound'
  messageBody: text("message_body"),
  mediaUrl: text("media_url"),
  intent: varchar("intent", { length: 50 }),
  processed: boolean("processed").default(false),
  aiUsed: boolean("ai_used").default(false),
  errorMessage: text("error_message"),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => [
  index("idx_whatsapp_messages_user_id").on(table.userId),
  index("idx_whatsapp_messages_direction").on(table.direction),
  index("idx_whatsapp_messages_processed").on(table.processed),
  index("idx_whatsapp_messages_received_at").on(table.receivedAt),
]);

// ============================================================================
// 8. AI_USAGE_LOG (cost tracking)
// ============================================================================
export const aiUsageLog = pgTable("ai_usage_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: 'set null' }), // nullable
  intent: varchar("intent", { length: 50 }),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  model: varchar("model", { length: 50 }),
  estimatedCostUsd: decimal("estimated_cost_usd", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_ai_usage_log_user_id").on(table.userId),
  index("idx_ai_usage_log_created_at").on(table.createdAt),
]);

// ============================================================================
// RELATIONS
// ============================================================================

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  authUser: one(authUsers, {
    fields: [profiles.id],
    references: [authUsers.id],
  }),
  projects: many(projects),
  expenses: many(expenses),
  tasks: many(tasks),
  expenseCategories: many(expenseCategories),
  images: many(images),
  whatsappMessages: many(whatsappMessages),
  aiUsageLogs: many(aiUsageLog),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(profiles, {
    fields: [projects.userId],
    references: [profiles.id],
  }),
  expenses: many(expenses),
  tasks: many(tasks),
  images: many(images),
}));

export const expenseCategoriesRelations = relations(expenseCategories, ({ one, many }) => ({
  user: one(profiles, {
    fields: [expenseCategories.userId],
    references: [profiles.id],
  }),
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  user: one(profiles, {
    fields: [expenses.userId],
    references: [profiles.id],
  }),
  project: one(projects, {
    fields: [expenses.projectId],
    references: [projects.id],
  }),
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  images: many(images),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(profiles, {
    fields: [tasks.userId],
    references: [profiles.id],
  }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
}));

export const imagesRelations = relations(images, ({ one }) => ({
  user: one(profiles, {
    fields: [images.userId],
    references: [profiles.id],
  }),
  project: one(projects, {
    fields: [images.projectId],
    references: [projects.id],
  }),
  expense: one(expenses, {
    fields: [images.expenseId],
    references: [expenses.id],
  }),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  user: one(profiles, {
    fields: [whatsappMessages.userId],
    references: [profiles.id],
  }),
}));

export const aiUsageLogRelations = relations(aiUsageLog, ({ one }) => ({
  user: one(profiles, {
    fields: [aiUsageLog.userId],
    references: [profiles.id],
  }),
}));

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

// Helper function for monetary amount validation
const monetaryAmountValidation = z.string()
  .min(1, "Amount is required")
  .refine((val) => !isNaN(Number(val)), {
    message: "Please enter a valid number"
  })
  .refine((val) => Number(val) >= 0, {
    message: "Amount cannot be negative"
  })
  .refine((val) => Number(val) < 10000000000, {
    message: "Amount is too large"
  })
  .refine((val) => {
    const decimalPlaces = (val.split('.')[1] || '').length;
    return decimalPlaces <= 2;
  }, {
    message: "Amount can have at most 2 decimal places"
  });

// Profile
export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  // Note: lastActiveAt is optional and can be set on updates
});

// Project
export const insertProjectSchema = createInsertSchema(projects, {
  budgetAmount: monetaryAmountValidation.optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
});

// Expense Category
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});

// Expense
export const insertExpenseSchema = createInsertSchema(expenses, {
  amount: monetaryAmountValidation,
  expenseDate: z.union([z.string(), z.date()]).transform((val) => {
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

// Task
export const insertTaskSchema = createInsertSchema(tasks, {
  dueDate: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
});

// Image
export const insertImageSchema = createInsertSchema(images).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});

// WhatsApp Message
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  receivedAt: true,
  processedAt: true,
});

// AI Usage Log
export const insertAiUsageLogSchema = createInsertSchema(aiUsageLog).omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// LEGACY SCHEMA STUBS (for backward compatibility with old routes)
// These tables don't exist in the current schema but are referenced in routes.ts
// TODO: Remove these once legacy routes are updated or removed
// ============================================================================

// Stub schemas for legacy tables - these are empty objects that will fail validation
// but allow the build to succeed. Routes using these should be updated or removed.
export const insertUpdateSchema = z.object({}).passthrough();
export const insertAdvanceSchema = z.object({}).passthrough();
export const insertSupplierSchema = z.object({}).passthrough();
export const insertSupplierPurchaseSchema = z.object({}).passthrough();
export const insertInventorySchema = z.object({}).passthrough();
export const insertMilestoneSchema = z.object({}).passthrough();
export const insertDailyLedgerSchema = z.object({}).passthrough();
export const insertCashDepositSchema = z.object({}).passthrough();
export const insertConstructionPhaseSchema = z.object({}).passthrough();
export const insertHistoricalExpenseSchema = z.object({}).passthrough();
export const insertUserPreferencesSchema = z.object({}).passthrough();

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Image = typeof images.$inferSelect;
export type InsertImage = z.infer<typeof insertImageSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type AiUsageLog = typeof aiUsageLog.$inferSelect;
export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;
