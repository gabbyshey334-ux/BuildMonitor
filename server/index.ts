import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
// import { registerRoutes } from "./routes"; // Legacy routes - commented out for now
import { setupVite, serveStatic, log } from "./vite";
import whatsappRouter from "./routes/whatsapp";
import apiRouter from "./routes/api";

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
    secure: process.env.NODE_ENV === 'production', // Secure cookies in production
    maxAge: sessionTtl,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
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

      log(logLine);
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
    const { db } = await import('./db');
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
      error: error.message,
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

// Importantly only setup vite in development and after
// setting up all the other routes so the catch-all route
// doesn't interfere with the other routes
(async () => {
  if (app.get("env") === "development") {
    await setupVite(app, app);
  } else {
    serveStatic(app);
  }

  // ============================================================================
  // SERVER START
  // ============================================================================

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // This serves both the API and the client.
  const port = parseInt(process.env.PORT || '5000', 10);
  app.listen(port, "0.0.0.0", () => {
    log(`🚀 JengaTrack server running on port ${port}`);
    log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    log(`🔐 Session store: PostgreSQL`);
    log(`💬 WhatsApp webhook: /webhook/webhook`);
    log(`🌐 API endpoint: /api`);
  });
})();
