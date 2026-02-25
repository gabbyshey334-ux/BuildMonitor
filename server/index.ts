import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
// import { registerRoutes } from "./routes"; // Legacy routes - commented out for now
// Vite imports are conditional - only needed in development
// import { setupVite, serveStatic, log } from "./vite";
import whatsappRouter from "./routes/whatsapp.js";
import apiRouter from "./routes/api.js";

// Production environment validation
function validateProductionEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    const requiredVars = [
      'DATABASE_URL',
      'SESSION_SECRET',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_WHATSAPP_NUMBER',
    ];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables for production:');
      missingVars.forEach(varName => console.error(`   - ${varName}`));
      console.error('\n💡 See .env.example for all required variables');
      process.exit(1);
    }
    
    console.log('✅ Production environment validation passed');
  }
}

// Validate environment before starting the server
validateProductionEnvironment();

const app = express();

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// CORS - must allow credentials so session cookies are sent (first, before session)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = origin || process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? 'https://build-monitor-lac.vercel.app' : 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Cookie');
  res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Trust proxy for secure cookies behind reverse proxy
app.set("trust proxy", 1);

// Session configuration
const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week

// Use PostgreSQL session store
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
      throw new Error('SESSION_SECRET must be set in production environment');
    }
    console.warn('⚠️  Using default SESSION_SECRET in development. Set SESSION_SECRET environment variable for production.');
    return 'jengatrack-dev-secret-' + Date.now();
  })(),
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionTtl,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: process.env.COOKIE_DOMAIN,
  },
  name: 'jengatrack.sid', // Custom session cookie name
}));

// Extend session types
declare module 'express-session' {
  interface SessionData {
    userId: string;
    whatsappNumber: string;
  }
}

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") || path.startsWith("/webhook")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

// ============================================================================
// ROUTE MOUNTING
// ============================================================================

// Health check endpoint (no auth required)
app.get('/health', async (req: Request, res: Response) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: 'unknown',
      connected: false,
    },
    services: {
      twilio: process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'not configured',
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
      supabase: process.env.SUPABASE_URL ? 'configured' : 'not configured',
    },
  };

  try {
    // Test database connection
    const { db } = await import('./db.js');
    const { sql } = await import('drizzle-orm');
    
    await db.execute(sql`SELECT 1`);
    
    healthCheck.database = {
      status: 'connected',
      connected: true,
    };
    healthCheck.status = 'ok';
    
    res.status(200).json(healthCheck);
  } catch (error: any) {
    console.error('[Health Check] Database connection failed:', error);
    
    healthCheck.database = {
      status: 'disconnected',
      connected: false,
    };
    healthCheck.status = 'degraded';
    
    res.status(503).json(healthCheck);
  }
});

// Mount new API routes (authentication, expenses, tasks, dashboard)
app.use('/api', apiRouter);

// Mount WhatsApp webhook routes
app.use('/webhook', whatsappRouter);

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error('[Error Handler]', err);
  res.status(status).json({ 
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ============================================================================
// VITE SETUP (Development) / Static Serving (Production)
// ============================================================================

// ============================================================================
// VITE SETUP (Development) / Static Serving (Production)
// ============================================================================

// Only start server if not in Vercel serverless environment
// In Vercel, the app is exported and used by api/index.js
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  (async () => {
    if (app.get("env") === "development") {
      // setupVite requires a Server instance, but in production this won't run
      // Type assertion is safe here since this code path is dev-only
      const { setupVite } = await import('./vite.js');
      const http = await import("http");
      const server = http.createServer(app);
      await setupVite(app, server);
    } else {
      const { serveStatic } = await import('./static.js');
      serveStatic(app);
    }

    // ============================================================================
    // SERVER START
    // ============================================================================

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // This serves both the API and the client.
    const port = parseInt(process.env.PORT || '5000', 10);
    const { log } = await import('./vite.js');
    app.listen(port, "0.0.0.0", () => {
      log(`🚀 JengaTrack server running on port ${port}`);
      log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      log(`🔐 Session store: PostgreSQL`);
      log(`💬 WhatsApp webhook: /webhook/webhook`);
      log(`🌐 API endpoint: /api`);
      log(`\n✅ Environment Variables Check:`);
      log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ NOT SET'}`);
      log(`   SESSION_SECRET: ${process.env.SESSION_SECRET ? '✅ Set' : '❌ NOT SET'}`);
      log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ NOT SET'}`);
      log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ NOT SET'}`);
      log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ NOT SET'}`);
      if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
        log(`\n⚠️  WARNING: SESSION_SECRET is required in production!`);
      }
    });
  })();
}

// ============================================================================
// EXPORT FOR VERCEL
// ============================================================================

// Export the Express app for Vercel serverless functions
// This allows api/index.js to import and use the app
export default app;
