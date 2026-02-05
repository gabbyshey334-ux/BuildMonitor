import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL: JWT_SECRET not set in production!');
    console.error('   JWT authentication will NOT work. Set JWT_SECRET in Vercel environment variables.');
  } else {
    console.warn('⚠️ JWT_SECRET not set - using fallback (tokens may not work properly)');
  }
  return 'jwt-fallback-secret-change-in-production-' + Date.now();
})();

const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d'; // Token valid for 7 days

/**
 * Generate JWT token for user
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {string} JWT token
 */
export function generateToken(userId, email) {
  const payload = {
    userId,
    email,
    iat: Math.floor(Date.now() / 1000),
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });

  console.log('[JWT] Token generated for user:', userId);
  return token;
}

/**
 * Verify and decode JWT token
 * @param {string} token - JWT token to verify
 * @returns {object|null} Decoded token payload or null if invalid
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[JWT] Token verified for user:', decoded.userId);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.error('[JWT] Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      console.error('[JWT] Invalid token:', error.message);
    } else {
      console.error('[JWT] Verification failed:', error.message);
    }
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param {object} req - Express request object
 * @returns {string|null} Token or null if not found
 */
export function extractToken(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  // Format: "Bearer <token>"
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

