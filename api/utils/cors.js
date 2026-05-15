/**
 * CORS allowlist — only configured dashboard origins may call the API with credentials.
 */

function parseAllowedOrigins() {
  const raw =
    process.env.ALLOWED_ORIGINS ||
    process.env.DASHBOARD_URL ||
    process.env.CLIENT_URL ||
    '';
  const fromEnv = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = [
    'https://build-monitor-lac.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
  ];
  return [...new Set([...fromEnv, ...defaults])];
}

let cachedOrigins = null;

export function getAllowedOrigins() {
  if (!cachedOrigins) cachedOrigins = parseAllowedOrigins();
  return cachedOrigins;
}

export function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  const allowed = getAllowedOrigins();

  if (req.method === 'OPTIONS') {
    if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, Accept'
      );
    }
    return res.status(204).end();
  }

  if (!origin) {
    return next();
  }

  if (!allowed.includes(origin)) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Origin not allowed',
    });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept'
  );
  next();
}
