/**
 * RESTful API Routes
 * 
 * Complete backend API for JengaTrack dashboard
 * Handles authentication, expenses, tasks, dashboard metrics, and more
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, isNull, sql, desc, gte, lte } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../db.js';
import { getUserByWhatsApp, getUserDefaultProject } from '../lib/supabase.js';
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
} from '../../shared/schema.js';

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
  overallProgress: number;
  onTimeStatus: { isDelayed: boolean; daysDelayed: number; };
  activeIssues: { total: number; critical: number; };
}

interface Phase {
  id: string;
  name: string;
  percentComplete: number;
  status: 'pending' | 'in-progress' | 'completed' | 'delayed';
  daysDelayed?: number;
  delayReason?: string;
}

interface Milestone {
  id: string;
  title: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
}

interface CategoryBudget {
  category: string;
  amount: number;
  percentage: number;
  colorHex: string;
}

interface CategoryComparison {
  category: string;
  budgeted: number;
  actual: number;
  variance: number; // Percentage variance
  colorHex: string;
}

interface DailyCost {
  date: string; // YYYY-MM-DD
  amount: number;
}

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  totalStock: number;
  stockPercent: number;
  consumptionVsEstimate: number; // Percentage
}

interface MaterialUsage {
  material: string;
  used: number;
  remaining: number;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'inProgress' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reportedBy: string; // Placeholder for now
  reportedDate: Date;
}

interface IssueTypeCount {
  type: string;
  count: number;
  percentage: number;
}

interface Photo {
  id: string;
  thumbnailUrl: string;
  fullUrl: string;
  caption: string;
  date: Date;
}

interface MediaStats {
  dailyLogsThisWeek: number;
  photosUploaded: number;
  siteCondition: 'Good' | 'Fair' | 'Poor';
}

interface DataPoint {
  name: string; // e.g., "Day 1", "Jan 01"
  value: number;
}

interface Insight {
  type: 'alert' | 'info' | 'success';
  message: string;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
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
  console.log('[AUTH SIGNUP] ========================================');
  console.log('[AUTH SIGNUP] Request received');
  
  try {
    const { fullName, email, password, whatsappNumber } = registerSchema.parse(req.body);

    console.log('[AUTH SIGNUP] Attempting signup for:', email);

    // Validation
    if (!email || !password || !fullName) {
      console.log('[AUTH SIGNUP] ❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Email, password, and full name are required',
      });
    }

    // Check database connection
    try {
      console.log('[AUTH SIGNUP] Testing database connection...');
      await db.select().from(profiles).limit(1);
      console.log('[AUTH SIGNUP] ✅ Database connection OK');
    } catch (dbError: any) {
      console.error('[AUTH SIGNUP] ❌ Database connection failed:', {
        error: dbError,
        message: dbError?.message,
        stack: dbError?.stack,
      });
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        details: dbError.message,
      });
    }

    // Use Supabase client for auth (needs service role key for admin operations)
    const { supabase } = await import('../db.js');
    
    // Check if user already exists by email or WhatsApp number using Drizzle
    console.log('[AUTH SIGNUP] Checking for existing users...');
    const existingByEmail = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.email, email), isNull(profiles.deletedAt)))
      .limit(1);

    const existingByWhatsApp = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.whatsappNumber, whatsappNumber), isNull(profiles.deletedAt)))
      .limit(1);

    if (existingByEmail.length > 0) {
      console.error('[AUTH SIGNUP] ❌ User already exists with email:', email);
      return res.status(400).json({
        success: false,
        error: 'User already exists',
        message: 'An account with this email address already exists.',
      });
    }

    if (existingByWhatsApp.length > 0) {
      console.error('[AUTH SIGNUP] ❌ User already exists with WhatsApp:', whatsappNumber);
      return res.status(400).json({
        success: false,
        error: 'User already exists',
        message: 'A user with this WhatsApp number is already registered.',
      });
    }

    // 1. Create Supabase Auth user
    console.log('[AUTH SIGNUP] Creating Supabase auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error('[AUTH SIGNUP] ❌ Auth user creation error:', {
        error: authError,
        message: authError?.message,
        status: authError?.status,
      });
      return res.status(500).json({
        success: false,
        error: 'Registration failed',
        message: authError?.message || 'Failed to create authentication account. Please try again.',
      });
    }

    const userId = authData.user.id;
    console.log('[AUTH SIGNUP] ✅ Supabase user created:', userId);

    // 2. Create Profile using Drizzle ORM (consistent with login endpoint)
    console.log('[AUTH SIGNUP] Creating user profile...');
    const now = new Date();
    try {
      const [profile] = await db.insert(profiles).values({
        id: userId,
        email: email,
        fullName: fullName,
        whatsappNumber: whatsappNumber,
        defaultCurrency: 'UGX',
        preferredLanguage: 'en',
        createdAt: now,
        updatedAt: now,
      }).returning();

      if (!profile) {
        throw new Error('Profile creation returned no data');
      }

      console.log('[AUTH SIGNUP] ✅ Profile created:', profile.id);

    // NOTE: We don't manually create default project or categories here 
    // because project.sql has a database trigger (create_user_defaults) 
    // that automatically handles this when a new profile is inserted.

      // Create session - ensure it's saved
    req.session.userId = profile.id;
      req.session.whatsappNumber = profile.whatsappNumber;

      // Save session explicitly
      await new Promise<void>((resolve, reject) => {
        req.session!.save((err) => {
          if (err) {
            console.error('[AUTH SIGNUP] ❌ Session save error:', {
              error: err,
              message: err?.message,
              stack: err?.stack,
            });
            reject(err);
          } else {
            console.log('[AUTH SIGNUP] ✅ Session saved');
            resolve();
          }
        });
      });

      console.log('[AUTH SIGNUP] ✅ Signup successful');
      console.log('[AUTH SIGNUP] ========================================');

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: profile.id,
        email: profile.email,
          whatsappNumber: profile.whatsappNumber,
          fullName: profile.fullName,
          defaultCurrency: profile.defaultCurrency || 'UGX',
          preferredLanguage: profile.preferredLanguage || 'en',
      },
    });
    } catch (profileError: any) {
      console.error('[AUTH SIGNUP] ❌ Profile creation error:', {
        error: profileError,
        message: profileError?.message,
        code: profileError?.code,
        stack: profileError?.stack,
      });
      
      // Cleanup: delete the auth user if profile creation failed
      try {
        await supabase.auth.admin.deleteUser(userId);
        console.log('[AUTH SIGNUP] Cleaned up auth user after profile creation failure');
      } catch (cleanupError) {
        console.error('[AUTH SIGNUP] Error cleaning up auth user:', cleanupError);
      }
      
      return res.status(500).json({
        success: false,
        error: 'Registration failed',
        message: profileError?.message || 'Failed to create user profile. Please try again.',
        details: process.env.NODE_ENV === 'development' ? profileError.message : undefined,
      });
    }
  } catch (error: any) {
    console.error('[AUTH SIGNUP] ❌ Unexpected error:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    console.error('[AUTH SIGNUP] ========================================');
    
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
      message: error.message || 'An error occurred while creating your account. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/auth/login', async (req: Request, res: Response) => {
  console.log('[AUTH LOGIN] ========================================');
  console.log('[AUTH LOGIN] Request received:', {
    body: { email: req.body?.email, password: '[REDACTED]' },
    hasSession: !!req.session,
    sessionID: req.sessionID,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
    },
  });

  try {
    const { email, password } = loginSchema.parse(req.body);

    console.log('[AUTH LOGIN] Attempting login for:', email);

    if (!email || !password) {
      console.log('[AUTH LOGIN] Missing credentials');
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Check database connection first
    try {
      console.log('[AUTH LOGIN] Testing database connection...');
      await db.select().from(profiles).limit(1);
      console.log('[AUTH LOGIN] ✅ Database connection OK');
    } catch (dbError: any) {
      console.error('[AUTH LOGIN] ❌ Database connection failed:', {
        error: dbError,
        message: dbError?.message,
        stack: dbError?.stack,
      });
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        details: dbError.message,
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('[AUTH LOGIN] Environment check:', {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasAnonKey: !!SUPABASE_ANON_KEY,
      hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
      hasSessionSecret: !!process.env.SESSION_SECRET,
    });

    if (!SUPABASE_URL) {
      console.error('[Login] Missing SUPABASE_URL');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'SUPABASE_URL is not configured. Please contact support.',
      });
    }

    // For server-side authentication, we need the anon key
    // Service role key is for admin operations, not user authentication
    if (!SUPABASE_ANON_KEY) {
      console.error('[Login] Missing SUPABASE_ANON_KEY - required for user authentication');
      console.error('[Login] Available env vars:', {
        hasUrl: !!SUPABASE_URL,
        hasAnonKey: !!SUPABASE_ANON_KEY,
        hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'SUPABASE_ANON_KEY is required for authentication but is not configured. Please set it in your environment variables.',
      });
    }

    // Create auth client with anon key for user authentication
    console.log('[AUTH LOGIN] Creating Supabase auth client...');
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Sign in with Supabase Auth
    console.log('[AUTH LOGIN] Attempting Supabase sign in...');
    let authData, authError;
    try {
      const result = await authClient.auth.signInWithPassword({
      email,
      password,
    });
      authData = result.data;
      authError = result.error;
      console.log('[AUTH LOGIN] Supabase sign in result:', {
        hasData: !!authData,
        hasUser: !!authData?.user,
        hasError: !!authError,
        errorMessage: authError?.message,
      });
    } catch (err: any) {
      console.error('[AUTH LOGIN] ❌ SignInWithPassword exception:', {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
      });
      authError = err;
      authData = null;
    }

    if (authError || !authData?.user) {
      console.error('[AUTH LOGIN] ❌ Auth error:', {
        message: authError?.message,
        status: authError?.status,
        name: authError?.name,
        hasData: !!authData,
        hasUser: !!authData?.user,
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: authError?.message || 'Incorrect email or password',
      });
    }

    const userId = authData.user.id;
    console.log('[AUTH LOGIN] ✅ User authenticated:', userId);

    // Get user profile
    console.log('[AUTH LOGIN] Fetching user profile...');
    let profile;
    try {
      const profileResult = await db
      .select()
      .from(profiles)
        .where(and(eq(profiles.id, userId), isNull(profiles.deletedAt)))
      .limit(1);

      profile = profileResult[0];
      console.log('[AUTH LOGIN] Profile query result:', {
        found: !!profile,
        profileId: profile?.id,
        profileName: profile?.fullName,
      });
    } catch (dbError: any) {
      console.error('[AUTH LOGIN] ❌ Database error fetching profile:', {
        error: dbError,
        message: dbError?.message,
        stack: dbError?.stack,
        userId,
      });
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to fetch user profile. Please try again.',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined,
      });
    }

    if (!profile) {
      console.error('[AUTH LOGIN] ❌ Profile not found for user:', userId);
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'No profile found for this account. Please contact support.',
      });
    }

    console.log('[AUTH LOGIN] ✅ Profile found:', profile.fullName, `(${profile.id})`);

    // Update last active
    try {
      await db
        .update(profiles)
        .set({ lastActiveAt: new Date() })
        .where(eq(profiles.id, profile.id));
      console.log('[AUTH LOGIN] Last active timestamp updated');
    } catch (updateError) {
      console.error('[AUTH LOGIN] Warning: Failed to update lastActiveAt:', updateError);
      // Don't fail the request if this update fails
    }

    // Set session
    if (!req.session) {
      console.error('[AUTH LOGIN] ❌ No session object available!');
      return res.status(500).json({
        success: false,
        error: 'Session initialization failed',
        message: 'Session middleware not properly configured.',
      });
    }

    console.log('[AUTH LOGIN] Setting session data...');
    req.session.userId = profile.id;
    req.session.whatsappNumber = profile.whatsappNumber;

    // Save session explicitly
    await new Promise<void>((resolve, reject) => {
      req.session!.save((err) => {
        if (err) {
          console.error('[AUTH LOGIN] ❌ Session save error:', {
            error: err,
            message: err?.message,
            stack: err?.stack,
          });
          reject(err);
        } else {
          console.log('[AUTH LOGIN] ✅ Session saved successfully');
          resolve();
        }
      });
    });

    console.log('[AUTH LOGIN] ✅ Login successful for:', authData.user.email);
    console.log('[AUTH LOGIN] ========================================');

    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: profile.id,
        email: profile.email,
        whatsappNumber: profile.whatsappNumber,
        fullName: profile.fullName,
        defaultCurrency: profile.defaultCurrency || 'UGX',
        preferredLanguage: profile.preferredLanguage || 'en',
      },
    });
  } catch (error: any) {
    console.error('[AUTH LOGIN] ❌ Unexpected error:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    console.error('[AUTH LOGIN] ========================================');
    
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
      message: error.message || 'An error occurred while logging in. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
router.post('/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const { supabase } = await import('../db.js');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password`,
    });

    if (error) {
      console.error('[Forgot Password] Error:', error);
      return res.status(400).json({
        success: false,
        error: 'Reset failed',
        message: error.message,
      });
    }

    res.json({
      success: true,
      message: 'Password reset link has been sent to your email.',
    });
  } catch (error: any) {
    console.error('[Forgot Password] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send reset link',
      message: 'An error occurred while processing your request.',
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Set new password after clicking reset link
 */
router.post('/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { password } = z.object({ password: z.string().min(6) }).parse(req.body);
    const { supabase } = await import('../db.js');

    // This requires the user to be authenticated via the token in the URL
    // The client should have handled the exchange of code for session
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error('[Reset Password] Error:', error);
      return res.status(400).json({
        success: false,
        error: 'Reset failed',
        message: error.message,
      });
    }

    res.json({
      success: true,
      message: 'Your password has been reset successfully.',
    });
  } catch (error: any) {
    console.error('[Reset Password] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
      message: 'An error occurred while resetting your password.',
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
 * GET /api/auth/check
 * Check authentication status and session
 */
router.get('/auth/check', async (req: Request, res: Response) => {
  try {
    const hasSession = !!req.session;
    const hasUserId = !!req.session?.userId;
    const sessionId = req.sessionID;
    
    return res.json({
      success: true,
      authenticated: hasUserId,
      hasSession,
      sessionId,
      userId: req.session?.userId || null,
      message: hasUserId ? 'User is authenticated' : 'User is not authenticated',
    });
  } catch (error: any) {
    console.error('[Auth Check] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Check failed',
      message: error.message || 'An error occurred',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 * NOTE: Don't use requireAuth middleware here to avoid circular errors
 */
router.get('/auth/me', async (req: Request, res: Response) => {
  console.log('[AUTH ME] ========================================');
  console.log('[AUTH ME] Request received');
  console.log('[AUTH ME] Session:', {
    sessionID: req.sessionID,
    hasSession: !!req.session,
    userId: req.session?.userId,
    whatsappNumber: req.session?.whatsappNumber,
  });

  try {
    // Check session directly (don't use req.user from requireAuth)
    if (!req.session || !req.session.userId) {
      console.log('[AUTH ME] ❌ No session userId found');
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        message: 'Please log in to access this resource',
      });
    }

    const userId = req.session.userId;
    console.log('[AUTH ME] Fetching profile for userId:', userId);

    // Check database connection
    try {
      console.log('[AUTH ME] Testing database connection...');
      await db.select().from(profiles).limit(1);
      console.log('[AUTH ME] ✅ Database connection OK');
    } catch (dbError: any) {
      console.error('[AUTH ME] ❌ Database connection failed:', {
        error: dbError,
        message: dbError?.message,
        stack: dbError?.stack,
      });
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        details: dbError.message,
      });
    }

    // Fetch full profile from database
    let profile;
    try {
      const profileResult = await db
      .select()
      .from(profiles)
        .where(and(eq(profiles.id, userId), isNull(profiles.deletedAt)))
      .limit(1);
      
      profile = profileResult[0];
      console.log('[AUTH ME] Profile query result:', {
        found: !!profile,
        profileId: profile?.id,
        profileName: profile?.fullName,
      });
    } catch (dbError: any) {
      console.error('[AUTH ME] ❌ Database error:', {
        error: dbError,
        message: dbError?.message,
        stack: dbError?.stack,
        userId,
      });
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to fetch user profile. Please try again.',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined,
      });
    }

    if (!profile) {
      console.error('[AUTH ME] ❌ Profile not found for userId:', userId);
      // Session exists but user not found - clear invalid session
      req.session.destroy((err) => {
        if (err) console.error('[AUTH ME] Error destroying invalid session:', err);
      });
      
      return res.status(401).json({
        success: false,
        error: 'User not found',
        message: 'Your account may have been deleted. Please log in again.',
      });
    }

    console.log('[AUTH ME] ✅ Profile found:', profile.fullName, `(${profile.id})`);

    // Update last active timestamp (non-blocking)
    db.update(profiles)
      .set({ lastActiveAt: new Date() })
      .where(eq(profiles.id, profile.id))
      .catch((err) => {
        console.error('[AUTH ME] Warning: Error updating lastActiveAt:', err);
      });

    console.log('[AUTH ME] ========================================');

    res.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        whatsappNumber: profile.whatsappNumber,
        fullName: profile.fullName,
        defaultCurrency: profile.defaultCurrency || 'UGX',
        preferredLanguage: profile.preferredLanguage || 'en',
      },
    });
  } catch (error: any) {
    console.error('[AUTH ME] ❌ Unexpected error:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    console.error('[AUTH ME] ========================================');
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      message: error.message || 'An error occurred while fetching your profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// ============================================================================
// PROJECT ROUTES
// ============================================================================

/**
 * GET /api/projects
 * Get user's projects
 */
router.get('/projects', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Fetch projects
    const projectList = await db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), isNull(projects.deletedAt)))
      .orderBy(desc(projects.updatedAt));

    res.json({
      success: true,
      projects: projectList,
    });
  } catch (error) {
    console.error('[Get Projects] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects',
    });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/projects', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description, budgetAmount, status } = req.body;

    console.log('[Create Project] Request body:', { name, description, budgetAmount, status });
    console.log('[Create Project] User ID:', userId);

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Project name is required',
        message: 'Please provide a project name',
      });
    }

    // Normalize status - ensure it's lowercase and valid
    const validStatuses = ['active', 'completed', 'paused'];
    let normalizedStatus = 'active';
    if (status && typeof status === 'string') {
      const lowerStatus = status.toLowerCase().trim();
      if (validStatuses.includes(lowerStatus)) {
        normalizedStatus = lowerStatus;
      }
    }

    // Parse budget amount - handle string or number
    let parsedBudgetAmount = '0';
    if (budgetAmount !== undefined && budgetAmount !== null && budgetAmount !== '') {
      const budgetNum = typeof budgetAmount === 'string' ? parseFloat(budgetAmount) : Number(budgetAmount);
      if (!isNaN(budgetNum) && budgetNum >= 0) {
        // Format as decimal string with 2 decimal places
        parsedBudgetAmount = budgetNum.toFixed(2);
      } else if (budgetNum < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid budget amount',
          message: 'Budget amount cannot be negative',
        });
      }
    }

    // Insert project
    const [project] = await db.insert(projects).values({
      userId,
      name: name.trim(),
      description: description?.trim() || null,
      budgetAmount: parsedBudgetAmount,
      status: normalizedStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log('[Create Project] ✅ Success - Project created:', {
      id: project.id,
      name: project.name,
      userId: project.userId,
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project,
    });
  } catch (error: any) {
    console.error('[Create Project] ❌ Error:', error);
    console.error('[Create Project] Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack,
    });
    
    // Provide more detailed error message based on error type
    let errorMessage = 'Failed to create project';
    let statusCode = 500;

    if (error.code === '23505') {
      // Unique constraint violation
      errorMessage = 'A project with this name already exists';
      statusCode = 409;
    } else if (error.code === '23503') {
      // Foreign key constraint violation
      errorMessage = 'Invalid user account. Please log in again.';
      statusCode = 400;
    } else if (error.code === '23502') {
      // Not null constraint violation
      errorMessage = 'Missing required fields';
      statusCode = 400;
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      message: errorMessage,
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

    // Calculate total and completed tasks for overall progress
    const totalTasksResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(and(eq(tasks.projectId, project.id), isNull(tasks.deletedAt)));
    const totalTasks = parseInt(totalTasksResult[0].count.toString());

    const completedTasksResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(and(eq(tasks.projectId, project.id), eq(tasks.status, 'completed'), isNull(tasks.deletedAt)));
    const completedTasks = parseInt(completedTasksResult[0].count.toString());

    const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Calculate on-time status
    const now = new Date();
    const delayedTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, project.id),
          sql`${tasks.dueDate} < ${now}::date`,
          sql`${tasks.status} IN ('pending', 'in_progress')`,
          isNull(tasks.deletedAt)
        )
      );
    
    let daysDelayed = 0;
    let isDelayed = delayedTasks.length > 0;
    if (isDelayed) {
      const mostDelayedTask = delayedTasks.reduce((prev, current) => (
        (prev.dueDate && current.dueDate && prev.dueDate < current.dueDate) ? prev : current
      ));
      if (mostDelayedTask.dueDate) {
        daysDelayed = Math.floor((now.getTime() - mostDelayedTask.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    // Calculate active issues (open and critical tasks)
    const openIssuesResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, project.id),
          sql`${tasks.status} IN ('pending', 'in_progress')`,
          isNull(tasks.deletedAt)
        )
      );
    const totalOpenIssues = parseInt(openIssuesResult[0].count.toString());

    const criticalIssuesResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, project.id),
          sql`${tasks.status} IN ('pending', 'in_progress')`,
          eq(tasks.priority, 'high'), // Assuming 'high' priority tasks are critical issues
          isNull(tasks.deletedAt)
        )
      );
    const criticalIssues = parseInt(criticalIssuesResult[0].count.toString());

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
      overallProgress,
      onTimeStatus: { isDelayed, daysDelayed },
      activeIssues: { total: totalOpenIssues, critical: criticalIssues },
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

/**
 * GET /api/dashboard/progress
 * Get progress and schedule data for the dashboard
 */
router.get('/dashboard/progress', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const project = await getUserDefaultProject(userId);

    if (!project) {
      return res.json({
        success: true,
        phases: [],
        upcomingMilestones: [],
        message: 'No active project found.',
      });
    }

    const now = new Date(); // Define now here

    // Fetch all tasks for the project
    const allTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, project.id), isNull(tasks.deletedAt)));

    // Define hypothetical phases and calculate progress (simplified)
    const phases: Phase[] = [
      {
        id: 'phase-foundation',
        name: 'Foundation',
        percentComplete: 0, // Will be calculated
        status: 'pending',
      },
      {
        id: 'phase-framing',
        name: 'Framing',
        percentComplete: 0, // Will be calculated
        status: 'pending',
      },
      {
        id: 'phase-roofing',
        name: 'Roofing',
        percentComplete: 0, // Will be calculated
        status: 'pending',
      },
      {
        id: 'phase-finishing',
        name: 'Finishing',
        percentComplete: 0, // Will be calculated
        status: 'pending',
      },
    ];

    // Calculate actual progress for each phase (example based on tasks)
    const calculatePhaseProgress = (phaseName: string): number => {
      const phaseTasks = allTasks.filter(task => task.title.toLowerCase().includes(phaseName.toLowerCase()));
      if (phaseTasks.length === 0) return 0;
      const completedPhaseTasks = phaseTasks.filter(task => task.status === 'completed').length;
      return Math.round((completedPhaseTasks / phaseTasks.length) * 100);
    };

    // Update phase progress dynamically based on tasks (basic example)
    phases[0].percentComplete = calculatePhaseProgress('foundation');
    phases[1].percentComplete = calculatePhaseProgress('framing');
    phases[2].percentComplete = calculatePhaseProgress('roofing');
    phases[3].percentComplete = calculatePhaseProgress('finishing');
    
    // Adjust phase status based on progress (simplified logic)
    phases.forEach(phase => {
      const phaseTasks = allTasks.filter(task => task.title.toLowerCase().includes(phase.name.toLowerCase()));
      const delayedPhaseTasks = phaseTasks.filter(task => task.dueDate && task.dueDate < now && task.status !== 'completed');

      if (phase.percentComplete === 100) {
        phase.status = 'completed';
      } else if (delayedPhaseTasks.length > 0) {
        phase.status = 'delayed';
        const mostDelayedTask = delayedPhaseTasks.reduce((prev, current) => (
          (prev.dueDate && current.dueDate && prev.dueDate < current.dueDate) ? prev : current
        ));
        if (mostDelayedTask.dueDate) {
          phase.daysDelayed = Math.floor((now.getTime() - mostDelayedTask.dueDate.getTime()) / (1000 * 60 * 60 * 24));
          phase.delayReason = `Task '${mostDelayedTask.title}' is overdue`;
        }
      } else if (phase.percentComplete > 0) {
        phase.status = 'in-progress';
      } else {
        phase.status = 'pending';
      }
    });

    // Fetch upcoming milestones (tasks due in next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const upcomingMilestones: Milestone[] = allTasks
      .filter(task => task.dueDate && task.dueDate > now && task.dueDate <= sevenDaysFromNow && task.status !== 'completed')
      .map(task => ({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate!,
        priority: task.priority || 'medium',
      }));

    res.json({
      success: true,
      phases,
      upcomingMilestones,
    });
  } catch (error) {
    console.error('[Dashboard Progress] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch progress data',
    });
  }
});

/**
 * GET /api/dashboard/budget
 * Get budget and cost data for the dashboard
 */
router.get('/dashboard/budget', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const project = await getUserDefaultProject(userId);

    if (!project) {
      return res.json({
        success: true,
        breakdown: [],
        vsActual: [],
        cumulativeCosts: [],
        totalBudget: 0,
        spent: 0,
        remaining: 0,
        spentPercent: 0,
        message: 'No active project found.',
      });
    }

    const projectId = project.id;
    const totalProjectBudget = parseFloat(project.budgetAmount);

    // 1. Budget Breakdown by Category
    const categoryExpenses = await db
      .select({
        categoryId: expenses.categoryId,
        categoryName: expenseCategories.name,
        categoryColor: expenseCategories.colorHex,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(eq(expenses.projectId, projectId), isNull(expenses.deletedAt)))
      .groupBy(expenses.categoryId, expenseCategories.name, expenseCategories.colorHex);

    const totalSpent = categoryExpenses.reduce((sum, item) => sum + item.totalAmount, 0);

    const breakdown: CategoryBudget[] = categoryExpenses.map(item => ({
      category: item.categoryName || 'Uncategorized',
      amount: item.totalAmount,
      percentage: totalSpent > 0 ? Math.round((item.totalAmount / totalSpent) * 100) : 0,
      colorHex: item.categoryColor || '#CCCCCC',
    }));

    // 2. Budget vs Actual Spend (simplified - assuming categories map to budgeted items)
    const vsActual: CategoryComparison[] = breakdown.map(item => {
      // For now, assume budgeted is proportional to total project budget
      // In a real app, you'd fetch budgeted amounts per category from a budget table
      const budgetedAmount = totalProjectBudget > 0 ? (item.percentage / 100) * totalProjectBudget : 0; // Simplified
      const actualAmount = item.amount;
      const variance = budgetedAmount > 0 ? Math.round(((actualAmount - budgetedAmount) / budgetedAmount) * 100) : 0;
      return {
        category: item.category,
        budgeted: budgetedAmount,
        actual: actualAmount,
        variance,
        colorHex: item.colorHex,
      };
    });

    // 3. Cumulative Costs Over Time
    const dailyExpenses = await db
      .select({
        date: sql<string>`DATE(${expenses.expenseDate})`,
        amount: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      })
      .from(expenses)
      .where(and(eq(expenses.projectId, projectId), isNull(expenses.deletedAt)))
      .groupBy(sql`DATE(${expenses.expenseDate})`)
      .orderBy(sql`DATE(${expenses.expenseDate})`);

    let cumulativeSum = 0;
    const cumulativeCosts: DailyCost[] = dailyExpenses.map(day => {
      cumulativeSum += day.amount;
      return {
        date: day.date,
        amount: cumulativeSum,
      };
    });

    const spentPercent = totalProjectBudget > 0 ? Math.round((totalSpent / totalProjectBudget) * 100) : 0;
    const remaining = totalProjectBudget - totalSpent;

    res.json({
      success: true,
      breakdown,
      vsActual,
      cumulativeCosts,
      totalBudget: totalProjectBudget,
      spent: totalSpent,
      remaining,
      spentPercent,
    });
  } catch (error) {
    console.error('[Dashboard Budget] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch budget data',
    });
  }
});

// ============================================================================
// MATERIALS & INVENTORY ROUTES
// ============================================================================

/**
 * GET /api/dashboard/inventory
 * Get materials and inventory data for the dashboard
 */
router.get('/dashboard/inventory', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const project = await getUserDefaultProject(userId);

    if (!project) {
      return res.json({
        success: true,
        items: [],
        usage: [],
        message: 'No active project found.',
      });
    }

    // For now, hardcode sample inventory data as we don't have an inventory table
    const inventoryItems: InventoryItem[] = [
      { id: '1', name: 'Cement', unit: 'bags', currentStock: 150, totalStock: 500, stockPercent: 30, consumptionVsEstimate: 10 },
      { id: '2', name: 'Sand', unit: 'tons', currentStock: 50, totalStock: 100, stockPercent: 50, consumptionVsEstimate: -5 },
      { id: '3', name: 'Bricks', unit: 'pieces', currentStock: 1000, totalStock: 5000, stockPercent: 20, consumptionVsEstimate: 0 },
      { id: '4', name: 'Steel Bars', unit: 'kg', currentStock: 500, totalStock: 2000, stockPercent: 25, consumptionVsEstimate: 15 },
      { id: '5', name: 'Pipes', unit: 'meters', currentStock: 30, totalStock: 100, stockPercent: 30, consumptionVsEstimate: -10 },
      { id: '6', name: 'Electrical Cables', unit: 'meters', currentStock: 20, totalStock: 100, stockPercent: 20, consumptionVsEstimate: 5 },
    ];

    const materialUsageData: MaterialUsage[] = [
      { material: 'Cement', used: 350, remaining: 150 },
      { material: 'Sand', used: 50, remaining: 50 },
      { material: 'Bricks', used: 4000, remaining: 1000 },
      { material: 'Steel', used: 1500, remaining: 500 },
    ];

    res.json({
      success: true,
      items: inventoryItems,
      usage: materialUsageData,
    });
  } catch (error) {
    console.error('[Dashboard Inventory] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory data',
    });
  }
});

// ============================================================================
// ISSUES & RISKS ROUTES
// ============================================================================

/**
 * GET /api/dashboard/issues
 * Get issues and risks data for the dashboard
 */
router.get('/dashboard/issues', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const project = await getUserDefaultProject(userId);

    if (!project) {
      return res.json({
        success: true,
        todo: [],
        inProgress: [],
        resolved: [],
        criticalIssues: 0,
        highIssues: 0,
        openIssues: 0,
        resolvedThisWeek: 0,
        types: [],
        message: 'No active project found.',
      });
    }

    const projectId = project.id;
    const allTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)));

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todoIssues: Issue[] = allTasks
      .filter(task => task.status === 'pending')
      .map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        status: 'todo',
        priority: task.priority || 'medium',
        reportedBy: 'System', // Placeholder
        reportedDate: task.createdAt || now,
      }));

    const inProgressIssues: Issue[] = allTasks
      .filter(task => task.status === 'in_progress')
      .map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        status: 'inProgress',
        priority: task.priority || 'medium',
        reportedBy: 'System', // Placeholder
        reportedDate: task.createdAt || now,
      }));

    const resolvedIssues: Issue[] = allTasks
      .filter(task => task.status === 'completed')
      .map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        status: 'resolved',
        priority: task.priority || 'low',
        reportedBy: 'System', // Placeholder
        reportedDate: task.completedAt || task.createdAt || now,
      }));

    const criticalIssues = allTasks.filter(task => 
      (task.status === 'pending' || task.status === 'in_progress') && task.priority === 'high'
    ).length; // Assuming 'high' priority tasks are critical issues
    
    const highIssues = allTasks.filter(task => 
      (task.status === 'pending' || task.status === 'in_progress') && task.priority === 'high'
    ).length; // Same as critical for now

    const openIssues = todoIssues.length + inProgressIssues.length;

    const resolvedThisWeek = allTasks.filter(task => 
      task.status === 'completed' && task.completedAt && task.completedAt >= oneWeekAgo
    ).length;

    // Simplified issue types - based on categories or keywords in description
    const issueTypes: IssueTypeCount[] = [
      { type: 'Design', count: 5, percentage: 25 },
      { type: 'Safety', count: 3, percentage: 15 },
      { type: 'Quality', count: 7, percentage: 35 },
      { type: 'Logistics', count: 3, percentage: 15 },
      { type: 'Environmental', count: 2, percentage: 10 },
    ];

    res.json({
      success: true,
      todo: todoIssues,
      inProgress: inProgressIssues,
      resolved: resolvedIssues,
      criticalIssues,
      highIssues,
      openIssues,
      resolvedThisWeek,
      types: issueTypes,
    });
  } catch (error) {
    console.error('[Dashboard Issues] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch issues data',
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
// SITE REPORTS & MEDIA ROUTES
// ============================================================================

/**
 * GET /api/dashboard/media
 * Get site reports and media data for the dashboard
 */
router.get('/dashboard/media', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const project = await getUserDefaultProject(userId);

    if (!project) {
      return res.json({
        success: true,
        recentPhotos: [],
        stats: {
          dailyLogsThisWeek: 0,
          photosUploaded: 0,
          siteCondition: 'Good',
        },
        message: 'No active project found.',
      });
    }

    const projectId = project.id;

    // Fetch recent photos
    const recentPhotos = await db
      .select({
        id: images.id,
        storagePath: images.storagePath, // Assuming this is the full URL
        caption: images.caption,
        createdAt: images.createdAt,
      })
      .from(images)
      .where(and(eq(images.projectId, projectId), isNull(images.deletedAt)))
      .orderBy(desc(images.createdAt))
      .limit(6);

    const photos: Photo[] = recentPhotos.map(img => ({
      id: img.id,
      thumbnailUrl: img.storagePath || '', // Use storagePath as thumbnail for now
      fullUrl: img.storagePath || '',
      caption: img.caption || '',
      date: img.createdAt || new Date(),
    }));

    // Get photo stats
    const totalPhotosUploadedResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(images)
      .where(and(eq(images.projectId, projectId), isNull(images.deletedAt)));
    const photosUploaded = parseInt(totalPhotosUploadedResult[0].count.toString());

    // Placeholder for daily logs (no dedicated table)
    const dailyLogsThisWeek = 5; // Hardcoded
    const siteCondition: 'Good' | 'Fair' | 'Poor' = 'Good'; // Hardcoded

    const stats: MediaStats = {
      dailyLogsThisWeek,
      photosUploaded,
      siteCondition,
    };

    res.json({
      success: true,
      recentPhotos: photos,
      stats,
    });
  } catch (error) {
    console.error('[Dashboard Media] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch media data',
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
// TRENDS & QUICK INSIGHTS ROUTES
// ============================================================================

/**
 * GET /api/dashboard/trends
 * Get trends and quick insights data for the dashboard
 */
router.get('/dashboard/trends', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const project = await getUserDefaultProject(userId);

    if (!project) {
      return res.json({
        success: true,
        progressTrend: [],
        costBurnTrend: [],
        insights: [],
        dailyBurnRate: 0,
        message: 'No active project found.',
      });
    }

    const projectId = project.id;

    // Progress trend (overall project progress over last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const historicalTasks = await db
      .select({
        date: sql<string>`DATE(${tasks.createdAt})`,
        status: tasks.status,
      })
      .from(tasks)
      .where(and(
        eq(tasks.projectId, projectId),
        isNull(tasks.deletedAt),
        gte(tasks.createdAt, thirtyDaysAgo)
      ))
      .orderBy(sql`DATE(${tasks.createdAt})`);

    const progressTrendMap: { [date: string]: { total: number, completed: number } } = {};
    let runningTotalTasks = 0;
    let runningCompletedTasks = 0;

    // Populate all dates in the last 30 days
    for (let i = 0; i <= 30; i++) {
      const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      const dateString = date.toISOString().split('T')[0];
      progressTrendMap[dateString] = { total: 0, completed: 0 };
    }

    const allHistoricalTasks = await db
      .select({
        id: tasks.id,
        status: tasks.status,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)))
      .orderBy(tasks.createdAt);

    allHistoricalTasks.forEach(task => {
      const dateString = new Date(task.createdAt).toISOString().split('T')[0];
      if (progressTrendMap[dateString]) { // Only count tasks within the 30-day window
        progressTrendMap[dateString].total++;
        if (task.status === 'completed') {
          progressTrendMap[dateString].completed++;
        }
      }
    });

    const progressTrend: DataPoint[] = Object.keys(progressTrendMap).sort().map(date => {
      // Calculate cumulative progress for each day
      runningTotalTasks += progressTrendMap[date].total;
      runningCompletedTasks += progressTrendMap[date].completed;

      const value = runningTotalTasks > 0 ? Math.round((runningCompletedTasks / runningTotalTasks) * 100) : 0;
      return { name: date, value };
    });

    // Cost burn trend (daily expenses over last 30 days)
    const dailyExpenses = await db
      .select({
        date: sql<string>`DATE(${expenses.expenseDate})`,
        amount: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      })
      .from(expenses)
      .where(and(
        eq(expenses.projectId, projectId),
        isNull(expenses.deletedAt),
        gte(expenses.expenseDate, thirtyDaysAgo)
      ))
      .groupBy(sql`DATE(${expenses.expenseDate})`)
      .orderBy(sql`DATE(${expenses.expenseDate})`);

    const costBurnTrend: DataPoint[] = dailyExpenses.map(d => ({
      name: d.date,
      value: d.amount,
    }));

    // Daily burn rate (average over last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last7DaysExpenses = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(DISTINCT DATE(${expenses.expenseDate}))`,
      })
      .from(expenses)
      .where(and(
        eq(expenses.projectId, projectId),
        isNull(expenses.deletedAt),
        gte(expenses.expenseDate, sevenDaysAgo)
      ));
    const totalSpentLast7Days = parseFloat(last7DaysExpenses[0].total.toString());
    const uniqueExpenseDays = parseInt(last7DaysExpenses[0].count.toString());
    const dailyBurnRate = uniqueExpenseDays > 0 ? Math.round(totalSpentLast7Days / uniqueExpenseDays) : 0;

    // Key insights (dynamic)
    const insights: Insight[] = [];

    // Insight 1: Overdue tasks
    const overdueTasks = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.projectId, projectId),
        isNull(tasks.deletedAt),
        sql`${tasks.dueDate} < ${now}::date`,
        sql`${tasks.status} IN ('pending', 'in_progress')`
      ))
      .limit(1);

    if (overdueTasks.length > 0) {
      const task = overdueTasks[0];
      const daysOverdue = Math.floor((now.getTime() - task.dueDate!.getTime()) / (1000 * 60 * 60 * 24));
      insights.push({
        type: 'alert',
        message: `<b>${task.title}</b> is overdue by ${daysOverdue} days.`,
      });
    }

    // Insight 2: High spending category in last 30 days
    const topCategory = await db
      .select({
        categoryName: expenseCategories.name,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(
        eq(expenses.projectId, projectId),
        isNull(expenses.deletedAt),
        gte(expenses.expenseDate, thirtyDaysAgo)
      ))
      .groupBy(expenseCategories.name)
      .orderBy(desc(sql`totalAmount`))
      .limit(1);

    if (topCategory.length > 0 && topCategory[0].categoryName) {
      insights.push({
        type: 'info',
        message: `Top spending category last 30 days: <b>${topCategory[0].categoryName}</b>`,
      });
    }

    // Insight 3: Recently completed tasks
    const recentlyCompletedTasks = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.projectId, projectId),
        eq(tasks.status, 'completed'),
        isNull(tasks.deletedAt),
        gte(tasks.completedAt, sevenDaysAgo)
      ))
      .orderBy(desc(tasks.completedAt))
      .limit(1);

    if (recentlyCompletedTasks.length > 0) {
      insights.push({
        type: 'success',
        message: `<b>${recentlyCompletedTasks[0].title}</b> was completed recently.`,
      });
    }


    res.json({
      success: true,
      progressTrend,
      costBurnTrend,
      dailyBurnRate,
      insights,
    });
  } catch (error) {
    console.error('[Dashboard Trends] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trends data',
    });
  }
});

// ============================================================================
// DEBUG ROUTES
// ============================================================================

/**
 * GET /api/debug/db
 * Debug endpoint - check database connection
 */
router.get('/debug/db', async (req: Request, res: Response) => {
  try {
    console.log('[DEBUG DB] Testing database connection...');
    
    // Test query
    const result = await db.select().from(profiles).limit(1);
    
    console.log('[DEBUG DB] ✅ Database query successful');
    
    return res.json({
      success: true,
      message: 'Database connection working',
      sampleData: result.length > 0 ? 'Found profiles' : 'No profiles yet',
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL_SET: !!process.env.DATABASE_URL,
        SUPABASE_URL_SET: !!process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY_SET: !!process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY_SET: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        SESSION_SECRET_SET: !!process.env.SESSION_SECRET,
      },
    });
  } catch (error: any) {
    console.error('[DEBUG DB] ❌ Database connection failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Database connection failed',
      details: error.message,
      stack: error.stack,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL_SET: !!process.env.DATABASE_URL,
        DATABASE_URL_PREVIEW: process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 20)}...` : 'NOT SET',
      },
    });
  }
});

/**
 * GET /api/debug/session
 * Debug endpoint - check session configuration
 */
router.get('/debug/session', async (req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      session: {
        sessionID: req.sessionID,
        hasSession: !!req.session,
        userId: req.session?.userId || null,
        whatsappNumber: req.session?.whatsappNumber || null,
      },
      env: {
        SESSION_SECRET_SET: !!process.env.SESSION_SECRET,
        NODE_ENV: process.env.NODE_ENV,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Session check failed',
      details: error.message,
    });
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

export default router;

