import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";

// Simple hardcoded credentials for MVP
const CREDENTIALS = {
  owner: { username: "owner", password: "owner123", role: "owner" },
  manager: { username: "manager", password: "manager123", role: "manager" }
};

export function setupSimpleAuth(app: Express) {
  app.set("trust proxy", 1);
  
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
        throw new Error('SESSION_SECRET must be set in production environment');
      }
      console.warn('⚠️  Using default SESSION_SECRET in development. Set SESSION_SECRET environment variable for production.');
      return 'construction-monitor-dev-secret';
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
  }));

  // Login endpoint
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    
    // Find matching credentials
    const user = Object.values(CREDENTIALS).find(
      cred => cred.username === username && cred.password === password
    );
    
    if (user) {
      // Set session
      (req.session as any).user = {
        username: user.username,
        role: user.role,
        id: user.role === 'owner' ? 'owner-1' : 'manager-1'
      };
      
      res.json({ 
        success: true, 
        user: {
          username: user.username,
          role: user.role,
          id: user.role === 'owner' ? 'owner-1' : 'manager-1'
        }
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  // Logout endpoints - both GET and POST for flexibility
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ success: false, message: "Failed to logout" });
      } else {
        res.json({ success: true, message: "Logged out successfully" });
      }
    });
  });

  app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
      }
      // Always redirect to landing page regardless of session destroy result
      res.redirect("/");
    });
  });

  // Get current user
  app.get("/api/auth/user", (req, res) => {
    const user = (req.session as any)?.user;
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = (req.session as any)?.user;
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Add user to request for use in other endpoints
  (req as any).user = user;
  
  next();
};