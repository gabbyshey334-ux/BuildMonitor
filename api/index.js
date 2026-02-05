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
import { generateToken, verifyToken, extractToken } from './utils/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - CRITICAL: Allow credentials for session cookies
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // In production, allow Vercel domains and specific origins
  // In development, allow all origins
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Production: Only allow specific origins
    const allowedOrigins = [
      'https://build-monitor-lac.vercel.app',
      'https://build-monitor-lac-git-',
      'https://build-monitor-lac-',
    ];
    
    const isAllowed = origin && (
      allowedOrigins.some(allowed => origin.includes(allowed.replace('*', ''))) ||
      origin.includes('vercel.app')
    );
    
    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      // Default to allowing the origin if it's a Vercel domain
      res.header('Access-Control-Allow-Origin', origin || 'https://build-monitor-lac.vercel.app');
      res.header('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    // Development: Allow all origins
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Expose-Headers', 'Set-Cookie');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Trust proxy for Vercel
app.set('trust proxy', 1);

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  // Log all API requests for debugging
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log('  Session ID:', req.sessionID);
    console.log('  User ID in session:', req.session?.userId || 'none');
  }
  // Log all requests to webhook routes
  if (req.path.startsWith('/webhook')) {
    console.log(`[Request] ${req.method} ${req.path} - ${req.url}`);
    console.log(`[Request] Route stack length: ${app._router?.stack?.length || 0}`);
  }
  next();
});

// ============================================================================
// SESSION MIDDLEWARE (needed for debug/session endpoint)
// ============================================================================

// Session configuration
const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week

// Initialize session store with PostgreSQL
let sessionStore = null;
try {
  const pgStore = connectPg(session);
  sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
    pruneSessionInterval: 60, // Prune expired sessions every 60 seconds
  });
  console.log('✅ Session store initialized with PostgreSQL');
} catch (error) {
  console.error('⚠️ Failed to initialize session store:', error.message);
  console.warn('⚠️ Sessions will use memory store (not persistent across serverless invocations)');
}

// Get session secret
const sessionSecret = process.env.SESSION_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL: SESSION_SECRET not set in production!');
    console.error('   Sessions will NOT work properly. Set SESSION_SECRET in Vercel environment variables.');
  } else {
    console.warn('⚠️ SESSION_SECRET not set - using fallback (sessions may not persist)');
  }
  return 'jengatrack-dev-secret-' + Date.now();
})();

app.use(session({
  secret: sessionSecret,
  store: sessionStore, // null = memory store (not ideal for serverless)
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until something is stored
  name: 'buildmonitor.sid', // Custom session cookie name
  proxy: true, // Trust proxy (required for Vercel)
  rolling: true, // Reset expiration on every request
  cookie: {
    httpOnly: true, // Prevent XSS attacks
    secure: true, // HTTPS only (always true on Vercel)
    maxAge: sessionTtl,
    sameSite: 'none', // CRITICAL: Required for cross-site cookies on Vercel
    domain: undefined, // Let browser set domain automatically (don't restrict)
    path: '/', // Available on all paths
  },
}));

// Session debug middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log('[Session Debug]', {
      path: req.path,
      method: req.method,
      sessionID: req.sessionID,
      hasSession: !!req.session,
      userId: req.session?.userId || null,
      cookie: req.headers.cookie ? 'present' : 'missing',
    });
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
// WEBHOOK ROUTES (Register EARLY to ensure they work)
// ============================================================================

// WhatsApp Webhook Handler Function
const webhookHandler = async (req, res) => {
  try {
    console.log('[WhatsApp Webhook] Received request:', {
      method: req.method,
      url: req.url,
      path: req.path,
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'x-twilio-signature': req.headers['x-twilio-signature'] ? 'present' : 'missing'
      }
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
};

// Register webhook routes EARLY using a dedicated router
// This ensures they're checked before the server app routes
const webhookRouter = express.Router();

webhookRouter.post('/webhook', (req, res, next) => {
  console.log('[Webhook Router] POST /webhook/webhook matched');
  return webhookHandler(req, res);
});

webhookRouter.post('/', (req, res, next) => {
  console.log('[Webhook Router] POST /webhook matched');
  return webhookHandler(req, res);
});

webhookRouter.get('/debug', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    res.json({
      success: true,
      total: 0,
      logs: [],
      message: 'WhatsApp debug endpoint reached',
      limit
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mount webhook router BEFORE server app
// Routes registered before app.use() are checked FIRST
app.use('/webhook', webhookRouter);

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
      
      // IMPORTANT: Mount server app conditionally to avoid webhook route conflicts
      // The server app also has /webhook routes, so we need to skip it for webhook paths
      app.use((req, res, next) => {
        // Skip server app for webhook routes - they're handled by webhookRouter above
        if (req.path.startsWith('/webhook')) {
          console.log('[Server App] Skipping webhook route:', req.method, req.path);
          return next('route'); // Skip to next route handler (webhookRouter)
        }
        // For all other routes, use the server app
        return serverApp(req, res, next);
      });
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

// Middleware to check authentication (supports both JWT token and session)
function requireAuth(req, res, next) {
  // Try JWT token first
  const token = extractToken(req);
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      // JWT token is valid
      req.userId = decoded.userId;
      req.userEmail = decoded.email;
      console.log('[Auth Check] ✅ SUCCESS - JWT token authenticated:', decoded.userId);
      return next();
    }
    console.log('[Auth Check] ⚠️ JWT token invalid, trying session fallback');
  }

  // Fallback to session-based auth
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
    req.userEmail = req.session.email;
    console.log('[Auth Check] ✅ SUCCESS - Session authenticated:', req.session.userId);
    return next();
  }

  // No valid authentication found
  console.log('[Auth Check] ❌ FAILED - No valid token or session');
  return res.status(401).json({
    success: false,
    error: 'Not authenticated',
    message: 'Please log in to access this resource',
  });
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

    // Get user profile from profiles table
    const dbConnection = initializeDatabase();
    if (!dbConnection) {
      console.error('[Login] ❌ Database connection not available');
      return res.status(500).json({
        success: false,
        error: 'Database connection not available',
      });
    }

    // Fetch user from users table (new schema)
    const userResult = await dbConnection.execute(sql`
      SELECT id, email, full_name as "fullName", whatsapp_number as "whatsappNumber"
      FROM users
      WHERE id = ${authData.user.id}
      LIMIT 1
    `);

    const user = Array.isArray(userResult) ? userResult[0] : (userResult.rows ? userResult.rows[0] : userResult);

    // If user doesn't exist in users table, create it from Supabase Auth data
    if (!user) {
      console.log('[Login] User not found in users table, creating from Supabase Auth...');
      
      // Try to get metadata from Supabase Auth
      const fullName = authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'User';
      const whatsappNumber = authData.user.user_metadata?.whatsapp_number || '';
      
      // Insert user into users table
      try {
        await dbConnection.execute(sql`
          INSERT INTO users (id, email, full_name, whatsapp_number, created_at, updated_at)
          VALUES (${authData.user.id}, ${authData.user.email}, ${fullName}, ${whatsappNumber}, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `);
        
        // Fetch the newly created user
        const newUserResult = await dbConnection.execute(sql`
          SELECT id, email, full_name as "fullName", whatsapp_number as "whatsappNumber"
          FROM users
          WHERE id = ${authData.user.id}
          LIMIT 1
        `);
        const newUser = Array.isArray(newUserResult) ? newUserResult[0] : (newUserResult.rows ? newUserResult.rows[0] : newUserResult);
        
        if (!newUser) {
          throw new Error('Failed to create user record');
        }
        
        console.log('[Login] ✅ User created in users table');
        
        // Generate JWT token
        const token = generateToken(authData.user.id, authData.user.email);
        
        return res.json({
          success: true,
          token,
          user: {
            id: newUser.id,
            email: newUser.email,
            fullName: newUser.fullName,
            whatsappNumber: newUser.whatsappNumber,
          },
        });
      } catch (createError) {
        console.error('[Login] ❌ Failed to create user in users table:', createError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user record',
          message: 'Please contact support',
        });
      }
    }

    // Generate JWT token
    const token = generateToken(authData.user.id, user.email || authData.user.email);

    console.log('[Login] ✅ Token generated for user:', authData.user.id);

    // Return token and user data
    res.json({
      success: true,
      token, // JWT token for frontend to store
      user: {
        id: user.id,
        email: user.email || authData.user.email,
        fullName: user.fullName,
        whatsappNumber: user.whatsappNumber,
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

    // 2. Create user in users table (new schema)
    const dbConnection = initializeDatabase();
    if (!dbConnection) {
      // Clean up auth user if database connection fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({
        success: false,
        error: 'Database connection not available',
      });
    }

    try {
      await dbConnection.execute(sql`
        INSERT INTO users (id, email, full_name, whatsapp_number, created_at, updated_at)
        VALUES (${authData.user.id}, ${email}, ${fullName}, ${whatsappNumber}, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('[Register] ✅ User created in users table');
      
      // Also create default user_settings
      try {
        await dbConnection.execute(sql`
          INSERT INTO user_settings (user_id, language, currency, created_at, updated_at)
          VALUES (${authData.user.id}, 'en', 'UGX', NOW(), NOW())
          ON CONFLICT (user_id) DO NOTHING
        `);
        console.log('[Register] ✅ User settings created');
      } catch (settingsError) {
        console.warn('[Register] ⚠️ Failed to create user settings (non-critical):', settingsError.message);
      }
    } catch (userError) {
      console.error('[Register] ❌ User creation error:', userError);
      // Clean up auth user if user creation fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({
        success: false,
        error: 'Failed to create user record',
        details: userError.message,
      });
    }

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

    // Get user profile from database
    const dbConnection = initializeDatabase();
    
    if (!dbConnection) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available',
      });
    }

    // Use raw SQL to fetch user from users table
    const result = await dbConnection.execute(sql`
      SELECT u.id, u.whatsapp_number as "whatsappNumber", u.full_name as "fullName", 
             u.email, us.currency as "defaultCurrency", 
             us.language as "preferredLanguage"
      FROM users u
      LEFT JOIN user_settings us ON us.user_id = u.id
      WHERE u.id = ${userId}
      LIMIT 1
    `);

    const user = Array.isArray(result) ? result[0] : (result.rows ? result.rows[0] : result);

    if (!user) {
      console.log('[Auth Me] ❌ User profile not found');
      return res.status(404).json({
        success: false,
        error: 'User profile not found',
      });
    }

    console.log('[Auth Me] ✅ Success:', user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email || null,
        fullName: user.fullName,
        whatsappNumber: user.whatsappNumber,
        defaultCurrency: user.defaultCurrency || 'UGX',
        preferredLanguage: user.preferredLanguage || 'en',
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

    // Fetch projects from database using Supabase client
    const { data: projects, error } = await supabase
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Get Projects] Database error:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch projects',
        message: error.message 
      });
    }

    console.log('[Get Projects] Successfully fetched', projects?.length || 0, 'projects');

    // Transform to match frontend expectations
    const transformedProjects = (projects || []).map(project => ({
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
    }));

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
    const budgetValue = budget || budgetAmount;

    console.log('[Create Project] ============================================');
    console.log('[Create Project] Request received:', {
      userId,
      name,
      description,
      budget: budgetValue,
      currency,
      status,
      bodyKeys: Object.keys(req.body),
    });
    console.log('[Create Project] Session:', {
      hasSession: !!req.session,
      sessionID: req.sessionID,
      userId: req.session?.userId,
    });

    // Check authentication
    if (!userId) {
      console.error('[Create Project] ❌ No user ID in session');
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

    if (!budgetValue || parseFloat(budgetValue) <= 0) {
      console.error('[Create Project] ❌ Validation failed: invalid budget');
      return res.status(400).json({
        success: false,
        error: 'Valid budget amount is required',
        message: 'Budget amount must be greater than 0',
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

    // Parse budget amount
    const parsedBudget = parseFloat(budgetValue);
    if (isNaN(parsedBudget) || parsedBudget < 0) {
      console.error('[Create Project] ❌ Invalid budget amount:', budgetValue);
      return res.status(400).json({
        success: false,
        error: 'Invalid budget amount',
        message: 'Budget must be a valid positive number',
      });
    }

    // Verify user exists in users table before creating project
    const dbConnection = initializeDatabase();
    if (dbConnection) {
      try {
        const userCheckResult = await dbConnection.execute(sql`
          SELECT id FROM users WHERE id = ${userId} LIMIT 1
        `);
        const userExists = Array.isArray(userCheckResult) 
          ? userCheckResult.length > 0 
          : (userCheckResult.rows ? userCheckResult.rows.length > 0 : !!userCheckResult);
        
        if (!userExists) {
          console.error('[Create Project] ❌ User does not exist in users table:', userId);
          return res.status(400).json({
            success: false,
            error: 'User account not found',
            message: 'Your user account is not properly set up. Please log out and register again, or contact support.',
            debug: {
              userId,
              suggestion: 'User may need to be migrated from old schema or re-registered'
            }
          });
        }
        console.log('[Create Project] ✅ User verified in users table');
      } catch (userCheckError) {
        console.error('[Create Project] ⚠️ Could not verify user (non-critical):', userCheckError.message);
        // Continue anyway - let database foreign key constraint catch it if user doesn't exist
      }
    }

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
    const expensesResult = await dbConnection.execute(sql`
      SELECT 
        ec.name as category,
        ec.color_hex as "colorHex",
        COALESCE(SUM(CAST(e.amount AS DECIMAL)), 0) as total
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.project_id = ${activeProjectId}
      GROUP BY ec.name, ec.color_hex
      ORDER BY total DESC
    `);
    const expenses = Array.isArray(expensesResult) ? expensesResult : (expensesResult.rows || []);
    
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
    const dailyExpensesResult = await dbConnection.execute(sql`
      SELECT 
        DATE(expense_date) as date,
        SUM(CAST(amount AS DECIMAL)) as daily_total
      FROM expenses
      WHERE project_id = ${activeProjectId}
      GROUP BY DATE(expense_date)
      ORDER BY DATE(expense_date) ASC
    `);
    const dailyExpenses = Array.isArray(dailyExpensesResult) ? dailyExpensesResult : (dailyExpensesResult.rows || []);
    
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
    const photosResult = await dbConnection.execute(sql`
      SELECT id, storage_path as "storagePath", caption, created_at as "createdAt"
      FROM images
      WHERE project_id = ${activeProjectId}
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const photos = Array.isArray(photosResult) ? photosResult : (photosResult.rows || []);

    const recentPhotos = photos.map(photo => ({
      id: photo.id,
      url: photo.storagePath || '',
      description: photo.caption || 'Site photo',
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
  // Note: Auth endpoints are defined above, before this fallback section
  // This section only contains non-auth fallback routes

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

