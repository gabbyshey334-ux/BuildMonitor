/**
 * Vercel Serverless Function Entry Point
 * 
 * This is the main entry point for Vercel serverless functions.
 * It imports and uses the compiled Express app from dist/server/index.js
 */

import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Trust proxy for Vercel
app.set('trust proxy', 1);

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
// IMPORT COMPILED ROUTES
// ============================================================================

// Try to import the compiled Express app from dist/server/index.js
// If it fails, we'll use basic routes
let serverApp = null;
try {
  // Import the compiled server
  const serverPath = join(__dirname, '..', 'dist', 'server', 'index.js');
  if (fs.existsSync(serverPath)) {
    // Use dynamic import with proper path resolution
    const serverModule = await import(serverPath);
    serverApp = serverModule.default;
    
    // If the server exports an Express app, use it
    if (serverApp && typeof serverApp === 'function') {
      // The server app is already a complete Express app with all routes
      // Mount it to handle all routes
      console.log('✅ Loaded compiled Express app from dist/server/index.js');
      
      // Use the server app's routes by mounting it
      // This will handle all routes including /api, /webhook, etc.
      app.use('/', serverApp);
    } else {
      console.warn('⚠️ Server module does not export an Express app');
      console.warn('   Type:', typeof serverApp);
    }
  } else {
    console.warn(`⚠️ Server file not found at ${serverPath}`);
    console.warn(`   Current directory: ${__dirname}`);
    console.warn(`   Looking for: ${serverPath}`);
  }
} catch (error) {
  console.error('❌ Error loading compiled server:', error);
  console.error('   Error details:', error.message);
  if (error.stack) {
    console.error('   Stack:', error.stack);
  }
  console.log('📝 Falling back to basic routes');
}

// ============================================================================
// TEST ENDPOINTS (available even when server app is loaded)
// ============================================================================

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
      .select('id, name, user_id, budget_amount')
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
    let drizzleTest = { connected: false, error: null };
    try {
      const { db } = await import('../dist/server/db.js');
      const { sql } = await import('drizzle-orm');
      await db.execute(sql`SELECT 1`);
      drizzleTest.connected = true;
    } catch (dbError) {
      drizzleTest.error = dbError.message;
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
// FALLBACK ROUTES (if compiled server not available)
// ============================================================================

if (!serverApp) {
  // Basic auth routes for testing
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log('[Login] Attempt:', { email });
      
      res.json({ 
        success: true, 
        user: { email },
        message: 'Login endpoint reached (fallback mode)'
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Login failed', 
        details: error.message 
      });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    res.json({ 
      user: null, 
      authenticated: false,
      message: 'Auth endpoint reached (fallback mode)'
    });
  });

  app.get('/api/debug/db', async (req, res) => {
    res.json({
      status: 'ok',
      message: 'Debug endpoint (fallback mode)',
      database: {
        url: process.env.DATABASE_URL ? 'configured' : 'not configured'
      }
    });
  });
}

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

app.get('*', (req, res) => {
  // Don't serve index.html for API routes
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

