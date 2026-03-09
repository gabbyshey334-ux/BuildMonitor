/**
 * Vercel Serverless Function Entry Point
 * 
 * Self-contained API handler. All /api/* routes are defined in this file.
 * Does NOT load any external server file (no dist/server).
 * Webhook: /webhook/webhook -> api/whatsapp-webhook.js (see vercel.json).
 */

import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { generateToken, verifyToken, extractToken } from './utils/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS - allow credentials for same-origin; JWT sent via Authorization header
app.use((req, res, next) => {
  const origin = req.headers.origin || 'https://build-monitor-lac.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Trust proxy for Vercel
app.set('trust proxy', 1);

// Request logging (no session — we use JWT only)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  if (req.path.startsWith('/webhook')) {
    console.log(`[Request] ${req.method} ${req.path} - ${req.url}`);
  }
  next();
});

// ============================================================================
// DATABASE CONNECTION (Direct connection for serverless)
// ============================================================================

// Initialize database connection directly (for use in api/index.js)
// This avoids needing to import from dist/server/db.js which isn't available
let db = null;
let dbInitialized = false;

function initializeDatabase() {
  if (dbInitialized) return db;
  
  try {
    if (!process.env.DATABASE_URL) {
      console.warn('⚠️ DATABASE_URL not set - database features will be unavailable');
      dbInitialized = true;
      return null;
    }

    const queryClient = postgres(process.env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    // Initialize Drizzle with minimal schema (we'll use raw SQL for testing)
    db = drizzle(queryClient);
    dbInitialized = true;
    console.log('✅ Database connection initialized');
    return db;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    dbInitialized = true;
    return null;
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// ============================================================================
// WEBHOOK ROUTES
// ============================================================================
// Twilio WhatsApp webhook — handle inside index so we never 404 when rewrite hits index
app.all('/api/whatsapp-webhook', async (req, res) => {
  try {
    const { default: webhookHandler } = await import('./whatsapp-webhook.js');
    return webhookHandler(req, res);
  } catch (err) {
    console.error('[Webhook] Error:', err);
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    );
  }
});

// ============================================================================
// API ROUTES (all handlers are defined below — no external server file)
// ============================================================================

// Explicit route for dashboard summary — use Supabase so dashboard sees same data as WhatsApp webhook
app.get('/api/projects/:projectId/summary', (req, res, next) => {
  requireAuth(req, res, async () => {
    const projectId = req.params.projectId;
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
      console.log('[Summary] Running query for:', { projectId, userId });

      let projectRow = null;
      let totalSpent = 0;
      let expenseRowsForCumulative = [];
      let materialsRows = [];
      let openIssuesCount = 0;
      let criticalIssuesCount = 0;

      // Prefer Supabase client so we read the SAME database the WhatsApp webhook writes to
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('id, name, budget, status, created_at')
          .eq('id', projectId)
          .eq('user_id', userId)
          .maybeSingle();
        if (projectError) {
          console.error('[Summary] Supabase project error:', projectError);
          return res.status(500).json({ success: false, error: projectError.message });
        }
        projectRow = projectData;

        let expenseRowCount = 0;
        let expenseRowsForCumulative = [];
        if (projectRow) {
          const { data: expenseRows, error: expenseError } = await supabase
            .from('expenses')
            .select('amount, expense_date')
            .eq('project_id', projectId);
          if (expenseError) console.error('[Summary] Supabase expenses error:', expenseError);
          expenseRowCount = (expenseRows || []).length;
          totalSpent = (expenseRows || []).reduce((sum, row) => sum + parseFloat(String(row.amount || 0)), 0);
          expenseRowsForCumulative = expenseRows || [];
        }

        if (projectRow) {
          const { data: materialsData, error: materialsError } = await supabase
            .from('materials_inventory')
            .select('id, material_name, quantity, unit')
            .eq('project_id', projectId);
          if (materialsError) console.error('[Summary] Supabase materials_inventory error:', materialsError);
          materialsRows = materialsData || [];
        }

        try {
          const { count: openCount } = await supabase
            .from('issues')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('status', 'open');
          const { count: criticalCount } = await supabase
            .from('issues')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('status', 'open')
            .in('severity', ['high', 'critical']);
          openIssuesCount = openCount ?? 0;
          criticalIssuesCount = criticalCount ?? 0;
        } catch (issueErr) {
          console.warn('[Summary] Issues count failed:', issueErr?.message);
          openIssuesCount = 0;
          criticalIssuesCount = 0;
        }

        console.log('[Summary Debug]', {
          projectId,
          source: 'supabase',
          projectFound: !!projectRow,
          projectKeys: projectRow ? Object.keys(projectRow) : [],
          projectBudget: projectRow?.budget ?? 'NOT_FOUND',
          expenseRowCount,
          totalSpent,
        });
      }

      // Fallback: raw DB connection (must use same DB as webhook - set DATABASE_URL to Supabase connection string)
      if (!projectRow && initializeDatabase()) {
        const dbConnection = initializeDatabase();
        const projectResult = await dbConnection.execute(sql`
          SELECT id, name, budget, status, created_at
          FROM projects
          WHERE id = ${projectId} AND user_id = ${userId}
          LIMIT 1
        `);
        projectRow = Array.isArray(projectResult) ? projectResult[0] : (projectResult?.rows?.[0] ?? projectResult);

        if (projectRow) {
          const expenseResult = await dbConnection.execute(sql`
            SELECT amount, expense_date
            FROM expenses
            WHERE project_id = ${projectId}
          `);
          const rows = Array.isArray(expenseResult) ? expenseResult : (expenseResult?.rows || []);
          totalSpent = rows.reduce((sum, row) => sum + parseFloat(String(row?.amount || 0)), 0);
          expenseRowsForCumulative = rows;
        }

        if (projectRow) {
          try {
            const matResult = await dbConnection.execute(sql`
              SELECT id, material_name, quantity, unit
              FROM materials_inventory
              WHERE project_id = ${projectId}
            `);
            materialsRows = Array.isArray(matResult) ? matResult : (matResult?.rows || []);
          } catch (matErr) {
            console.warn('[Summary] materials_inventory query failed:', matErr?.message);
          }
        }

        console.log('[Summary Debug]', {
          projectId,
          source: 'database',
          projectFound: !!projectRow,
          projectBudget: projectRow?.budget ?? 'NOT_FOUND',
          totalSpent,
        });
      }

      if (!projectRow) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      const budgetAmount = parseFloat(String(projectRow.budget ?? '0'));
      const remaining = Math.max(0, budgetAmount - totalSpent);
      const percentage = budgetAmount > 0 ? Math.min(100, (totalSpent / budgetAmount) * 100) : 0;
      const createdAt = projectRow.created_at ? new Date(projectRow.created_at) : new Date();
      const daysSinceStart = Math.max(1, (Date.now() - createdAt.getTime()) / 86400000);
      const dailyBurnRate = totalSpent / daysSinceStart;
      const weeksRemaining = dailyBurnRate > 0 ? remaining / (dailyBurnRate * 7) : null;

      // Build cumulative costs by date (for Budget & Costs section)
      const byDate = {};
      for (const row of expenseRowsForCumulative) {
        const d = row.expense_date;
        const dateStr = typeof d === 'string' ? d.split('T')[0] : (d ? new Date(d).toISOString().split('T')[0] : null);
        if (dateStr) {
          byDate[dateStr] = (byDate[dateStr] || 0) + parseFloat(String(row.amount || 0));
        }
      }
      const sortedDates = Object.keys(byDate).sort();
      let running = 0;
      const cumulativeCosts = sortedDates.map((date) => {
        running += byDate[date];
        return { date, amount: Math.round(running * 100) / 100 };
      });

      const spentPercentRounded = Math.round(percentage * 10) / 10;
      const budgetSection = {
        totalBudget: budgetAmount,
        spent: totalSpent,
        remaining,
        spentPercent: spentPercentRounded,
        breakdown: budgetAmount > 0
          ? [{ category: 'Budget', amount: budgetAmount, percentage: 100, colorHex: '#218598' }]
          : [],
        vsActual:
          budgetAmount > 0 || totalSpent > 0
            ? [
                {
                  category: 'Total',
                  budgeted: budgetAmount,
                  actual: totalSpent,
                  variance:
                    budgetAmount > 0
                      ? Math.round(((totalSpent - budgetAmount) / budgetAmount) * 100)
                      : 0,
                  colorHex: '#218598',
                },
              ]
            : [],
        cumulativeCosts,
      };

      const items = materialsRows.map((row) => {
        const qty = parseFloat(String(row.quantity || 0));
        return {
          id: row.id,
          name: row.material_name || 'Material',
          unit: row.unit || 'units',
          currentStock: qty,
          totalStock: qty,
          stockPercent: qty > 0 ? 100 : 0,
          consumptionVsEstimate: 0,
        };
      });
      const usage = materialsRows.map((row) => ({
        material: row.material_name || 'Material',
        used: 0,
        remaining: parseFloat(String(row.quantity || 0)),
      }));
      const inventorySection = { items, usage };

      return res.json({
        success: true,
        project: {
          id: projectRow.id,
          name: projectRow.name,
          budget_amount: projectRow.budget,
          status: projectRow.status,
          created_at: projectRow.created_at,
        },
        budget: {
          total: budgetAmount,
          spent: totalSpent,
          remaining,
          percentage: Math.round(percentage * 10) / 10,
          dailyBurnRate: Math.round(dailyBurnRate * 100) / 100,
          weeksRemaining: weeksRemaining != null ? Math.round(weeksRemaining * 10) / 10 : null,
        },
        progress: {
          overallPercentage: 0,
          phases: [],
          milestones: [],
        },
        schedule: {
          status: percentage < 70 ? 'On Track' : percentage < 90 ? 'At Risk' : 'Delayed',
          daysAhead: 0,
          daysBehind: 0,
        },
        issues: { total: openIssuesCount ?? 0, critical: criticalIssuesCount ?? 0 },
        insights: {
          topDelayCause: null,
          mostUsedMaterial: null,
          recentHighlight: null,
          progressTrend: [],
          dailyCostBurn: [],
        },
        activity: { heatmap: [] },
        budgetSection,
        inventorySection,
      });
    } catch (err) {
      console.error('[Summary Error]', err.message, err.stack);
      return res.status(500).json({ success: false, error: err.message || 'Summary failed' });
    }
  });
});

// GET /api/projects/:projectId/expenses — Budget & Costs page data (Supabase-first, same as summary)
app.get('/api/projects/:projectId/expenses', (req, res, next) => {
  requireAuth(req, res, async () => {
    const projectId = req.params.projectId;
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Server not configured for expenses' });
      }
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

      const { data: projectRow, error: projectError } = await supabase
        .from('projects')
        .select('id, name, budget')
        .eq('id', projectId)
        .eq('user_id', userId)
        .maybeSingle();
      if (projectError || !projectRow) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      const budgetTotal = parseFloat(String(projectRow.budget || 0));

      let expenseRows;
      let expError;
      let expenseQuery = supabase
        .from('expenses')
        .select('id, description, amount, expense_date, source, created_at, disputed, category')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      const result = await expenseQuery;
      expError = result.error;
      expenseRows = result.data;
      if (expError && (expError.message || '').toLowerCase().includes('category')) {
        const fallback = await supabase
        .from('expenses')
        .select('id, description, amount, expense_date, source, created_at, disputed')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
        expError = fallback.error;
        expenseRows = (fallback.data || []).map((e) => ({ ...e, category: null }));
      }

      if (expError) {
        console.error('[Expenses]', expError);
        return res.status(500).json({ success: false, error: expError.message });
      }

      const expenses = expenseRows || [];
      const spent = expenses.reduce((sum, e) => sum + parseFloat(String(e.amount || 0)), 0);
      const remaining = Math.max(0, budgetTotal - spent);
      const percentage = budgetTotal > 0 ? Math.min(100, (spent / budgetTotal) * 100) : 0;
      const minDate = expenses.length
        ? Math.min(...expenses.map((e) => new Date(e.expense_date || e.created_at).getTime()))
        : Date.now();
      const daysSinceStart = Math.max(1, (Date.now() - minDate) / 86400000);
      const dailyBurnRate = spent / daysSinceStart;
      const weeklyBurnRate = dailyBurnRate * 7;
      const weeksRemaining = weeklyBurnRate > 0 ? remaining / weeklyBurnRate : null;

      const summary = {
        total: budgetTotal,
        spent,
        remaining,
        percentage: Math.round(percentage * 10) / 10,
        dailyBurnRate: Math.round(dailyBurnRate * 100) / 100,
        weeklyBurnRate: Math.round(weeklyBurnRate * 100) / 100,
        weeksRemaining: weeksRemaining != null ? Math.round(weeksRemaining * 10) / 10 : null,
      };

      const byCategoryMap = {};
      for (const e of expenses) {
        const cat = (e.category && String(e.category).trim()) ? String(e.category).trim() : 'General';
        if (!byCategoryMap[cat]) byCategoryMap[cat] = { total: 0, count: 0 };
        byCategoryMap[cat].total += parseFloat(String(e.amount || 0));
        byCategoryMap[cat].count += 1;
      }
      const byCategory = Object.entries(byCategoryMap).map(([category, v]) => ({
        category,
        total: v.total,
        count: v.count,
        percentage: spent > 0 ? Math.round((v.total / spent) * 1000) / 10 : 0,
      })).sort((a, b) => b.total - a.total);

      // This week / last week totals for spending spike alert
      const now = new Date();
      const getWeekBounds = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.getFullYear(), d.getMonth(), diff);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return { start: monday.getTime(), end: sunday.getTime() };
      };
      const thisWeek = getWeekBounds(now);
      const lastWeekStart = thisWeek.start - 7 * 24 * 60 * 60 * 1000;
      const lastWeekEnd = thisWeek.end - 7 * 24 * 60 * 60 * 1000;
      let thisWeekTotal = 0;
      let lastWeekTotal = 0;
      for (const e of expenses) {
        const t = new Date(e.expense_date || e.created_at).getTime();
        if (t >= thisWeek.start && t <= thisWeek.end) thisWeekTotal += parseFloat(String(e.amount || 0));
        if (t >= lastWeekStart && t <= lastWeekEnd) lastWeekTotal += parseFloat(String(e.amount || 0));
      }

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const byMonthMap = {};
      for (const e of expenses) {
        const d = e.expense_date;
        const dateStr = typeof d === 'string' ? d.split('T')[0] : (d ? new Date(d).toISOString().split('T')[0] : null);
        if (!dateStr || new Date(dateStr) < sixMonthsAgo) continue;
        const monthKey = dateStr.substring(0, 7);
        const monthLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (!byMonthMap[monthKey]) byMonthMap[monthKey] = { month: monthLabel, amount: 0, sortKey: monthKey };
        byMonthMap[monthKey].amount += parseFloat(String(e.amount || 0));
      }
      const byMonth = Object.values(byMonthMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map(({ month, amount }) => ({ month, amount }));

      const recent = expenses.slice(0, 20).map((e) => ({
        id: e.id,
        description: e.description || '',
        amount: parseFloat(String(e.amount || 0)),
        category: (e.category && String(e.category).trim()) ? String(e.category).trim() : 'General',
        expense_date: e.expense_date,
        vendor: null,
        source: e.source || null,
        created_at: e.created_at,
        disputed: !!e.disputed,
      }));

      const expensesForClient = expenses.map((e) => ({
        id: e.id,
        description: e.description || '',
        amount: parseFloat(String(e.amount || 0)),
        category: (e.category && String(e.category).trim()) ? String(e.category).trim() : 'General',
        expense_date: e.expense_date,
        vendor: null,
        source: e.source || null,
        created_at: e.created_at,
        disputed: !!e.disputed,
      }));

      let vendors = [];
      try {
        const { data: vendorRows } = await supabase
          .from('vendors')
          .select('name, total_spent')
          .eq('project_id', projectId)
          .order('total_spent', { ascending: false })
          .limit(10);
        vendors = (vendorRows || []).map((v) => ({
          name: v.name || '',
          total: parseFloat(String(v.total_spent || 0)),
          count: 0,
        }));
      } catch (_) { /* vendors table may not exist */ }

      return res.json({
        success: true,
        summary,
        byCategory,
        byMonth,
        recent,
        expenses: expensesForClient,
        vendors,
        thisWeekTotal: Math.round(thisWeekTotal * 100) / 100,
        lastWeekTotal: Math.round(lastWeekTotal * 100) / 100,
      });
    } catch (err) {
      console.error('[Expenses API Error]', err.message, err.stack);
      return res.status(500).json({ success: false, error: err.message || 'Failed to load expenses' });
    }
  });
});

// POST /api/projects/:projectId/expenses — Log expense from dashboard
app.post('/api/projects/:projectId/expenses', requireAuth, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.userId || req.user?.id;
    if (!userId) {
      console.error('[POST expenses] No userId — not authenticated');
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[POST expenses] Supabase not configured');
      return res.status(500).json({ success: false, error: 'Server not configured' });
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const { data: projectRow } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', userId).maybeSingle();
    if (!projectRow) {
      console.error('[POST expenses] Project not found:', projectId);
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    const body = req.body || {};
    const { description, category, vendor, expense_date } = body;
    const rawAmount = body.amount ?? body.Amount ?? 0;
    const amount = parseFloat(
      String(rawAmount).replace(/,/g, '').replace(/[^0-9.]/g, '')
    );
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    const today = (expense_date || new Date().toISOString().split('T')[0]).toString().substring(0, 10);
    const insertPayload = {
      project_id: projectId,
      user_id: userId,
      description: (description && String(description).trim()) ? String(description).trim() : 'Expense',
      amount,
      expense_date: today,
      currency: 'UGX',
      source: body.source || 'dashboard',
    };
    if (category !== undefined) insertPayload.category = category || 'Other';
    if (vendor !== undefined) insertPayload.vendor = vendor && String(vendor).trim() ? String(vendor).trim() : null;

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('[POST expenses] Supabase insert error:', error.message, error.details || '');
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to log expense',
      });
    }
    return res.status(201).json({ success: true, expense: expense || {} });
  } catch (err) {
    console.error('[POST expenses] Unexpected error:', err?.message, err?.stack || '');
    return res.status(500).json({
      success: false,
      error: err?.message || 'Server error',
    });
  }
});

// DELETE /api/expenses/:id — Delete expense (ownership: expense must belong to user's project)
app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ success: false, error: 'Server not configured' });
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    const { data: expenseRow, error: fetchErr } = await supabase
      .from('expenses')
      .select('id, project_id')
      .eq('id', expenseId)
      .maybeSingle();
    if (fetchErr || !expenseRow) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    const { data: projectRow } = await supabase
      .from('projects')
      .select('id')
      .eq('id', expenseRow.project_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!projectRow) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    const { error: deleteErr } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);
    if (deleteErr) {
      console.error('[DELETE expense]', deleteErr.message);
      return res.status(500).json({ success: false, error: deleteErr.message || 'Failed to delete' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE expense] Unexpected error:', err?.message, err?.stack || '');
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

// PATCH /api/expenses/:id — Update expense (ownership: expense must belong to user's project)
app.patch('/api/expenses/:id', requireAuth, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ success: false, error: 'Server not configured' });
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    const { data: expenseRow, error: fetchErr } = await supabase
      .from('expenses')
      .select('id, project_id')
      .eq('id', expenseId)
      .maybeSingle();
    if (fetchErr || !expenseRow) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    const { data: projectRow } = await supabase
      .from('projects')
      .select('id')
      .eq('id', expenseRow.project_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!projectRow) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    const body = req.body || {};
    const description = body.description != null ? String(body.description).trim() || 'Expense' : undefined;
    const rawAmount = body.amount;
    const amount = rawAmount != null ? parseFloat(String(rawAmount).replace(/,/g, '').replace(/[^0-9.]/g, '')) : undefined;
    if (amount !== undefined && (isNaN(amount) || amount < 0)) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    const updates = { updated_at: new Date().toISOString() };
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = amount;

    const { data: updated, error: updateErr } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', expenseId)
      .select()
      .single();
    if (updateErr) {
      console.error('[PATCH expense]', updateErr.message);
      return res.status(500).json({ success: false, error: updateErr.message || 'Failed to update' });
    }
    return res.json({ success: true, expense: updated });
  } catch (err) {
    console.error('[PATCH expense] Unexpected error:', err?.message, err?.stack || '');
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

// POST /api/projects/:projectId/issues — Report issue (issues table)
app.post('/api/projects/:projectId/issues', requireAuth, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ success: false, error: 'Server not configured' });
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const { data: projectRow } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', userId).maybeSingle();
    if (!projectRow) return res.status(404).json({ success: false, error: 'Project not found' });
    const { title, description, severity, type, status, priority } = req.body || {};
    const { error } = await supabase.from('issues').insert({
      project_id: projectId,
      title: title && String(title).trim() ? String(title).trim() : 'Untitled issue',
      description: description != null ? String(description) : '',
      severity: severity || priority || 'medium',
      type: type || 'general',
      status: status || 'open',
    });
    if (error) {
      console.error('[POST issues]', error.message, error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to report issue' });
    }
    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('[POST issues] Unexpected error:', err?.message, err?.stack);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to report issue' });
  }
});

// GET /api/projects/:projectId/tasks — List tasks for project (Vercel)
app.get('/api/projects/:projectId/tasks', requireAuth, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ success: false, tasks: [], error: 'Server not configured' });
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const { data: projectRow } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', userId).maybeSingle();
    if (!projectRow) return res.status(404).json({ success: false, tasks: [], error: 'Project not found' });
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[GET tasks]', error.message);
      return res.status(500).json({ success: false, tasks: [], error: error.message });
    }
    return res.json({ success: true, tasks: data ?? [] });
  } catch (err) {
    console.error('[GET tasks] Unexpected error:', err?.message, err?.stack);
    return res.status(500).json({ success: false, tasks: [], error: err?.message || 'Server error' });
  }
});

// GET /api/projects/:projectId/issues — List issues for Issues & Risks section
app.get('/api/projects/:projectId/issues', requireAuth, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ success: false, issues: [], error: 'Server not configured' });
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const { data: projectRow } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', userId).maybeSingle();
    if (!projectRow) return res.status(404).json({ success: false, issues: [], error: 'Project not found' });
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[GET issues]', error.message);
      return res.status(500).json({ success: false, issues: [], error: error.message });
    }
    return res.json({ success: true, issues: data ?? [] });
  } catch (err) {
    console.error('[GET issues] Unexpected error:', err?.message, err?.stack);
    return res.status(500).json({ success: false, issues: [], error: err?.message || 'Server error' });
  }
});

// POST /api/projects/:projectId/daily/log — Daily log entry
app.post('/api/projects/:projectId/daily/log', requireAuth, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ success: false, error: 'Server not configured' });
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const { data: projectRow } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', userId).maybeSingle();
    if (!projectRow) return res.status(404).json({ success: false, error: 'Project not found' });
    const { worker_count, notes, log_date } = req.body;
    const today = (log_date || new Date().toISOString().split('T')[0]).toString().substring(0, 10);
    const { data: existing } = await supabase.from('daily_logs').select('id, notes').eq('project_id', projectId).eq('log_date', today).maybeSingle();
    if (existing) {
      const updatedNotes = notes ? (existing.notes ? `${existing.notes}\n${notes}` : notes) : existing.notes;
      await supabase.from('daily_logs').update({ worker_count: worker_count ?? existing.worker_count, notes: updatedNotes }).eq('id', existing.id);
    } else {
      await supabase.from('daily_logs').insert({
        project_id: projectId,
        log_date: today,
        worker_count: worker_count || 0,
        notes: notes || '',
        created_at: new Date().toISOString(),
      });
    }
    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('[POST daily/log]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save daily log' });
  }
});

// POST /api/projects/:projectId/daily/photo — Register photo URL in daily log (client uploads to Storage first)
app.post('/api/projects/:projectId/daily/photo', requireAuth, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.userId || req.user?.id;
    if (!userId) {
      console.error('[POST daily/photo] No userId');
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[POST daily/photo] Supabase not configured');
      return res.status(500).json({ success: false, error: 'Server not configured' });
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const { data: projectRow } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', userId).maybeSingle();
    if (!projectRow) {
      console.error('[POST daily/photo] Project not found:', projectId);
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    const { photoUrl } = req.body || {};
    if (!photoUrl || typeof photoUrl !== 'string' || !photoUrl.startsWith('http')) {
      return res.status(400).json({ success: false, error: 'Valid photoUrl required' });
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('daily_logs')
      .select('id, photo_urls')
      .eq('project_id', projectId)
      .eq('log_date', today)
      .maybeSingle();

    const urls = Array.isArray(existing?.photo_urls) ? [...existing.photo_urls, photoUrl] : [photoUrl];

    if (existing) {
      const { error: updateErr } = await supabase
        .from('daily_logs')
        .update({ photo_urls: urls })
        .eq('id', existing.id);
      if (updateErr) {
        console.error('[POST daily/photo] daily_logs update error:', updateErr.message);
        return res.status(500).json({ success: false, error: updateErr.message || 'Failed to save photo URL' });
      }
    } else {
      const { error: insertErr } = await supabase.from('daily_logs').insert({
        project_id: projectId,
        log_date: today,
        worker_count: 0,
        notes: '',
        photo_urls: urls,
        created_at: new Date().toISOString(),
      });
      if (insertErr) {
        console.error('[POST daily/photo] daily_logs insert error:', insertErr.message);
        return res.status(500).json({ success: false, error: insertErr.message || 'Failed to save photo' });
      }
    }
    return res.status(201).json({ success: true, url: photoUrl });
  } catch (err) {
    console.error('[POST daily/photo] Unexpected error:', err?.message || err, err?.stack || '');
    return res.status(500).json({ success: false, error: err?.message || 'Failed to save photo' });
  }
});

// GET /api/projects/:projectId/materials — Materials & Inventory page (Supabase + DB merge so dashboard and WhatsApp materials both show)
app.get('/api/projects/:projectId/materials', (req, res, next) => {
  requireAuth(req, res, async () => {
    const projectId = req.params.projectId;
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Server not configured' });
      }
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

      const { data: projectRow, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .eq('user_id', userId)
        .maybeSingle();
      if (projectError || !projectRow) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      const byKey = new Map();
      function addRow(id, material_name, quantity, unit, last_updated) {
        const name = (material_name || '').trim().toLowerCase();
        if (!name) return;
        const qty = parseFloat(String(quantity)) || 0;
        const existing = byKey.get(name);
        const existingTime = existing?.last_updated ? new Date(existing.last_updated).getTime() : 0;
        const newTime = last_updated ? new Date(last_updated).getTime() : 0;
        if (!existing || newTime > existingTime) {
          byKey.set(name, { id, material_name: material_name || name, quantity: qty, unit: unit || 'units', last_updated: last_updated || null });
        }
      }

      const { data: rows, error } = await supabase
        .from('materials_inventory')
        .select('id, material_name, quantity, unit, last_updated')
        .eq('project_id', projectId)
        .order('material_name', { ascending: true });
      if (!error && rows && rows.length > 0) {
        for (const r of rows) {
          addRow(r.id, r.material_name, r.quantity, r.unit, r.last_updated);
        }
      }

      const dbConnection = initializeDatabase();
      if (dbConnection) {
        try {
          const matResult = await dbConnection.execute(sql`
            SELECT id, material_name, quantity, unit, last_updated
            FROM materials_inventory
            WHERE project_id = ${projectId}
            ORDER BY material_name
          `);
          const dbRows = Array.isArray(matResult) ? matResult : (matResult?.rows || []);
          for (const r of dbRows) {
            if (r && (r.id != null || r.material_name != null)) {
              addRow(r.id, r.material_name, r.quantity, r.unit, r.last_updated);
            }
          }
        } catch (dbErr) {
          console.warn('[Materials] DB fallback query failed:', dbErr?.message);
        }
      }

      const inventory = Array.from(byKey.values()).sort((a, b) => (a.material_name || '').localeCompare(b.material_name || ''));
      const lowStock = inventory.filter((m) => m.quantity <= 5).map((m) => ({
        material_name: m.material_name,
        quantity: m.quantity,
        unit: m.unit,
      }));
      const usage = [];
      const lastUpdated = inventory.length
        ? inventory.reduce((latest, m) => {
            const t = m.last_updated ? new Date(m.last_updated).getTime() : 0;
            return t > latest ? t : latest;
          }, 0)
        : null;
      const summary = {
        totalItems: inventory.length,
        lowStockCount: lowStock.length,
        lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
      };

      return res.json({
        success: true,
        inventory,
        lowStock,
        usage,
        summary,
      });
    } catch (err) {
      console.error('[Materials API Error]', err.message, err.stack);
      return res.status(500).json({ success: false, error: err.message || 'Failed to load materials' });
    }
  });
});

// GET /api/projects/:projectId/daily — Daily Accountability page
app.get('/api/projects/:projectId/daily', (req, res, next) => {
  requireAuth(req, res, async () => {
    const projectId = req.params.projectId;
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Server not configured' });
      }
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

      const { data: projectRow, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .eq('user_id', userId)
        .maybeSingle();
      if (projectError || !projectRow) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      const { data: logRows, error } = await supabase
        .from('daily_logs')
        .select('id, log_date, worker_count, notes, weather_condition, photo_urls, created_at')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false })
        .limit(60);

      if (error) {
        console.error('[Daily]', error);
        return res.status(500).json({ success: false, error: error.message });
      }

      const logs = logRows || [];
      const todayStr = new Date().toISOString().split('T')[0];
      const todayLog = logs.find((l) => (l.log_date || '').toString().substring(0, 10) === todayStr);

      const last60Dates = [];
      for (let i = 59; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last60Dates.push(d.toISOString().split('T')[0]);
      }

      const logByDate = {};
      for (const l of logs) {
        const d = (l.log_date || '').toString().substring(0, 10);
        if (d) logByDate[d] = l;
      }

      const heatmap = last60Dates.map((date) => {
        const log = logByDate[date];
        return {
          date,
          active: !!log,
          workerCount: log ? (log.worker_count || 0) : 0,
          hasNotes: !!(log && log.notes),
        };
      });

      const recentLogs = logs.slice(0, 10).map((l) => ({
        id: l.id,
        log_date: l.log_date,
        worker_count: l.worker_count,
        notes: l.notes,
        weather_condition: l.weather_condition,
        photo_urls: Array.isArray(l.photo_urls) ? l.photo_urls : (l.photo_urls ? [l.photo_urls] : []),
        created_at: l.created_at,
      }));

      const totalPhotos = logs.reduce((sum, l) => {
        const urls = Array.isArray(l.photo_urls) ? l.photo_urls : (l.photo_urls ? [l.photo_urls] : []);
        return sum + urls.length;
      }, 0);

      const workerCounts = logs.filter((l) => l.worker_count != null && l.worker_count > 0).map((l) => l.worker_count);
      const avgWorkerCount = workerCounts.length > 0 ? workerCounts.reduce((a, b) => a + b, 0) / workerCounts.length : 0;

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const thisWeekActive = logs.filter((l) => {
        const d = new Date(l.log_date + 'T12:00:00');
        return d >= startOfWeek;
      }).length;

      let currentStreak = 0;
      const sortedDates = [...new Set(logs.map((l) => (l.log_date || '').toString().substring(0, 10)))].sort().reverse();
      for (let i = 0; i < sortedDates.length; i++) {
        const expected = new Date();
        expected.setDate(expected.getDate() - i);
        const expectedStr = expected.toISOString().split('T')[0];
        if (sortedDates[i] === expectedStr) currentStreak++;
        else break;
      }

      const stats = {
        totalActiveDays: logs.length,
        currentStreak,
        avgWorkerCount: Math.round(avgWorkerCount * 10) / 10,
        totalPhotos,
        thisWeekActive,
      };

      const today = {
        active: !!todayLog,
        workerCount: todayLog ? (todayLog.worker_count || 0) : 0,
        notes: todayLog ? (todayLog.notes || '') : '',
        photos: todayLog
          ? (Array.isArray(todayLog.photo_urls) ? todayLog.photo_urls : todayLog.photo_urls ? [todayLog.photo_urls] : [])
          : [],
      };

      return res.json({
        success: true,
        heatmap,
        recentLogs,
        stats,
        today,
      });
    } catch (err) {
      console.error('[Daily API Error]', err.message, err.stack);
      return res.status(500).json({ success: false, error: err.message || 'Failed to load daily logs' });
    }
  });
});

// GET /api/projects/:projectId/trends — Trends & Insights page
app.get('/api/projects/:projectId/trends', (req, res, next) => {
  requireAuth(req, res, async () => {
    const projectId = req.params.projectId;
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Server not configured' });
      }
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

      const { data: projectRow, error: projectError } = await supabase
        .from('projects')
        .select('id, budget')
        .eq('id', projectId)
        .eq('user_id', userId)
        .maybeSingle();
      if (projectError || !projectRow) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      const budgetTotal = parseFloat(String(projectRow.budget || 0));

      const { data: expenseRows } = await supabase
        .from('expenses')
        .select('amount, expense_date, created_at')
        .eq('project_id', projectId);

      const { data: logRows } = await supabase
        .from('daily_logs')
        .select('log_date, worker_count')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false })
        .limit(90);

      const { data: materialRows } = await supabase
        .from('materials_inventory')
        .select('material_name, quantity, unit')
        .eq('project_id', projectId)
        .order('quantity', { ascending: false })
        .limit(5);

      const { data: vendorRows } = await supabase
        .from('vendors')
        .select('name, total_spent')
        .eq('project_id', projectId)
        .order('total_spent', { ascending: false })
        .limit(5);

      const expenses = expenseRows || [];
      const logs = logRows || [];
      const materials = materialRows || [];
      const vendorList = vendorRows || [];

      const totalSpent = expenses.reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
      const remaining = Math.max(0, budgetTotal - totalSpent);
      const daysSinceFirst = expenses.length
        ? Math.max(1, (Date.now() - Math.min(...expenses.map((e) => new Date(e.expense_date || e.created_at).getTime()))) / 86400000)
        : 1;
      const dailyBurn = totalSpent / daysSinceFirst;
      const weeklyBurnRate = dailyBurn * 7;
      const weeksRemaining = weeklyBurnRate > 0 ? remaining / weeklyBurnRate : null;
      const budgetRunout = weeksRemaining != null && weeksRemaining < 999
        ? new Date(Date.now() + weeksRemaining * 7 * 86400000).toISOString().split('T')[0]
        : null;

      const byMonthMap = {};
      for (const e of expenses) {
        const d = e.expense_date || e.created_at;
        const dateStr = typeof d === 'string' ? d.split('T')[0] : (d ? new Date(d).toISOString().split('T')[0] : null);
        if (!dateStr) continue;
        const monthKey = dateStr.substring(0, 7);
        const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (!byMonthMap[monthKey]) byMonthMap[monthKey] = { month: label, amount: 0, sortKey: monthKey };
        byMonthMap[monthKey].amount += parseFloat(String(e.amount || 0));
      }
      const byMonth = Object.values(byMonthMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map(({ month, amount }) => ({ month, amount }));

      const last3Months = byMonth.slice(-3);
      const spendingTrend = last3Months.length < 2 ? 'stable'
        : last3Months[last3Months.length - 1].amount > last3Months[last3Months.length - 2].amount ? 'increasing'
        : last3Months[last3Months.length - 1].amount < last3Months[last3Months.length - 2].amount ? 'decreasing'
        : 'stable';

      const byDay = logs.map((l) => ({
        date: l.log_date,
        count: l.worker_count || 0,
      })).slice(0, 30);
      const workerCounts = logs.filter((l) => l.worker_count != null && l.worker_count > 0).map((l) => l.worker_count);
      const workerAvg = workerCounts.length > 0 ? workerCounts.reduce((a, b) => a + b, 0) / workerCounts.length : 0;
      const workerPeak = workerCounts.length > 0 ? Math.max(...workerCounts) : 0;
      const workersTrend = byDay.length < 2 ? 'stable'
        : (byDay[byDay.length - 1]?.count || 0) > (byDay[byDay.length - 2]?.count || 0) ? 'increasing'
        : (byDay[byDay.length - 1]?.count || 0) < (byDay[byDay.length - 2]?.count || 0) ? 'decreasing'
        : 'stable';

      const mostUsed = materials.map((m) => ({
        name: m.material_name || '',
        quantity: parseFloat(String(m.quantity || 0)),
        unit: m.unit || 'units',
      }));

      const topVendors = vendorList.map((v) => ({
        name: v.name || '',
        total: parseFloat(String(v.total_spent || 0)),
      }));

      const alerts = [];
      if (budgetTotal > 0 && (totalSpent / budgetTotal) > 0.8) {
        alerts.push({ type: 'budget_warning', message: 'Over 80% of budget used', severity: 'high', date: new Date().toISOString().split('T')[0] });
      }
      const lowStockMaterials = materials.filter((m) => parseFloat(String(m.quantity || 0)) <= 5);
      for (const m of lowStockMaterials) {
        alerts.push({ type: 'low_stock', message: `${m.material_name} low on stock (${m.quantity} ${m.unit})`, severity: 'medium', date: new Date().toISOString().split('T')[0] });
      }

      return res.json({
        success: true,
        spending: {
          byMonth,
          byWeek: [],
          trend: spendingTrend,
          projectedCompletion: null,
        },
        workers: {
          byDay,
          average: Math.round(workerAvg * 10) / 10,
          peak: workerPeak,
          trend: workersTrend,
        },
        materials: {
          mostUsed,
          topVendors,
        },
        alerts,
        predictions: {
          estimatedCompletion: null,
          budgetRunout,
          weeklyBurnRate: Math.round(weeklyBurnRate * 100) / 100,
        },
      });
    } catch (err) {
      console.error('[Trends API Error]', err.message, err.stack);
      return res.status(500).json({ success: false, error: err.message || 'Failed to load trends' });
    }
  });
});

// ============================================================================
// TEST ENDPOINTS (available even when server app is loaded)
// ============================================================================

// Debug Auth Endpoint (JWT only — no session)
app.get('/api/debug/session', async (req, res) => {
  try {
    const token = extractToken(req);
    const decoded = token ? verifyToken(token) : null;
    res.json({
      success: true,
      auth: 'JWT only (no session)',
      userId: decoded?.userId || null,
      env: {
        JWT_SECRET_SET: !!process.env.JWT_SECRET,
        NODE_ENV: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Auth check failed',
      details: error.message
    });
  }
});

// WhatsApp Debug Endpoint (always available - BEFORE server app mounts)
app.get('/webhook/debug', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    res.json({
      success: true,
      total: 0,
      logs: [],
      message: 'WhatsApp debug endpoint reached (fallback mode - logs not available)',
      limit,
      note: 'If compiled server loads, this will show actual WhatsApp logs'
    });
  } catch (error) {
    console.error('[WhatsApp Debug] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// AUTHENTICATION ENDPOINTS (always available - BEFORE server app mounts)
// ============================================================================

// Middleware to check authentication (JWT only — no session)
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated',
      message: 'Please log in to access this resource',
    });
  }
    const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      message: 'Please log in again',
    });
  }
      req.userId = decoded.userId;
      req.userEmail = decoded.email;
      req.user = { id: decoded.userId };
      return next();
}

// POST /api/auth/login - Login user with Supabase Auth
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('[Login] Attempt:', email);
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Initialize Supabase client for authentication
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Login] ❌ Missing Supabase credentials');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be configured',
      });
    }

    // Create auth client with anon key for user authentication
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Sign in with Supabase Auth
    console.log('[Login] Attempting Supabase sign in...');
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      console.error('[Login] ❌ Supabase Auth error:', authError?.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: authError?.message || 'Authentication failed',
      });
    }

    console.log('[Login] ✅ Supabase Auth successful:', authData.user.id);

    // Get or create profile from Supabase profiles table (no Drizzle/Postgres)
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) {
      console.error('[Login] ❌ SUPABASE_SERVICE_ROLE_KEY not set');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'SUPABASE_SERVICE_ROLE_KEY must be configured',
      });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, whatsapp_number')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[Login] ❌ Profile fetch error:', profileError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to load profile',
        message: profileError.message,
      });
    }

    let userProfile = profile;
    if (!userProfile) {
      const fullName = authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'User';
      const whatsappNumber = (authData.user.user_metadata?.whatsapp_number || '').trim() || ('pending-' + authData.user.id.substring(0, 8));
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: authData.user.id,
            email: authData.user.email,
            full_name: fullName,
            whatsapp_number: whatsappNumber,
          },
          { onConflict: 'id' }
        )
        .select('id, email, full_name, whatsapp_number')
        .single();
      if (insertErr || !inserted) {
        console.error('[Login] ❌ Profile upsert error:', insertErr?.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to create profile',
          message: insertErr?.message || 'Please contact support',
        });
      }
      userProfile = inserted;
      console.log('[Login] ✅ Profile created in profiles table');
    }

    // Merge WhatsApp-only orphan profiles: same whatsapp_number but different profile id (created by bot before dashboard signup)
    const dashWhatsApp = (userProfile.whatsapp_number || '').trim();
    const isPendingNumber = !dashWhatsApp || dashWhatsApp.startsWith('pending-') || /^pending-/i.test(dashWhatsApp);
    if (dashWhatsApp && !isPendingNumber) {
      const { data: orphanProfiles, error: orphanErr } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('whatsapp_number', dashWhatsApp)
        .neq('id', authData.user.id);

      if (!orphanErr && orphanProfiles && orphanProfiles.length > 0) {
        for (const orphan of orphanProfiles) {
          const orphanId = orphan.id;
          const { error: updateProjErr } = await supabaseAdmin
            .from('projects')
            .update({ user_id: authData.user.id })
            .eq('user_id', orphanId);
          if (updateProjErr) console.error('[Login] Merge projects error:', updateProjErr.message);

          const { error: updateExpErr } = await supabaseAdmin
            .from('expenses')
            .update({ user_id: authData.user.id })
            .eq('user_id', orphanId);
          if (updateExpErr) console.error('[Login] Merge expenses error:', updateExpErr.message);

          await supabaseAdmin.from('projects').update({ manager_id: null }).eq('manager_id', orphanId);
          await supabaseAdmin.from('profiles').delete().eq('id', orphanId);
          console.log('[Login] ✅ Merged WhatsApp profile', orphanId, '→', authData.user.id);
        }
      }
    }

    // Generate JWT token (client stores it and sends via Authorization header)
    const token = generateToken(authData.user.id, userProfile.email || authData.user.email);

    return res.json({
      success: true,
      token,
      user: {
        id: userProfile.id,
        email: userProfile.email || authData.user.email,
        fullName: userProfile.full_name,
        whatsappNumber: userProfile.whatsapp_number,
      },
    });
  } catch (error) {
    console.error('[Login] ❌ Unexpected error:', error);
    console.error('[Login] ❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// POST /api/auth/register - Register new user with Supabase Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, whatsappNumber, email, password } = req.body;
    console.log('[Register] Attempt:', email);

    if (!fullName || !whatsappNumber || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: fullName, whatsappNumber, email, password',
      });
    }

    // Initialize Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Register] ❌ Missing Supabase credentials');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured',
      });
    }

    // Create admin client for user creation
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Create user in Supabase Auth
    console.log('[Register] Creating Supabase Auth user...');
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for MVP
      user_metadata: {
        full_name: fullName,
        whatsapp_number: whatsappNumber,
      },
    });

    if (authError || !authData.user) {
      console.error('[Register] ❌ Supabase Auth error:', authError?.message);
      return res.status(400).json({
        success: false,
        error: authError?.message || 'Failed to create user',
      });
    }

    console.log('[Register] ✅ Supabase Auth user created:', authData.user.id);

    // Create profile in Supabase profiles table (no Drizzle/Postgres)
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: authData.user.id,
          email,
          full_name: fullName,
          whatsapp_number: whatsappNumber,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      console.error('[Register] ❌ Profile insert error:', profileError.message);
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({
        success: false,
        error: 'Failed to create profile',
        message: profileError.message,
      });
    }

    console.log('[Register] ✅ Profile created in profiles table');

    // Generate JWT token
    const token = generateToken(authData.user.id, email);

    console.log('[Register] ✅ Token generated for user:', authData.user.id);

    // Return token and user data
    res.status(201).json({
      success: true,
      token, // JWT token for frontend to store
      user: {
        id: authData.user.id,
        email,
        fullName,
        whatsappNumber,
      },
    });
  } catch (error) {
    console.error('[Register] ❌ Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// GET /api/auth/me - Get current user (using JWT)
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const userId = req.userId; // Set by requireAuth middleware
    console.log('[Auth Me] User ID from token:', userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, whatsapp_number, default_currency, preferred_language')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[Auth Me] ❌ Profile error:', profileError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user',
      });
    }

    if (!profile) {
      console.log('[Auth Me] ❌ User profile not found');
      return res.status(404).json({
        success: false,
        error: 'User profile not found',
      });
    }

    console.log('[Auth Me] ✅ Success:', profile.id);

    res.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email || null,
        fullName: profile.full_name,
        whatsappNumber: profile.whatsapp_number,
        defaultCurrency: profile.default_currency || 'UGX',
        preferredLanguage: profile.preferred_language || 'en',
      },
    });
  } catch (error) {
    console.error('[Auth Me] ❌ Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      details: error.message,
    });
  }
});

// POST /api/auth/logout - Logout user (JWT - just clear token on frontend)
app.post('/api/auth/logout', (req, res) => {
  console.log('[Logout] Logout requested');
  // With JWT, logout is handled on the frontend by removing the token
  // No server-side action needed
  res.json({
    success: true,
    message: 'Logged out successfully. Please clear token on frontend.',
  });
});

// POST /api/auth/forgot-password - Send password reset email (Supabase Auth)
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        message: 'Email is required',
      });
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[forgot-password] Supabase URL or ANON_KEY not set');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'Server configuration error',
      });
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const redirectTo = process.env.APP_URL ? `${process.env.APP_URL}/reset-password` : undefined;
    console.log('[forgot-password] redirectTo:', redirectTo);
    console.log('[forgot-password] Sending reset to:', email.trim());
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo || undefined,
    });
    if (error) {
      console.error('[forgot-password] Supabase error:', error.message);
      console.error('[forgot-password] Full Supabase error:', JSON.stringify(error));
      return res.status(400).json({
        success: false,
        error: error.message,
        message: error.message,
      });
    }
    // Supabase dashboard: Authentication → Email Templates → ensure "Reset Password" is enabled.
    // Authentication → Settings → "Enable email confirmations" and SMTP. Free tier: 3 emails/hour; custom SMTP may be needed.
    return res.json({
      success: true,
      message: 'Reset link sent',
      emailProvider: 'supabase',
    });
  } catch (err) {
    console.error('[forgot-password] Unexpected error:', err?.message || err, err?.stack || '');
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: err?.message || 'Server error',
    });
  }
});

// POST /api/auth/change-password - Change password (Supabase Auth)
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both passwords required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be 8+ characters' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // Get user email from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.email) {
      return res.status(400).json({ error: 'Could not find user profile' });
    }

    // Verify current password via Supabase Auth sign-in
    const authClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { error: signInError } = await authClient.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (signInError) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      console.error('[Change Password] Update error:', updateError);
      return res.status(500).json({ error: 'Failed to change password' });
    }

    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('[Change Password]', err);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /api/auth/link-whatsapp - Link WhatsApp number so web app shows WhatsApp-created projects
app.post('/api/auth/link-whatsapp', requireAuth, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { phone } = req.body;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const normalized = phone.trim().replace(/\s/g, '');
    const withPlus = normalized.startsWith('+') ? normalized : `+${normalized}`;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ success: false, error: 'Server not configured' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from('profiles')
      .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
      .eq('whatsapp_number', withPlus)
      .select('id');

    if (error) {
      if ((error.message || '').toLowerCase().includes('auth_user_id')) {
        return res.status(500).json({
          success: false,
          error: 'Linking not available: add column auth_user_id (UUID) to profiles table.',
        });
      }
      console.error('[Link WhatsApp]', error);
      return res.status(500).json({ success: false, error: error.message || 'Update failed' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No WhatsApp profile found for this number. Use this exact number in WhatsApp (e.g. +2349165631240).',
      });
    }

    return res.status(200).json({ success: true, message: 'WhatsApp number linked. Your WhatsApp projects will now appear on the web.' });
  } catch (err) {
    console.error('[Link WhatsApp]', err);
    return res.status(500).json({ success: false, error: 'Failed to link WhatsApp' });
  }
});

// POST /api/waitlist - Join waitlist (landing page)
app.post('/api/waitlist', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    // Optional: persist to DB (e.g. waitlist table) or external service
    console.log('[Waitlist] Joined:', trimmed);
    res.json({ success: true, message: 'Thanks for joining the waitlist!' });
  } catch (error) {
    console.error('[Waitlist] Error:', error);
    res.status(500).json({ success: false, error: 'Could not join waitlist' });
  }
});

// ============================================================================
// PROJECTS ENDPOINTS (always available - BEFORE server app mounts)
// ============================================================================

// GET all projects for current user
app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const userId = req.userId; // Set by requireAuth middleware
    
    if (!userId) {
      console.log('[Get Projects] No user ID in session');
      return res.status(401).json({ 
        success: false,
        error: 'Not authenticated',
        message: 'Please log in to view projects'
      });
    }

    console.log('[Get Projects] Fetching projects for user:', userId);

    // Initialize Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Get Projects] Missing Supabase credentials');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured',
      });
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Include projects from linked WhatsApp profiles (profiles.auth_user_id = this user)
    let userIdsToFetch = [userId];
    const { data: linkedProfiles, error: linkedError } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', userId);
    if (!linkedError && linkedProfiles && Array.isArray(linkedProfiles)) {
      const ids = linkedProfiles.map((p) => p.id).filter(Boolean);
      userIdsToFetch = [...new Set([userId, ...ids])];
    }

    // Fetch projects: owned by user (or linked profiles) OR managed by user
    const { data: projectsOwned, error: errOwned } = await supabase
      .from('projects')
      .select(`
        id,
        user_id,
        name,
        description,
        budget,
        spent,
        currency,
        status,
        created_at,
        updated_at
      `)
      .in('user_id', userIdsToFetch)
      .order('created_at', { ascending: false });

    if (errOwned) {
      console.error('[Get Projects] Database error:', errOwned);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch projects',
        message: errOwned.message,
      });
    }

    const { data: projectsManaged, error: errManaged } = await supabase
      .from('projects')
      .select(`
        id,
        user_id,
        name,
        description,
        budget,
        spent,
        currency,
        status,
        created_at,
        updated_at
      `)
      .eq('manager_id', userId)
      .order('created_at', { ascending: false });

    if (errManaged) {
      console.error('[Get Projects] Managed projects error:', errManaged);
    }

    const seen = new Set((projectsOwned || []).map((p) => p.id));
    const projects = [...(projectsOwned || [])];
    for (const p of projectsManaged || []) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        projects.push(p);
      }
    }
    projects.sort((a, b) => new Date((b.updated_at || b.created_at) || 0) - new Date((a.updated_at || a.created_at) || 0));

    console.log('[Get Projects] Successfully fetched', projects?.length || 0, 'projects');

    const projectIds = (projects || []).map((p) => p.id).filter(Boolean);
    let expenseSums = {}; // project_id -> { totalSpent, lastActivity }
    let dailyLogMax = {}; // project_id -> lastLogDate

    if (projectIds.length > 0) {
      const { data: expenseRows } = await supabase
        .from('expenses')
        .select('project_id, amount, created_at')
        .in('project_id', projectIds);
      if (expenseRows && Array.isArray(expenseRows)) {
        for (const row of expenseRows) {
          const pid = row.project_id;
          if (!pid) continue;
          if (!expenseSums[pid]) expenseSums[pid] = { totalSpent: 0, lastActivity: null };
          expenseSums[pid].totalSpent += parseFloat(row.amount || 0);
          const at = row.created_at;
          if (at && (!expenseSums[pid].lastActivity || new Date(at) > new Date(expenseSums[pid].lastActivity))) {
            expenseSums[pid].lastActivity = at;
          }
        }
      }
      const { data: logRows } = await supabase
        .from('daily_logs')
        .select('project_id, log_date')
        .in('project_id', projectIds);
      if (logRows && Array.isArray(logRows)) {
        for (const row of logRows) {
          const pid = row.project_id;
          if (!pid || !row.log_date) continue;
          const d = row.log_date.toString().substring(0, 10);
          if (!dailyLogMax[pid] || d > dailyLogMax[pid]) dailyLogMax[pid] = d;
        }
      }
    }

    // Transform to match frontend expectations — use real spent & last activity from DB
    const transformedProjects = (projects || []).map(project => {
      const pid = project.id;
      const fromExpenses = expenseSums[pid] || {};
      const realSpent = fromExpenses.totalSpent != null ? fromExpenses.totalSpent : parseFloat(project.spent || 0);
      const lastExpenseAt = fromExpenses.lastActivity || null;
      const lastLogDate = dailyLogMax[pid] || null;
      const projectUpdated = project.updated_at || project.created_at || null;
      const lastActivity = [lastExpenseAt, lastLogDate, projectUpdated]
        .filter(Boolean)
        .map(d => (d.toString().length === 10 ? d + 'T12:00:00Z' : d))
        .reduce((latest, d) => {
          const t = new Date(d).getTime();
          return !latest || t > new Date(latest).getTime() ? d : latest;
        }, null);
      const budget = parseFloat(project.budget || 0);
      const progress = budget > 0 ? Math.min(100, Math.round((realSpent / budget) * 100)) : 0;

      return {
      id: project.id,
      userId: project.user_id,
      name: project.name,
      description: project.description,
        budget,
        budgetAmount: budget,
        spent: realSpent,
        totalSpent: realSpent,
      currency: project.currency || 'UGX',
      status: project.status || 'active',
        progress,
        lastActivity: lastActivity || project.updated_at || project.created_at,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      };
    });

    res.json({
      success: true,
      projects: transformedProjects,
    });
  } catch (error) {
    console.error('[Get Projects] Unexpected error:', error);
    console.error('[Get Projects] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects',
      details: error.message,
    });
  }
});

// POST create new project
app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    const userId = req.userId; // Set by requireAuth middleware
    const { name, description, budget, budgetAmount, currency = 'UGX', status = 'active' } = req.body;

    // Support both 'budget' and 'budgetAmount' for backward compatibility
    const budgetRaw = budget || budgetAmount;
    function parseBudgetValue(val) {
      if (val == null || val === '') return NaN;
      const s = String(val).replace(/,/g, '').replace(/\s/g, '').trim();
      if (!s) return NaN;
      const mMatch = s.match(/^(\d+(?:\.\d+)?)[Mm]$/);
      const bMatch = s.match(/^(\d+(?:\.\d+)?)[Bb]$/);
      if (mMatch) return parseFloat(mMatch[1]) * 1e6;
      if (bMatch) return parseFloat(bMatch[1]) * 1e9;
      return parseFloat(s);
    }
    const parsedBudget = parseBudgetValue(budgetRaw);

    console.log('[Create Project] ============================================');
    console.log('[Create Project] Request received:', {
      userId,
      name,
      description,
      budget: budgetRaw,
      parsedBudget,
      currency,
      status,
      bodyKeys: Object.keys(req.body),
    });
    console.log('[Create Project] Auth:', {
      userId: req.userId || null,
    });

    // Check authentication
    if (!userId) {
      console.error('[Create Project] ❌ No user ID (JWT required)');
      return res.status(401).json({ 
        success: false,
        error: 'Not authenticated',
        message: 'Please log in to create projects'
      });
    }

    // Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      console.error('[Create Project] ❌ Validation failed: name is required');
      return res.status(400).json({
        success: false,
        error: 'Project name is required',
        message: 'Please provide a project name',
      });
    }

    if (!budgetRaw || isNaN(parsedBudget) || parsedBudget <= 0) {
      console.error('[Create Project] ❌ Validation failed: invalid budget');
      return res.status(400).json({
        success: false,
        error: 'Valid budget amount is required',
        message: 'Budget amount must be greater than 0 (e.g. 30000000 or 30M)',
      });
    }

    // Initialize Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('[Create Project] Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseServiceKey?.length || 0,
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Create Project] ❌ Missing Supabase credentials');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured',
        debug: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseServiceKey,
        }
      });
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Normalize status - new schema uses 'active', 'completed', 'on_hold'
    const validStatuses = ['active', 'completed', 'on_hold'];
    let normalizedStatus = 'active';
    if (status && typeof status === 'string') {
      const lowerStatus = status.toLowerCase().trim();
      // Map old status values to new ones
      if (lowerStatus === 'paused') {
        normalizedStatus = 'on_hold';
      } else if (validStatuses.includes(lowerStatus)) {
        normalizedStatus = lowerStatus;
      }
    }

    // Parse budget amount (already parsed above)
    if (isNaN(parsedBudget) || parsedBudget < 0) {
      console.error('[Create Project] ❌ Invalid budget amount:', budgetRaw);
      return res.status(400).json({
        success: false,
        error: 'Invalid budget amount',
        message: 'Budget must be a valid positive number (e.g. 30M or 30,000,000)',
      });
    }

    // Verify profile exists before creating project (projects reference profiles.id)
    const { data: profileCheck } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!profileCheck) {
      console.error('[Create Project] ❌ User profile not found:', userId);
          return res.status(400).json({
            success: false,
        error: 'User profile not found',
        message: 'Your profile was not found. Please log out and log in again, or contact support.',
      });
    }
    console.log('[Create Project] ✅ Profile verified');

    // Prepare insert data
    const insertData = {
      user_id: userId,
      name: name.trim(),
      description: description?.trim() || null,
      budget: parsedBudget,
      currency: currency || 'UGX',
      status: normalizedStatus,
      spent: 0, // Will be calculated automatically by trigger
    };

    console.log('[Create Project] Inserting project with data:', insertData);

    // Insert project
    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert([insertData])
      .select()
      .single();

    if (insertError) {
      console.error('[Create Project] ❌ Database error:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        error: insertError,
      });
      
      // Provide more specific error messages
      let errorMessage = insertError.message || 'Failed to create project';
      let statusCode = 500;
      
      if (insertError.code === '23505') { // Unique violation
        errorMessage = 'A project with this name already exists';
        statusCode = 409;
      } else if (insertError.code === '23503') { // Foreign key violation
        errorMessage = 'Invalid user ID - user not found';
        statusCode = 400;
      } else if (insertError.code === '42501') { // Insufficient privilege
        errorMessage = 'Permission denied - check RLS policies';
        statusCode = 403;
      } else if (insertError.message?.includes('column') && insertError.message?.includes('does not exist')) {
        errorMessage = 'Database schema mismatch - column not found. Please run migrations.';
        statusCode = 500;
      }
      
      return res.status(statusCode).json({ 
        success: false,
        error: 'Failed to create project',
        message: errorMessage,
        details: insertError.details || insertError.hint,
        code: insertError.code,
        debug: process.env.NODE_ENV === 'development' ? {
          fullError: insertError,
          insertData,
        } : undefined,
      });
    }

    if (!project) {
      console.error('[Create Project] ❌ No project returned from insert');
      return res.status(500).json({
        success: false,
        error: 'Failed to create project',
        message: 'Project was not created - no data returned',
      });
    }

    console.log('[Create Project] ✅ Successfully created project:', {
      id: project.id,
      name: project.name,
      userId: project.user_id,
    });

    // Transform to match frontend expectations
    const transformedProject = {
      id: project.id,
      userId: project.user_id,
      name: project.name,
      description: project.description,
      budget: parseFloat(project.budget || 0),
      budgetAmount: parseFloat(project.budget || 0), // Keep for backward compatibility
      spent: parseFloat(project.spent || 0),
      currency: project.currency || 'UGX',
      status: project.status || 'active',
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };

    res.status(201).json({
      success: true,
      project: transformedProject,
      message: 'Project created successfully',
    });
  } catch (error) {
    console.error('[Create Project] ❌ Unexpected error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create project',
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// GET /api/projects/:projectId/settings
app.get('/api/projects/:projectId/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    if (!userId || !projectId) {
      return res.status(400).json({ success: false, error: 'Missing projectId' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, description, budget, status, channel_type, created_at')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, whatsapp_number, default_currency, preferred_language')
      .eq('id', userId)
      .single();

    const profileData = profileError ? {} : {
      full_name: profile?.full_name || '',
      whatsapp_number: profile?.whatsapp_number || '',
      default_currency: profile?.default_currency || 'UGX',
      preferred_language: profile?.preferred_language || 'en',
    };

    res.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description || '',
        budget: parseFloat(project.budget || 0),
        status: project.status || 'active',
        channel_type: project.channel_type || 'direct',
        created_at: project.created_at,
      },
      profile: profileData,
    });
  } catch (err) {
    console.error('[Settings GET] Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to load settings' });
  }
});

// PATCH /api/projects/:projectId/settings
app.patch('/api/projects/:projectId/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;
    const { name, description, budget, status, channel_type, whatsapp_number, full_name } = req.body;

    if (!userId || !projectId) {
      return res.status(400).json({ success: false, error: 'Missing projectId' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const projectUpdates = {};
    if (name !== undefined) projectUpdates.name = String(name).trim();
    if (description !== undefined) projectUpdates.description = description?.trim() || null;
    if (budget !== undefined) {
      const b = parseFloat(budget);
      if (!isNaN(b) && b >= 0) projectUpdates.budget = b;
    }
    if (channel_type !== undefined && ['direct', 'group'].includes(String(channel_type))) {
      projectUpdates.channel_type = channel_type;
    }
    if (status !== undefined && ['active', 'completed', 'on_hold', 'paused'].includes(String(status))) {
      projectUpdates.status = status === 'paused' ? 'on_hold' : status;
    }

    if (Object.keys(projectUpdates).length > 0) {
      const { data: updatedProject, error: updateErr } = await supabase
        .from('projects')
        .update({ ...projectUpdates, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateErr) {
        return res.status(500).json({ success: false, error: updateErr.message || 'Failed to update project' });
      }
    }

    const profileUpdates = {};
    if (whatsapp_number !== undefined) profileUpdates.whatsapp_number = String(whatsapp_number).trim();
    if (full_name !== undefined) profileUpdates.full_name = String(full_name).trim();

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ ...profileUpdates, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (profileErr) {
        return res.status(500).json({ success: false, error: profileErr.message || 'Failed to update profile' });
      }
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id, name, description, budget, status, channel_type, created_at, updated_at')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    res.json({
      success: true,
      project: project ? {
        id: project.id,
        name: project.name,
        description: project.description || '',
        budget: parseFloat(project.budget || 0),
        status: project.status || 'active',
        channel_type: project.channel_type || 'direct',
        created_at: project.created_at,
      } : null,
    });
  } catch (err) {
    console.error('[Settings PATCH] Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to save settings' });
  }
});

// ============================================================================
// DASHBOARD ENDPOINTS (always available - BEFORE server app mounts)
// ============================================================================

// GET /api/dashboard/summary
app.get('/api/dashboard/summary', requireAuth, async (req, res) => {
  try {
    const userId = req.userId; // Set by requireAuth middleware
    const dbConnection = initializeDatabase();
    
    if (!dbConnection) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available',
      });
    }

    // Get project ID from query parameter, or use first project
    let activeProjectId = req.query.projectId || req.query.project;
    
    if (!activeProjectId) {
      // Get user's first project if no project ID specified
      const projectsResult = await dbConnection.execute(sql`
        SELECT id FROM projects
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const firstProject = Array.isArray(projectsResult) 
        ? projectsResult[0] 
        : (projectsResult.rows ? projectsResult.rows[0] : projectsResult);
      activeProjectId = firstProject?.id;
    }

    if (!activeProjectId) {
      return res.json({
        success: true,
        summary: {
          overallProgress: 0,
          onTimeStatus: { isDelayed: false, daysDelayed: 0 },
          budgetHealth: { percent: 0, remaining: 0, totalBudget: 0, totalSpent: 0 },
          activeIssues: { total: 0, critical: 0 },
        },
      });
    }

    // Get project details
    const projectResult = await dbConnection.execute(sql`
      SELECT id, name, budget
      FROM projects
      WHERE id = ${activeProjectId} AND user_id = ${userId}
      LIMIT 1
    `);
    const project = Array.isArray(projectResult) ? projectResult[0] : (projectResult.rows ? projectResult.rows[0] : projectResult);

    // Get expenses
    const expensesResult = await dbConnection.execute(sql`
      SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total
      FROM expenses
      WHERE project_id = ${activeProjectId}
    `);
    const totalSpent = parseFloat(Array.isArray(expensesResult) ? expensesResult[0]?.total : (expensesResult.rows ? expensesResult.rows[0]?.total : expensesResult?.total) || '0');

    // Get tasks
    const tasksResult = await dbConnection.execute(sql`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress')) as open,
             COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress') AND priority = 'high') as critical
      FROM tasks
      WHERE project_id = ${activeProjectId}
    `);
    const tasks = Array.isArray(tasksResult) ? tasksResult[0] : (tasksResult.rows ? tasksResult.rows[0] : tasksResult);
    const totalTasks = parseInt(tasks?.total || '0');
    const completedTasks = parseInt(tasks?.total || '0') - parseInt(tasks?.open || '0');
    const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const totalBudget = parseFloat(project?.budget || '0');
    const spentPercent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    res.json({
      success: true,
      summary: {
        overallProgress,
        onTimeStatus: { isDelayed: false, daysDelayed: 0 },
        budgetHealth: {
          percent: spentPercent,
          remaining: totalBudget - totalSpent,
          totalBudget,
          totalSpent,
        },
        activeIssues: {
          total: parseInt(tasks?.open || '0'),
          critical: parseInt(tasks?.critical || '0'),
        },
        projectName: project?.name || 'Unknown Project',
      },
    });
  } catch (error) {
    console.error('[Dashboard Summary] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard summary',
      details: error.message,
    });
  }
});

// GET /api/dashboard/progress
app.get('/api/dashboard/progress', requireAuth, async (req, res) => {
  try {
    const userId = req.userId; // Set by requireAuth middleware
    const dbConnection = initializeDatabase();
    
    if (!dbConnection) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available',
      });
    }

    // Get project ID from query parameter, or use first project
    let activeProjectId = req.query.projectId || req.query.project;
    
    if (!activeProjectId) {
      // Get user's first project if no project ID specified
      const projectsResult = await dbConnection.execute(sql`
        SELECT id FROM projects
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const firstProject = Array.isArray(projectsResult) 
        ? projectsResult[0] 
        : (projectsResult.rows ? projectsResult.rows[0] : projectsResult);
      activeProjectId = firstProject?.id;
    }

    if (!activeProjectId) {
      return res.json({
        success: true,
        phases: [],
        upcomingMilestones: [],
      });
    }

    // Get tasks for milestones
    const tasksResult = await dbConnection.execute(sql`
      SELECT id, title, due_date as "dueDate", priority, status
      FROM tasks
      WHERE project_id = ${activeProjectId}
      ORDER BY due_date ASC
      LIMIT 10
    `);
    const tasks = Array.isArray(tasksResult) ? tasksResult : (tasksResult.rows || []);

    // Define phases (simplified - in real app, these would come from database)
    const phases = [
      { id: '1', name: 'Foundation', percentComplete: 100, status: 'completed' },
      { id: '2', name: 'Framing', percentComplete: 75, status: 'in-progress' },
      { id: '3', name: 'Roofing', percentComplete: 50, status: 'in-progress' },
      { id: '4', name: 'Finishing', percentComplete: 20, status: 'in-progress' },
    ];

    // Get upcoming milestones (tasks due in next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const upcomingMilestones = tasks
      .filter(task => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate > new Date() && dueDate <= sevenDaysFromNow;
      })
      .slice(0, 5)
      .map(task => ({
        id: task.id,
        title: task.title || 'Untitled Task',
        dueDate: task.dueDate,
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
      details: error.message,
    });
  }
});

// GET /api/dashboard/budget
app.get('/api/dashboard/budget', requireAuth, async (req, res) => {
  try {
    const userId = req.userId; // Set by requireAuth middleware
    const dbConnection = initializeDatabase();
    
    if (!dbConnection) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available',
      });
    }

    // Get project ID from query parameter, or use first project
    let activeProjectId = req.query.projectId || req.query.project;
    
    if (!activeProjectId) {
      // Get user's first project if no project ID specified
      const projectsResult = await dbConnection.execute(sql`
        SELECT id FROM projects
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const firstProject = Array.isArray(projectsResult) 
        ? projectsResult[0] 
        : (projectsResult.rows ? projectsResult.rows[0] : projectsResult);
      activeProjectId = firstProject?.id;
    }

    if (!activeProjectId) {
      return res.json({
        success: true,
        breakdown: [],
        vsActual: [],
        cumulativeCosts: [],
        totalBudget: 0,
        spent: 0,
        remaining: 0,
        spentPercent: 0,
      });
    }

    // Get project budget
    const projectResult = await dbConnection.execute(sql`
      SELECT budget
      FROM projects
      WHERE id = ${activeProjectId} AND user_id = ${userId}
      LIMIT 1
    `);
    const project = Array.isArray(projectResult) ? projectResult[0] : (projectResult.rows ? projectResult.rows[0] : projectResult);
    const totalBudget = parseFloat(project?.budget || '0');

    // Get expenses by category
    let expensesResult;
    try {
      expensesResult = await dbConnection.execute(sql`
        SELECT 
          COALESCE(ec.name, 'Uncategorized') as category,
          ec.color as "colorHex",
          COALESCE(SUM(CAST(e.amount AS DECIMAL)), 0) as total
        FROM expenses e
        LEFT JOIN expense_categories ec ON e.category_id = ec.id
        WHERE e.project_id = ${activeProjectId}
        GROUP BY ec.name, ec.color
        ORDER BY total DESC
      `);
    } catch (dbError) {
      console.error('[Dashboard Budget] Database query error:', dbError);
      // Return empty breakdown if query fails
      expensesResult = [];
    }
    const expenses = Array.isArray(expensesResult) ? expensesResult : (expensesResult?.rows || []);
    
    const totalSpent = expenses.reduce((sum, exp) => sum + parseFloat(exp.total || '0'), 0);

    const breakdown = expenses.map(exp => ({
      category: exp.category || 'Uncategorized',
      amount: parseFloat(exp.total || '0'),
      percentage: totalSpent > 0 ? Math.round((parseFloat(exp.total || '0') / totalSpent) * 100) : 0,
      colorHex: exp.colorHex || '#A0AEC0',
    }));

    const vsActual = breakdown.map(cat => ({
      category: cat.category,
      budgeted: cat.amount * 1.2, // Simplified - assume 20% over budget
      actual: cat.amount,
      variance: 20,
    }));

    // Get cumulative costs over time
    let dailyExpensesResult;
    try {
      dailyExpensesResult = await dbConnection.execute(sql`
        SELECT 
          DATE(expense_date) as date,
          SUM(CAST(amount AS DECIMAL)) as daily_total
        FROM expenses
        WHERE project_id = ${activeProjectId}
        GROUP BY DATE(expense_date)
        ORDER BY DATE(expense_date) ASC
      `);
    } catch (dbError) {
      console.error('[Dashboard Budget] Daily expenses query error:', dbError);
      dailyExpensesResult = [];
    }
    const dailyExpenses = Array.isArray(dailyExpensesResult) ? dailyExpensesResult : (dailyExpensesResult?.rows || []);
    
    let cumulative = 0;
    const cumulativeCosts = dailyExpenses.map(exp => {
      cumulative += parseFloat(exp.daily_total || '0');
      return {
        date: exp.date,
        amount: cumulative,
      };
    });

    res.json({
      success: true,
      breakdown,
      vsActual,
      cumulativeCosts,
      totalBudget,
      spent: totalSpent,
      remaining: totalBudget - totalSpent,
      spentPercent: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
    });
  } catch (error) {
    console.error('[Dashboard Budget] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch budget data',
      details: error.message,
    });
  }
});

// GET /api/dashboard/inventory
app.get('/api/dashboard/inventory', requireAuth, async (req, res) => {
  try {
    // Return hardcoded inventory data (no inventory table exists yet)
    const items = [
      { id: '1', name: 'Cement', unit: 'bags', currentStock: 150, totalStock: 500, stockPercent: 30, consumptionVsEstimate: 10 },
      { id: '2', name: 'Sand', unit: 'tons', currentStock: 50, totalStock: 100, stockPercent: 50, consumptionVsEstimate: -5 },
      { id: '3', name: 'Bricks', unit: 'pieces', currentStock: 1000, totalStock: 5000, stockPercent: 20, consumptionVsEstimate: 0 },
      { id: '4', name: 'Steel Bars', unit: 'kg', currentStock: 500, totalStock: 2000, stockPercent: 25, consumptionVsEstimate: 15 },
    ];

    const usage = [
      { material: 'Cement', used: 350, remaining: 150 },
      { material: 'Sand', used: 50, remaining: 50 },
      { material: 'Bricks', used: 4000, remaining: 1000 },
      { material: 'Steel', used: 1500, remaining: 500 },
    ];

    res.json({
      success: true,
      items,
      usage,
    });
  } catch (error) {
    console.error('[Dashboard Inventory] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory data',
      details: error.message,
    });
  }
});

// GET /api/dashboard/issues
app.get('/api/dashboard/issues', requireAuth, async (req, res) => {
  try {
    const userId = req.userId; // Set by requireAuth middleware
    const dbConnection = initializeDatabase();
    
    if (!dbConnection) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available',
      });
    }

    // Get project ID from query parameter, or use first project
    let activeProjectId = req.query.projectId || req.query.project;
    
    if (!activeProjectId) {
      // Get user's first project if no project ID specified
      const projectsResult = await dbConnection.execute(sql`
        SELECT id FROM projects
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const firstProject = Array.isArray(projectsResult) 
        ? projectsResult[0] 
        : (projectsResult.rows ? projectsResult.rows[0] : projectsResult);
      activeProjectId = firstProject?.id;
    }

    if (!activeProjectId) {
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
      });
    }

    // Get tasks as issues
    const tasksResult = await dbConnection.execute(sql`
      SELECT id, title, description, status, priority, created_at as "createdAt"
      FROM tasks
      WHERE project_id = ${activeProjectId}
      ORDER BY created_at DESC
    `);
    const tasks = Array.isArray(tasksResult) ? tasksResult : (tasksResult.rows || []);

    const todo = tasks.filter(t => t.status === 'pending').map(t => ({
      id: t.id,
      title: t.title || 'Untitled',
      description: t.description || '',
      status: 'todo',
      priority: t.priority || 'medium',
      reportedBy: 'System',
      reportedDate: new Date(t.createdAt),
      type: 'General',
    }));

    const inProgress = tasks.filter(t => t.status === 'in_progress').map(t => ({
      id: t.id,
      title: t.title || 'Untitled',
      description: t.description || '',
      status: 'inProgress',
      priority: t.priority || 'medium',
      reportedBy: 'System',
      reportedDate: new Date(t.createdAt),
      type: 'General',
    }));

    const resolved = tasks.filter(t => t.status === 'completed').map(t => ({
      id: t.id,
      title: t.title || 'Untitled',
      description: t.description || '',
      status: 'resolved',
      priority: t.priority || 'medium',
      reportedBy: 'System',
      reportedDate: new Date(t.createdAt),
      type: 'General',
    }));

    const criticalIssues = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;
    const highIssues = tasks.filter(t => t.priority === 'medium' && t.status !== 'completed').length;
    const openIssues = todo.length + inProgress.length;

    // Get resolved this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const resolvedThisWeek = resolved.filter(r => new Date(r.reportedDate) >= weekAgo).length;

    const types = [
      { type: 'Design', count: 2, percentage: 25 },
      { type: 'Safety', count: 3, percentage: 37.5 },
      { type: 'Quality', count: 2, percentage: 25 },
      { type: 'Logistics', count: 1, percentage: 12.5 },
    ];

    res.json({
      success: true,
      todo,
      inProgress,
      resolved,
      criticalIssues,
      highIssues,
      openIssues,
      resolvedThisWeek,
      types,
    });
  } catch (error) {
    console.error('[Dashboard Issues] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch issues data',
      details: error.message,
    });
  }
});

// GET /api/dashboard/media
app.get('/api/dashboard/media', requireAuth, async (req, res) => {
  try {
    const userId = req.userId; // Set by requireAuth middleware
    const dbConnection = initializeDatabase();
    
    if (!dbConnection) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available',
      });
    }

    // Get project ID from query parameter, or use first project
    let activeProjectId = req.query.projectId || req.query.project;
    
    if (!activeProjectId) {
      // Get user's first project if no project ID specified
      const projectsResult = await dbConnection.execute(sql`
        SELECT id FROM projects
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const firstProject = Array.isArray(projectsResult) 
        ? projectsResult[0] 
        : (projectsResult.rows ? projectsResult.rows[0] : projectsResult);
      activeProjectId = firstProject?.id;
    }

    if (!activeProjectId) {
      return res.json({
        success: true,
        recentPhotos: [],
        stats: {
          dailyLogsThisWeek: 0,
          siteCondition: 'Good',
        },
      });
    }

    // Get recent photos
    // Note: images table may not have caption column, use filename as description
    let photosResult;
    try {
      photosResult = await dbConnection.execute(sql`
        SELECT id, storage_path as "storagePath", filename, created_at as "createdAt"
        FROM images
        WHERE project_id = ${activeProjectId}
        ORDER BY created_at DESC
        LIMIT 10
      `);
    } catch (dbError) {
      console.error('[Dashboard Media] Database query error:', dbError);
      // Return empty photos if query fails
      photosResult = [];
    }
    const photos = Array.isArray(photosResult) ? photosResult : (photosResult?.rows || []);

    const recentPhotos = photos.map(photo => ({
      id: photo.id,
      url: photo.storagePath || '',
      description: photo.filename || 'Site photo',
      date: photo.createdAt,
    }));

    res.json({
      success: true,
      recentPhotos,
      stats: {
        dailyLogsThisWeek: 5,
        siteCondition: 'Good',
      },
    });
  } catch (error) {
    console.error('[Dashboard Media] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch media data',
      details: error.message,
    });
  }
});

// GET /api/dashboard/trends
app.get('/api/dashboard/trends', requireAuth, async (req, res) => {
  try {
    // Generate trend data
    const progressTrend = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: date.toISOString().split('T')[0],
        value: 20 + i * 0.8 + Math.random() * 5,
      };
    });

    const costBurnTrend = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: date.toISOString().split('T')[0],
        value: 50000 + Math.random() * 20000,
      };
    });

    const insights = [
      { id: '1', text: 'Top delay cause: Weather (3 days lost)' },
      { id: '2', text: 'Most used material: Cement (450 bags)' },
      { id: '3', text: 'Foundation phase completed ahead of schedule' },
      { id: '4', text: 'Resolution rate: 85% of issues closed' },
    ];

    res.json({
      success: true,
      progressTrend,
      costBurnTrend,
      dailyBurnRate: 125000,
      insights,
    });
  } catch (error) {
    console.error('[Dashboard Trends] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trends data',
      details: error.message,
    });
  }
});

// Images Endpoint (always available - BEFORE server app mounts)
app.get('/api/images', requireAuth, async (req, res) => {
  try {
    const userId = req.userId; // Set by requireAuth middleware
    
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const expenseId = req.query.expense_id;
    
    res.json({
      success: true,
      images: [],
      pagination: {
        total: 0,
        limit,
        offset,
        hasMore: false
      },
      message: 'Images endpoint reached (fallback mode - no images available)',
      filters: {
        expenseId: expenseId || null
      }
    });
  } catch (error) {
    console.error('[Images] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test Project Creation Setup
app.get('/api/test/project-creation', async (req, res) => {
  try {
    // Try to extract token if present (optional auth for test endpoint)
    const token = extractToken(req);
    const userId = token ? (verifyToken(token)?.userId || null) : null;
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const checks = {
      authenticated: !!userId,
      userId: userId || null,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      supabaseClient: null,
      tableExists: false,
      canInsert: false,
      rlsEnabled: false,
      error: null,
    };

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.json({
        success: false,
        message: 'Missing Supabase credentials',
        checks,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    checks.supabaseClient = 'initialized';

    // Check if projects table exists and get its structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('projects')
      .select('id')
      .limit(0);

    if (tableError) {
      checks.error = {
        message: tableError.message,
        code: tableError.code,
        details: tableError.details,
        hint: tableError.hint,
      };
      
      // Check if it's an RLS issue
      if (tableError.code === '42501' || tableError.message?.includes('permission')) {
        checks.rlsEnabled = true;
        checks.error.rlsIssue = true;
      }
    } else {
      checks.tableExists = true;
    }

    // Try a test insert (will be rolled back)
    if (userId && checks.tableExists) {
      const testData = {
        user_id: userId,
        name: 'TEST_PROJECT_DELETE_ME',
        description: 'This is a test project - should be deleted',
        budget: 1,
        currency: 'UGX',
        status: 'active',
        spent: 0,
      };

      const { data: testProject, error: insertError } = await supabase
        .from('projects')
        .insert([testData])
        .select()
        .single();

      if (insertError) {
        checks.error = {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
        };
      } else {
        checks.canInsert = true;
        
        // Clean up test project
        await supabase
          .from('projects')
          .delete()
          .eq('id', testProject.id);
      }
    }

    res.json({
      success: checks.canInsert && checks.tableExists,
      message: checks.canInsert 
        ? 'Project creation should work!' 
        : 'Project creation may fail - see checks below',
      checks,
      recommendations: !checks.authenticated 
        ? ['User is not authenticated - please log in']
        : !checks.hasSupabaseUrl || !checks.hasServiceKey
        ? ['Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables']
        : !checks.tableExists
        ? ['Projects table does not exist - run migrations/create-schema.sql']
        : checks.error?.rlsIssue
        ? ['RLS is blocking inserts - check RLS policies in Supabase']
        : !checks.canInsert
        ? [`Cannot insert projects: ${checks.error?.message || 'Unknown error'}`]
        : ['Everything looks good!'],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Test Supabase and Database connection
app.get('/api/test/supabase', async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        status: 'error',
        message: 'Missing Supabase environment variables',
        env: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
        }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test profiles table
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, whatsapp_number, full_name')
      .limit(5);

    // Test projects table
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, user_id, budget')
      .limit(5);

    // Test expenses table
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('id, description, amount, user_id')
      .limit(5);

    // Test tasks table
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, status, user_id')
      .limit(5);

    // Test Drizzle database connection
    let drizzleTest = { connected: false, error: null, method: null };
    try {
      // Initialize database connection directly (no need to import from dist/server)
      const dbConnection = initializeDatabase();
      
      if (!dbConnection) {
        throw new Error('Database connection not initialized - DATABASE_URL may be missing');
      }
      
      drizzleTest.method = 'direct_connection';
      await dbConnection.execute(sql`SELECT 1`);
      drizzleTest.connected = true;
    } catch (dbError) {
      drizzleTest.error = dbError.message;
      drizzleTest.stack = process.env.NODE_ENV === 'development' ? dbError.stack : undefined;
    }

    res.json({
      status: 'ok',
      connection: 'successful',
      supabase: {
        url: supabaseUrl.substring(0, 30) + '...',
        hasKey: !!supabaseKey,
      },
      data: {
        profiles: { 
          count: profiles?.length || 0, 
          error: profilesError?.message || null, 
          sample: profiles?.slice(0, 2) || []
        },
        projects: { 
          count: projects?.length || 0, 
          error: projectsError?.message || null, 
          sample: projects?.slice(0, 2) || []
        },
        expenses: { 
          count: expenses?.length || 0, 
          error: expensesError?.message || null, 
          sample: expenses?.slice(0, 2) || []
        },
        tasks: { 
          count: tasks?.length || 0, 
          error: tasksError?.message || null, 
          sample: tasks?.slice(0, 2) || []
        },
      },
      drizzle: drizzleTest,
    });
  } catch (error) {
    console.error('[Test Supabase] Error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================================================
// FALLBACK ROUTES (non-auth debug etc.)
// ============================================================================

  app.get('/api/debug/db', async (req, res) => {
    res.json({
      status: 'ok',
      message: 'Debug endpoint (fallback mode)',
      database: {
        url: process.env.DATABASE_URL ? 'configured' : 'not configured'
      }
    });
  });

// ============================================================================
// STATIC FILES
// ============================================================================

const publicPath = join(__dirname, '..', 'dist', 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  console.log(`✅ Serving static files from ${publicPath}`);
} else {
  console.warn(`⚠️ Public directory not found at ${publicPath}`);
}

// ============================================================================
// SPA CATCH-ALL
// ============================================================================

// Catch-all route for SPA (GET requests only)
// POST requests should be handled by specific routes above
// Catch-all route for SPA (GET requests only)
// IMPORTANT: This must come AFTER all other routes including server app
app.get('*', (req, res) => {
  // Don't serve index.html for API routes or webhook routes
  // This only affects GET requests, POST requests are handled by routes above
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  const indexPath = join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not found - index.html missing');
  }
});

// ============================================================================
// ERROR HANDLER
// ============================================================================

app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({ 
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Export for Vercel
export default app;

