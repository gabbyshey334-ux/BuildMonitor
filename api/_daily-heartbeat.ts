import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendDailyHeartbeat } from './whatsapp-webhook';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({
      error: 'Unauthorized',
    });
  }

  try {
    console.log('[Heartbeat] Starting daily heartbeat...');
    await sendDailyHeartbeat();
    console.log('[Heartbeat] ✅ Complete');
    return res.status(200).json({
      success: true,
      message: 'Daily heartbeat sent',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Heartbeat] Failed:', message);
    return res.status(500).json({
      error: message,
    });
  }
}
