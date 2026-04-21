import jwt from 'jsonwebtoken';

/**
 * JWT secret resolution.
 *
 * Historically this file fell back to `'jwt-fallback-...' + Date.now()` when
 * JWT_SECRET wasn't set. That was a critical bug: the fallback changed value
 * on every cold start, so tokens signed by one Vercel serverless instance
 * could not be verified by the next — users were getting silently logged out
 * and, worse, the secret was low-entropy and effectively public.
 *
 * New contract:
 *   • Production MUST have JWT_SECRET. If not, sign/verify return an error
 *     and the app fails loud instead of pretending to work.
 *   • Dev/test uses a STABLE sentinel so local development is still usable
 *     without env setup, but tokens from this sentinel will never be
 *     accepted once JWT_SECRET is configured.
 */
const DEV_FALLBACK = 'dev-only-jwt-secret-DO-NOT-USE-IN-PRODUCTION';
const RAW_SECRET = process.env.JWT_SECRET;
const IS_PROD = process.env.NODE_ENV === 'production';

if (!RAW_SECRET) {
  if (IS_PROD) {
    console.error('❌ CRITICAL: JWT_SECRET is not set in production.');
    console.error('   Auth is disabled. Set JWT_SECRET in Vercel env vars and redeploy.');
  } else {
    console.warn('⚠️  JWT_SECRET not set — using insecure dev fallback. Do NOT deploy.');
  }
}

const JWT_SECRET = RAW_SECRET || (IS_PROD ? null : DEV_FALLBACK);
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Generate JWT token for user.
 * @param {string} userId
 * @param {string} email
 * @returns {string} JWT token
 * @throws Error when JWT_SECRET is missing in production.
 */
export function generateToken(userId, email) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured — cannot issue tokens.');
  }
  const payload = {
    userId,
    email,
    iat: Math.floor(Date.now() / 1000),
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  console.log('[JWT] Token generated for user:', userId);
  return token;
}

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {object|null} decoded payload or null when invalid / misconfigured.
 */
export function verifyToken(token) {
  if (!JWT_SECRET) {
    console.error('[JWT] verifyToken called but JWT_SECRET is not set');
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
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
 * Extract the bearer token from an Authorization header.
 * @param {object} req
 * @returns {string|null}
 */
export function extractToken(req) {
  const authHeader = req.headers?.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}
