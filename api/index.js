/**
 * Vercel Serverless Function Entry Point
 * 
 * This is the main entry point for Vercel serverless functions.
 * It imports and uses the compiled Express app from dist/server/index.js
 */

import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

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
// SESSION MIDDLEWARE (needed for debug/session endpoint)
// ============================================================================

// Session configuration
const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const pgStore = connectPg(session);
const sessionStore = new pgStore({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: true,
  ttl: sessionTtl,
  tableName: "sessions",
});

app.use(session({
  secret: process.env.SESSION_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ SESSION_SECRET not set - sessions may not work properly');
    }
    return 'jengatrack-dev-secret-' + Date.now();
  })(),
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionTtl,
    sameSite: 'lax',
  },
  name: 'jengatrack.sid',
}));

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

// Debug Session Endpoint (always available)
app.get('/api/debug/session', async (req, res) => {
  try {
    res.json({
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
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Session check failed',
      details: error.message
    });
  }
});

// WhatsApp Webhook Endpoint (always available)
app.post('/webhook/webhook', async (req, res) => {
  try {
    console.log('[WhatsApp Webhook] Received request:', {
      method: req.method,
      body: req.body,
      headers: req.headers
    });
    
    // Basic response for testing
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>✅ Webhook endpoint reached. Message received: ${req.body?.Body || 'No body'}</Message>
</Response>`);
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed',
      details: error.message
    });
  }
});

// WhatsApp Debug Endpoint (always available)
app.get('/webhook/debug', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    res.json({
      success: true,
      total: 0,
      logs: [],
      message: 'WhatsApp debug endpoint reached (fallback mode - logs not available)',
      limit
    });
  } catch (error) {
    console.error('[WhatsApp Debug] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Images Endpoint (always available, requires auth)
app.get('/api/images', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    res.json({
      success: true,
      images: [],
      pagination: {
        total: 0,
        limit,
        offset,
        hasMore: false
      },
      message: 'Images endpoint reached (fallback mode - no images available)'
    });
  } catch (error) {
    console.error('[Images] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
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

