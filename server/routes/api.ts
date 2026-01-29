/**
 * RESTful API Routes
 * 
 * Complete backend API for BuildMonitor dashboard
 * Handles authentication, expenses, tasks, dashboard metrics, and more
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, isNull, sql, desc, gte, lte } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../db';
import { getUserByWhatsApp, getUserDefaultProject } from '../lib/supabase';
import {
  profiles,
  projects,
  expenses,
  tasks,
  images,
  expenseCategories,
  InsertExpense,
  InsertTask,
  InsertImage,
  Expense,
  Task,
} from '@shared/schema';

const router = Router();

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        whatsappNumber: string;
        fullName: string;
        defaultCurrency: string;
      };
    }
  }
}

interface DashboardSummary {
  budget: number;
  totalSpent: number;
  remaining: number;
  percentUsed: number;
  expenseCount: number;
  taskCount: number;
  projectName: string;
  projectId: string;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  whatsappNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid WhatsApp number (e.g., +256770000000)'),
});

const createExpenseSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.number().positive('Amount must be positive').or(z.string().transform(Number)),
  categoryId: z.string().uuid().optional().nullable(),
  expenseDate: z.string().or(z.date()).transform((val) => new Date(val)),
});

const updateExpenseSchema = createExpenseSchema.partial();

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(1000).optional().nullable(),
  dueDate: z.string().or(z.date()).transform((val) => new Date(val)).optional().nullable(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
});

const uploadImageSchema = z.object({
  projectId: z.string().uuid().optional(),
  expenseId: z.string().uuid().optional().nullable(),
  caption: z.string().max(500).optional().nullable(),
});

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Middleware to check if user is authenticated
 * Attaches user profile to req.user if session exists
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if session exists and has userId
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please log in to access this resource',
      });
    }

    // Fetch user profile from database
    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, req.session.userId), isNull(profiles.deletedAt)))
      .limit(1);

    if (!profile) {
      // Session exists but user not found - clear invalid session
      req.session.destroy((err) => {
        if (err) console.error('Error destroying invalid session:', err);
      });
      
      return res.status(401).json({
        success: false,
        error: 'User not found',
        message: 'Your account may have been deleted. Please log in again.',
      });
    }

    // Attach user to request
    req.user = {
      id: profile.id,
      whatsappNumber: profile.whatsappNumber,
      fullName: profile.fullName,
      defaultCurrency: profile.defaultCurrency || 'UGX',
    };

    // Update last active timestamp
    await db
      .update(profiles)
      .set({ lastActiveAt: new Date() })
      .where(eq(profiles.id, profile.id));

    next();
  } catch (error) {
    console.error('[Auth Middleware] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: 'An error occurred while verifying your identity',
    });
  }
}

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

/**
 * POST /api/auth/register
 * Create a new user with Supabase Auth + profile
 */
router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { fullName, username, password, whatsappNumber } = registerSchema.parse(req.body);

    // Use Supabase client for auth
    const { supabase } = await import('../db');
    
    // Check if user already exists by WhatsApp number
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('whatsapp_number', whatsappNumber)
      .is('deleted_at', null)
      .single();

    if (existingProfile) {
      return res.status(400).json({
        success: false,
        error: 'User already exists',
        message: 'A user with this WhatsApp number is already registered.',
      });
    }

    // Create a temporary email for auth (since we don't collect emails yet)
    // Using WhatsApp number as unique identifier
    const tempEmail = `${whatsappNumber.replace(/[^0-9]/g, '')}@buildmonitor.local`;

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: tempEmail,
      password: password,
      email_confirm: true, // Auto-confirm since we're using temp email
    });

    if (authError || !authData.user) {
      console.error('[Register] Auth user creation error:', authError);
      return res.status(500).json({
        success: false,
        error: 'Registration failed',
        message: authError?.message || 'Failed to create authentication account',
      });
    }

    const userId = authData.user.id;

    // 2. Create Profile using the Auth user's ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId, // Use the auth user's ID
        full_name: fullName,
        whatsapp_number: whatsappNumber,
        default_currency: 'UGX',
        preferred_language: 'en',
      })
      .select()
      .single();

    if (profileError) {
      console.error('[Register] Profile creation error:', profileError);
      // Cleanup: delete the auth user if profile creation failed
      await supabase.auth.admin.deleteUser(userId);
      
      return res.status(500).json({
        success: false,
        error: 'Registration failed',
        message: 'Failed to create user profile',
      });
    }

    // 3. Create Default Project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: profile.id,
        name: 'My First Project',
        description: 'Automatically created during signup',
        budget_amount: '1000000',
        status: 'active',
      })
      .select()
      .single();

    if (projectError) {
      console.error('[Register] Project creation error:', projectError);
      // Continue even if project creation fails
    }

    // 4. Create Default Categories
    const defaultCategories = [
      { name: 'Materials', color_hex: '#EF4444' },
      { name: 'Labor', color_hex: '#3B82F6' },
      { name: 'Transport', color_hex: '#10B981' },
      { name: 'Equipment', color_hex: '#F59E0B' },
      { name: 'Permits', color_hex: '#8B5CF6' },
    ];

    const { error: categoriesError } = await supabase
      .from('expense_categories')
      .insert(
        defaultCategories.map(cat => ({
          ...cat,
          user_id: profile.id,
        }))
      );

    if (categoriesError) {
      console.error('[Register] Categories creation error:', categoriesError);
      // Continue even if categories creation fails
    }

    // Create session
    req.session.userId = profile.id;
    req.session.whatsappNumber = profile.whatsapp_number;

    console.log(`[Register] ✅ User registered successfully: ${profile.full_name} (${profile.id})`);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: profile.id,
        whatsappNumber: profile.whatsapp_number,
        fullName: profile.full_name,
        defaultCurrency: profile.default_currency || 'UGX',
        preferredLanguage: profile.preferred_language || 'en',
      },
    });
  } catch (error: any) {
    console.error('[Register] Error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: error.message || 'An error occurred while creating your account',
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    // MVP: Hardcoded credentials
    // TODO: Replace with proper password hashing and database lookup
    const VALID_CREDENTIALS = {
      username: 'owner',
      password: 'owner123',
    };

    if (username !== VALID_CREDENTIALS.username || password !== VALID_CREDENTIALS.password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Incorrect username or password',
      });
    }

    // For MVP, use a hardcoded WhatsApp number to find the user
    // TODO: Link credentials to actual user accounts
    const OWNER_WHATSAPP = process.env.OWNER_WHATSAPP_NUMBER || '+256770000000';
    
    const profile = await getUserByWhatsApp(OWNER_WHATSAPP);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'No profile found for this account. Please register first.',
      });
    }

    // Create session
    req.session.userId = profile.id;
    req.session.whatsappNumber = profile.whatsappNumber;

    // Return user profile
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: profile.id,
        whatsappNumber: profile.whatsappNumber,
        fullName: profile.fullName,
        defaultCurrency: profile.defaultCurrency || 'UGX',
        preferredLanguage: profile.preferredLanguage || 'en',
      },
    });
  } catch (error: any) {
    console.error('[Login] Error:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: 'An error occurred while logging in',
    });
  }
});

/**
 * POST /api/auth/logout
 * Destroy session and log out user
 */
router.post('/auth/logout', (req: Request, res: Response) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('[Logout] Error destroying session:', err);
        return res.status(500).json({
          success: false,
          error: 'Logout failed',
          message: 'Could not destroy session',
        });
      }

      res.clearCookie('connect.sid'); // Clear session cookie
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    });
  } else {
    res.json({
      success: true,
      message: 'Already logged out',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Fetch full profile from database
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, req.user.id))
      .limit(1);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      user: {
        id: profile.id,
        whatsappNumber: profile.whatsappNumber,
        fullName: profile.fullName,
        defaultCurrency: profile.defaultCurrency || 'UGX',
        preferredLanguage: profile.preferredLanguage || 'en',
        createdAt: profile.createdAt,
        lastActiveAt: profile.lastActiveAt,
      },
    });
  } catch (error) {
    console.error('[Auth Me] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
    });
  }
});

// ============================================================================
// DASHBOARD ROUTES
// ============================================================================

/**
 * GET /api/dashboard/summary
 * Get dashboard summary with budget, expenses, tasks
 */
router.get('/dashboard/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user's default project
    const project = await getUserDefaultProject(userId);

    if (!project) {
      return res.json({
        success: true,
        summary: {
          budget: 0,
          totalSpent: 0,
          remaining: 0,
          percentUsed: 0,
          expenseCount: 0,
          taskCount: 0,
          projectName: 'No active project',
          projectId: null,
        } as DashboardSummary,
        message: 'No active project found. Please create a project first.',
      });
    }

    // Calculate total spent
    const totalSpentResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          eq(expenses.projectId, project.id),
          isNull(expenses.deletedAt)
        )
      );

    const totalSpent = parseFloat(totalSpentResult[0].total.toString());

    // Count expenses
    const expenseCountResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          eq(expenses.projectId, project.id),
          isNull(expenses.deletedAt)
        )
      );

    const expenseCount = parseInt(expenseCountResult[0].count.toString());

    // Count pending/in-progress tasks
    const taskCountResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.projectId, project.id),
          sql`${tasks.status} IN ('pending', 'in_progress')`,
          isNull(tasks.deletedAt)
        )
      );

    const taskCount = parseInt(taskCountResult[0].count.toString());

    // Calculate metrics
    const budget = parseFloat(project.budgetAmount);
    const remaining = budget - totalSpent;
    const percentUsed = budget > 0 ? (totalSpent / budget) * 100 : 0;

    const summary: DashboardSummary = {
      budget,
      totalSpent,
      remaining,
      percentUsed: Math.round(percentUsed * 10) / 10, // Round to 1 decimal
      expenseCount,
      taskCount,
      projectName: project.name,
      projectId: project.id,
    };

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('[Dashboard Summary] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard summary',
    });
  }
});

// ============================================================================
// EXPENSE ROUTES
// ============================================================================

/**
 * GET /api/expenses
 * Get expenses with optional filtering
 */
router.get('/expenses', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Parse query params
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const categoryId = req.query.category_id as string | undefined;
    const fromDate = req.query.from_date as string | undefined;
    const toDate = req.query.to_date as string | undefined;

    // Build where conditions
    const conditions = [
      eq(expenses.userId, userId),
      isNull(expenses.deletedAt),
    ];

    if (categoryId) {
      conditions.push(eq(expenses.categoryId, categoryId));
    }

    if (fromDate) {
      conditions.push(gte(expenses.expenseDate, new Date(fromDate)));
    }

    if (toDate) {
      conditions.push(lte(expenses.expenseDate, new Date(toDate)));
    }

    // Fetch expenses with category names
    const expenseList = await db
      .select({
        id: expenses.id,
        userId: expenses.userId,
        projectId: expenses.projectId,
        categoryId: expenses.categoryId,
        description: expenses.description,
        amount: expenses.amount,
        currency: expenses.currency,
        source: expenses.source,
        expenseDate: expenses.expenseDate,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
        categoryName: expenseCategories.name,
        categoryColor: expenseCategories.colorHex,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(expenses)
      .where(and(...conditions));

    const totalCount = parseInt(countResult[0].count.toString());

    res.json({
      success: true,
      expenses: expenseList,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('[Get Expenses] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expenses',
    });
  }
});

/**
 * POST /api/expenses
 * Create a new expense
 */
router.post('/expenses', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = createExpenseSchema.parse(req.body);

    // Get user's default project
    const project = await getUserDefaultProject(userId);

    if (!project) {
      return res.status(400).json({
        success: false,
        error: 'No active project',
        message: 'Please create a project before adding expenses',
      });
    }

    // Create expense
    const newExpense: InsertExpense = {
      userId,
      projectId: project.id,
      categoryId: data.categoryId || null,
      description: data.description,
      amount: data.amount.toString(),
      currency: req.user!.defaultCurrency,
      source: 'dashboard',
      expenseDate: data.expenseDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [expense] = await db.insert(expenses).values(newExpense).returning();

    // Fetch with category info
    const [expenseWithCategory] = await db
      .select({
        id: expenses.id,
        userId: expenses.userId,
        projectId: expenses.projectId,
        categoryId: expenses.categoryId,
        description: expenses.description,
        amount: expenses.amount,
        currency: expenses.currency,
        source: expenses.source,
        expenseDate: expenses.expenseDate,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
        categoryName: expenseCategories.name,
        categoryColor: expenseCategories.colorHex,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(eq(expenses.id, expense.id));

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      expense: expenseWithCategory,
    });
  } catch (error: any) {
    console.error('[Create Expense] Error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create expense',
    });
  }
});

/**
 * PUT /api/expenses/:id
 * Update an expense
 */
router.put('/expenses/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const expenseId = req.params.id;
    const updates = updateExpenseSchema.parse(req.body);

    // Verify ownership
    const [existingExpense] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId), isNull(expenses.deletedAt)))
      .limit(1);

    if (!existingExpense) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
        message: 'Expense does not exist or you do not have permission to edit it',
      });
    }

    // Update expense
    const [updatedExpense] = await db
      .update(expenses)
      .set({
        ...updates,
        amount: updates.amount?.toString(),
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId))
      .returning();

    // Fetch with category info
    const [expenseWithCategory] = await db
      .select({
        id: expenses.id,
        userId: expenses.userId,
        projectId: expenses.projectId,
        categoryId: expenses.categoryId,
        description: expenses.description,
        amount: expenses.amount,
        currency: expenses.currency,
        source: expenses.source,
        expenseDate: expenses.expenseDate,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
        categoryName: expenseCategories.name,
        categoryColor: expenseCategories.colorHex,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(eq(expenses.id, expenseId));

    res.json({
      success: true,
      message: 'Expense updated successfully',
      expense: expenseWithCategory,
    });
  } catch (error: any) {
    console.error('[Update Expense] Error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update expense',
    });
  }
});

/**
 * DELETE /api/expenses/:id
 * Soft delete an expense
 */
router.delete('/expenses/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const expenseId = req.params.id;

    // Verify ownership
    const [existingExpense] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId), isNull(expenses.deletedAt)))
      .limit(1);

    if (!existingExpense) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
        message: 'Expense does not exist or you do not have permission to delete it',
      });
    }

    // Soft delete
    await db
      .update(expenses)
      .set({ deletedAt: new Date() })
      .where(eq(expenses.id, expenseId));

    res.json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    console.error('[Delete Expense] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete expense',
    });
  }
});

// ============================================================================
// TASK ROUTES
// ============================================================================

/**
 * GET /api/tasks
 * Get tasks with optional filtering
 */
router.get('/tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;

    // Build where conditions
    const conditions = [
      eq(tasks.userId, userId),
      isNull(tasks.deletedAt),
    ];

    if (status) {
      conditions.push(eq(tasks.status, status));
    }

    // Fetch tasks
    const taskList = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(tasks)
      .where(and(...conditions));

    const totalCount = parseInt(countResult[0].count.toString());

    res.json({
      success: true,
      tasks: taskList,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('[Get Tasks] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tasks',
    });
  }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = createTaskSchema.parse(req.body);

    // Get user's default project
    const project = await getUserDefaultProject(userId);

    if (!project) {
      return res.status(400).json({
        success: false,
        error: 'No active project',
        message: 'Please create a project before adding tasks',
      });
    }

    // Create task
    const newTask: InsertTask = {
      userId,
      projectId: project.id,
      title: data.title,
      description: data.description || null,
      status: 'pending',
      priority: data.priority,
      dueDate: data.dueDate || null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [task] = await db.insert(tasks).values(newTask).returning();

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task,
    });
  } catch (error: any) {
    console.error('[Create Task] Error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create task',
    });
  }
});

/**
 * PUT /api/tasks/:id
 * Update a task
 */
router.put('/tasks/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.id;
    const updates = updateTaskSchema.parse(req.body);

    // Verify ownership
    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
      .limit(1);

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
        message: 'Task does not exist or you do not have permission to edit it',
      });
    }

    // If marking as completed, set completedAt
    const updateData: any = {
      ...updates,
      updatedAt: new Date(),
    };

    if (updates.status === 'completed' && !existingTask.completedAt) {
      updateData.completedAt = new Date();
    } else if (updates.status && updates.status !== 'completed') {
      updateData.completedAt = null;
    }

    // Update task
    const [updatedTask] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning();

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: updatedTask,
    });
  } catch (error: any) {
    console.error('[Update Task] Error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update task',
    });
  }
});

/**
 * DELETE /api/tasks/:id
 * Soft delete a task
 */
router.delete('/tasks/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.id;

    // Verify ownership
    const [existingTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
      .limit(1);

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
        message: 'Task does not exist or you do not have permission to delete it',
      });
    }

    // Soft delete
    await db
      .update(tasks)
      .set({ deletedAt: new Date() })
      .where(eq(tasks.id, taskId));

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('[Delete Task] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete task',
    });
  }
});

// ============================================================================
// CATEGORY ROUTES
// ============================================================================

/**
 * GET /api/categories
 * Get user's expense categories
 */
router.get('/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Fetch categories
    const categories = await db
      .select()
      .from(expenseCategories)
      .where(and(eq(expenseCategories.userId, userId), isNull(expenseCategories.deletedAt)))
      .orderBy(expenseCategories.name);

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error('[Get Categories] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    });
  }
});

// ============================================================================
// IMAGE ROUTES
// ============================================================================

/**
 * GET /api/images
 * Get user's images
 */
router.get('/images', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const expenseId = req.query.expense_id as string | undefined;

    // Build where conditions
    const conditions = [
      eq(images.userId, userId),
      isNull(images.deletedAt),
    ];

    if (expenseId) {
      conditions.push(eq(images.expenseId, expenseId));
    }

    // Fetch images
    const imageList = await db
      .select()
      .from(images)
      .where(and(...conditions))
      .orderBy(desc(images.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(images)
      .where(and(...conditions));

    const totalCount = parseInt(countResult[0].count.toString());

    res.json({
      success: true,
      images: imageList,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('[Get Images] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch images',
    });
  }
});

/**
 * POST /api/images
 * Upload an image
 * TODO: Implement file upload to Supabase Storage
 */
router.post('/images', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // TODO: Implement multipart/form-data handling with multer or similar
    // For now, accept image URL from client
    const { imageUrl, projectId, expenseId, caption } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Image URL is required',
      });
    }

    // Get user's default project if not provided
    let finalProjectId = projectId;
    if (!finalProjectId) {
      const project = await getUserDefaultProject(userId);
      if (project) {
        finalProjectId = project.id;
      }
    }

    // Extract filename from URL
    const fileName = imageUrl.split('/').pop() || 'image.jpg';

    // Create image record
    const newImage: InsertImage = {
      userId,
      projectId: finalProjectId || null,
      expenseId: expenseId || null,
      storagePath: imageUrl,
      fileName: fileName,
      fileSizeBytes: null,
      mimeType: 'image/jpeg', // TODO: Detect from actual file
      caption: caption || null,
      source: 'dashboard',
      createdAt: new Date(),
    };

    const [image] = await db.insert(images).values(newImage).returning();

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      image,
    });
  } catch (error) {
    console.error('[Upload Image] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload image',
    });
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

export default router;

