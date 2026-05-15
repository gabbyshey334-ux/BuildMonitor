/**
 * Structured logging and optional alert webhook (Slack/Discord/generic).
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function log(level, message, meta = {}) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};

let lastAlertAt = 0;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

export async function sendAlert(payload) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  const now = Date.now();
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) return;
  lastAlertAt = now;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[JengaTrack] ${payload.level?.toUpperCase() || 'ALERT'}: ${payload.message}`,
        ...payload,
      }),
    });
  } catch (e) {
    console.error('[alert] webhook failed:', e?.message);
  }
}

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const meta = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
    };
    if (res.statusCode >= 500) {
      logger.error('request failed', meta);
      sendAlert({ level: 'error', message: `${req.method} ${req.path} → ${res.statusCode}`, ...meta });
    } else if (req.path.startsWith('/api')) {
      logger.info('request', meta);
    }
  });
  next();
}
