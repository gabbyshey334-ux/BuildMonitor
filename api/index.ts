/**
 * Vercel Serverless Function Entry Point
 * 
 * This file wraps the Express app for Vercel's serverless platform.
 * It handles all routes: /api/*, /webhook/*, /health, and static files.
 */

import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import whatsappRouter from "../server/routes/whatsapp";
import apiRouter from "../server/routes/api";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Trust proxy for Vercel
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
    secure: process.env.NODE_ENV === 'production', // Secure cookies in production (HTTPS required)
    maxAge: sessionTtl,
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax', // Use 'lax' for Vercel compatibility
    domain: process.env.COOKIE_DOMAIN, // Optional: set if using custom domain
  },
  name: 'jengatrack.sid',
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
  const originalJson = res.json;
  
  res.json = function (bodyJson, ...args) {
    return originalJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// ============================================================================
// ROUTE MOUNTING
// ============================================================================

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: 'production',
    platform: 'vercel',
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
    const { db } = await import('../server/db');
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

// Mount API routes
app.use('/api', apiRouter);

// Mount WhatsApp webhook routes
app.use('/webhook', whatsappRouter);

// Serve static files from the Vite build output
// In Vercel, static files are served by the filesystem handler, but we need this for local dev
const clientDistPath = path.join(__dirname, '..', 'dist', 'public');
app.use(express.static(clientDistPath));

// Catch-all route for SPA (serves index.html for all non-API routes)
app.get('*', (req: Request, res: Response) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook') || req.path === '/health') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  // Try to serve the file, fallback to index.html for SPA routing
  const filePath = path.join(clientDistPath, req.path);
  const indexPath = path.join(clientDistPath, 'index.html');
  
  // Check if file exists, otherwise serve index.html for SPA
  import('fs').then((fs) => {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.sendFile(filePath);
    } else {
      res.sendFile(indexPath);
    }
  }).catch(() => {
    res.sendFile(indexPath);
  });
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error('[Error Handler]', err);
  res.status(status).json({ 
    success: false,
    error: message,
  });
});

// ============================================================================
// EXPORT FOR VERCEL
// ============================================================================

// Vercel serverless function handler
// This wraps the Express app to work with Vercel's serverless architecture
export default (req: any, res: any) => {
  // Handle the request with Express
  return app(req, res);
};

